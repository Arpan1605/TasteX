using HotelRoomOrdering.Api.Contracts.Catalog;
using HotelRoomOrdering.Api.Contracts.Common;
using HotelRoomOrdering.Api.Contracts.Contracts;
using HotelRoomOrdering.Api.Contracts.Enums;
using HotelRoomOrdering.Api.Contracts.Guest;
using HotelRoomOrdering.Api.Data;
using HotelRoomOrdering.Api.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;

namespace HotelRoomOrdering.Api.Services;

public sealed class GuestOrderingService(
    OrderingDbContext db,
    IClock clock,
    IHashService hashService,
    IHostEnvironment environment) : IGuestOrderingContract
{
    public async Task<ApiResponse<HotelMenuResponse>> GetHotelMenuAsync(string hotelCode, CancellationToken cancellationToken = default)
    {
        var hotel = await db.Hotels
            .AsNoTracking()
            .Include(h => h.City)
            .Include(h => h.Kitchen)
            .FirstOrDefaultAsync(h => h.HotelCode == hotelCode && h.IsActive, cancellationToken);

        if (hotel is null)
        {
            return new ApiResponse<HotelMenuResponse>(false, null, new ApiError("HOTEL_NOT_FOUND", "Invalid or inactive hotel code."));
        }

        var hotelMenuItems = await db.HotelMenuItems
            .AsNoTracking()
            .Include(hmi => hmi.Item)
            .ThenInclude(i => i.Category)
            .Where(hmi => hmi.HotelId == hotel.HotelId)
            .ToListAsync(cancellationToken);

        var menuItemIds = hotelMenuItems.Select(x => x.ItemId).Distinct().ToList();
        var availability = await db.KitchenItemAvailability
            .AsNoTracking()
            .Where(a => a.KitchenId == hotel.KitchenId
                && a.IsAvailable
                && (a.EffectiveToUtc == null || a.EffectiveToUtc >= clock.UtcNow)
                && menuItemIds.Contains(a.ItemId))
            .ToListAsync(cancellationToken);

        var availabilityByItemId = availability
            .GroupBy(a => a.ItemId)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.EffectiveFromUtc).First());

        var categories = await db.Categories
            .AsNoTracking()
            .Where(c => c.IsActive)
            .OrderBy(c => c.SortOrder)
            .ThenBy(c => c.Name)
            .ToListAsync(cancellationToken);

        var categoryDtos = categories
            .Select(c => new MenuCategoryDto(
                c.CategoryId,
                c.Name,
                c.CategoryIcon,
                c.SortOrder,
                hotelMenuItems
                    .Where(hmi => hmi.Item.CategoryId == c.CategoryId
                        && hmi.IsActive
                        && hmi.Item.IsActive
                        && hmi.Item.Category.IsActive)
                    .OrderBy(hmi => hmi.Item.Name)
                    .Select(hmi =>
                    {
                        availabilityByItemId.TryGetValue(hmi.ItemId, out var effective);
                        var hasInventory = hmi.InventoryQuantity > 0;
                        var isAvailable = hasInventory && effective is not null && effective.IsAvailable;
                        return new MenuItemDto(
                            hmi.ItemId,
                            hmi.Item.ItemCode,
                            hmi.Item.Name,
                            hmi.Item.Description,
                            effective?.EffectivePrice ?? hmi.Item.BasePrice,
                            hmi.Item.IsVeg,
                            isAvailable,
                            hmi.ImageUrl);
                    })
                    .ToList()))
            .ToList();

        var response = new HotelMenuResponse(
            hotel.HotelId,
            hotel.HotelCode,
            hotel.Name,
            hotel.CityId,
            hotel.City.Name,
            hotel.City.StateName,
            hotel.AddressLine,
            hotel.KitchenId,
            hotel.Kitchen.Name,
            categoryDtos);

        return new ApiResponse<HotelMenuResponse>(true, response, null);
    }

    public async Task<ApiResponse<SendOtpResponse>> SendOtpAsync(SendOtpRequest request, CancellationToken cancellationToken = default)
    {
        var hotel = await db.Hotels.FirstOrDefaultAsync(h => h.HotelCode == request.HotelCode && h.IsActive, cancellationToken);
        if (hotel is null)
        {
            return new ApiResponse<SendOtpResponse>(false, null, new ApiError("HOTEL_NOT_FOUND", "Invalid hotel code."));
        }

        var useDummyOtp = environment.IsDevelopment() || environment.IsEnvironment("UAT");
        var otpCode = useDummyOtp ? "123456" : Random.Shared.Next(100000, 999999).ToString();
        var expiresAt = clock.UtcNow.AddMinutes(5);

        var session = new OtpSession
        {
            OtpSessionId = Guid.NewGuid(),
            HotelId = hotel.HotelId,
            MobileNumber = request.MobileNumber,
            OtpHash = hashService.Hash(otpCode),
            OtpPurpose = request.Purpose,
            ExpiresAtUtc = expiresAt,
            CreatedAtUtc = clock.UtcNow,
            AttemptCount = 0,
            MaxAttempts = 5,
            IsBlocked = false
        };

        db.OtpSessions.Add(session);
        await db.SaveChangesAsync(cancellationToken);

        var response = new SendOtpResponse(
            session.OtpSessionId.ToString(),
            new DateTimeOffset(expiresAt, TimeSpan.Zero),
            300,
            false,
            session.MaxAttempts);

        return new ApiResponse<SendOtpResponse>(true, response, null);
    }

    public async Task<ApiResponse<VerifyOtpResponse>> VerifyOtpAsync(VerifyOtpRequest request, CancellationToken cancellationToken = default)
    {
        if (!Guid.TryParse(request.OtpSessionId, out var sessionId))
        {
            return new ApiResponse<VerifyOtpResponse>(false, null, new ApiError("INVALID_SESSION", "Invalid OTP session id."));
        }

        var session = await db.OtpSessions.FirstOrDefaultAsync(
            o => o.OtpSessionId == sessionId && o.MobileNumber == request.MobileNumber,
            cancellationToken);

        if (session is null)
        {
            return new ApiResponse<VerifyOtpResponse>(false, null, new ApiError("SESSION_NOT_FOUND", "OTP session not found."));
        }

        if (session.IsBlocked || session.AttemptCount >= session.MaxAttempts)
        {
            return new ApiResponse<VerifyOtpResponse>(false, null, new ApiError("OTP_BLOCKED", "OTP attempts exceeded."));
        }

        if (session.ExpiresAtUtc < clock.UtcNow)
        {
            return new ApiResponse<VerifyOtpResponse>(false, null, new ApiError("OTP_EXPIRED", "OTP has expired."));
        }

        var isValid = hashService.Hash(request.OtpCode) == session.OtpHash;
        session.AttemptCount += 1;
        session.LastAttemptAtUtc = clock.UtcNow;

        if (!isValid)
        {
            if (session.AttemptCount >= session.MaxAttempts)
            {
                session.IsBlocked = true;
            }

            await db.SaveChangesAsync(cancellationToken);
            return new ApiResponse<VerifyOtpResponse>(false, null, new ApiError("INVALID_OTP", "OTP is invalid."));
        }

        session.VerifiedAtUtc = clock.UtcNow;

        var token = Convert.ToBase64String(Guid.NewGuid().ToByteArray());
        var guestSession = new GuestSession
        {
            GuestSessionId = Guid.NewGuid(),
            OtpSessionId = session.OtpSessionId,
            HotelId = session.HotelId,
            MobileNumber = session.MobileNumber,
            SessionTokenHash = hashService.Hash(token),
            ExpiresAtUtc = clock.UtcNow.AddHours(2),
            CreatedAtUtc = clock.UtcNow,
            IsRevoked = false
        };

        db.GuestSessions.Add(guestSession);
        await db.SaveChangesAsync(cancellationToken);

        var response = new VerifyOtpResponse(true, token, new DateTimeOffset(guestSession.ExpiresAtUtc, TimeSpan.Zero));
        return new ApiResponse<VerifyOtpResponse>(true, response, null);
    }

    public async Task<ApiResponse<CheckoutResponse>> CheckoutAsync(CheckoutRequest request, CancellationToken cancellationToken = default)
    {
        if (request.PaymentMethod != PaymentMethod.Cod)
        {
            return new ApiResponse<CheckoutResponse>(false, null, new ApiError("PAYMENT_METHOD_NOT_SUPPORTED", "Only COD is enabled in current phase."));
        }

        var tokenHash = hashService.Hash(request.GuestSessionToken);
        var guestSession = await db.GuestSessions
            .FirstOrDefaultAsync(g => g.SessionTokenHash == tokenHash && !g.IsRevoked && g.ExpiresAtUtc >= clock.UtcNow, cancellationToken);

        if (guestSession is null)
        {
            return new ApiResponse<CheckoutResponse>(false, null, new ApiError("INVALID_SESSION", "Guest session is invalid or expired."));
        }

        var hotel = await db.Hotels.FirstOrDefaultAsync(h => h.HotelCode == request.HotelCode && h.IsActive, cancellationToken);
        if (hotel is null)
        {
            return new ApiResponse<CheckoutResponse>(false, null, new ApiError("HOTEL_NOT_FOUND", "Invalid hotel code."));
        }

        var lineRequests = request.Lines.Where(l => l.Quantity > 0).ToList();
        if (lineRequests.Count == 0)
        {
            return new ApiResponse<CheckoutResponse>(false, null, new ApiError("EMPTY_CART", "No order lines provided."));
        }

        var itemIds = lineRequests.Select(x => x.ItemId).ToHashSet();

        var hotelMenuItems = await db.HotelMenuItems
            .Include(hmi => hmi.Item)
            .ThenInclude(i => i.Category)
            .Where(hmi => hmi.HotelId == hotel.HotelId && itemIds.Contains(hmi.ItemId))
            .ToDictionaryAsync(hmi => hmi.ItemId, cancellationToken);

        var availability = await db.KitchenItemAvailability
            .AsNoTracking()
            .Where(x => x.KitchenId == hotel.KitchenId
                && x.IsAvailable
                && (x.EffectiveToUtc == null || x.EffectiveToUtc >= clock.UtcNow)
                && itemIds.Contains(x.ItemId))
            .ToListAsync(cancellationToken);

        var availabilityByItemId = availability
            .GroupBy(x => x.ItemId)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.EffectiveFromUtc).First());

        var now = clock.UtcNow;
        var lines = new List<OrderLine>();
        foreach (var lineRequest in lineRequests)
        {
            if (!hotelMenuItems.TryGetValue(lineRequest.ItemId, out var hotelMenuItem))
            {
                return new ApiResponse<CheckoutResponse>(false, null, new ApiError("ITEM_UNAVAILABLE", $"Item {lineRequest.ItemId} is unavailable."));
            }

            var item = hotelMenuItem.Item;
            if (!hotelMenuItem.IsActive || !item.IsActive || !item.Category.IsActive)
            {
                return new ApiResponse<CheckoutResponse>(false, null, new ApiError("ITEM_UNAVAILABLE", $"Item {lineRequest.ItemId} is unavailable."));
            }

            if (!availabilityByItemId.TryGetValue(lineRequest.ItemId, out var itemAvailability))
            {
                return new ApiResponse<CheckoutResponse>(false, null, new ApiError("ITEM_UNAVAILABLE", $"Item {lineRequest.ItemId} is unavailable."));
            }

            if (hotelMenuItem.InventoryQuantity < lineRequest.Quantity)
            {
                return new ApiResponse<CheckoutResponse>(false, null, new ApiError("ITEM_UNAVAILABLE", $"Item {lineRequest.ItemId} is out of stock."));
            }

            var price = itemAvailability.EffectivePrice ?? item.BasePrice;
            lines.Add(new OrderLine
            {
                ItemId = item.ItemId,
                ItemSnapshotName = item.Name,
                IsVegSnapshot = item.IsVeg,
                Quantity = lineRequest.Quantity,
                UnitPrice = price,
                LineTotal = price * lineRequest.Quantity,
                CreatedAtUtc = now
            });

            hotelMenuItem.InventoryQuantity -= lineRequest.Quantity;
            hotelMenuItem.UpdatedAtUtc = now;
        }

        var subtotal = lines.Sum(l => l.LineTotal);
        var order = new Order
        {
            OrderNumber = $"TX-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}",
            GuestSessionId = guestSession.GuestSessionId,
            HotelId = hotel.HotelId,
            KitchenId = hotel.KitchenId,
            MobileNumber = guestSession.MobileNumber,
            RoomNumber = string.IsNullOrWhiteSpace(request.RoomNumber) ? null : request.RoomNumber.Trim(),
            CurrencyCode = request.CurrencyCode,
            PaymentMethod = PaymentMethod.Cod,
            SubTotalAmount = subtotal,
            TaxAmount = 0,
            DiscountAmount = 0,
            TotalAmount = subtotal,
            PaymentStatus = PaymentStatus.Pending,
            WebhookVerified = false,
            OrderStatus = OrderStatus.Accepted,
            AcceptedAtUtc = now,
            GuestNotes = request.GuestNotes,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
            Lines = lines
        };

        db.Orders.Add(order);
        await db.SaveChangesAsync(cancellationToken);

        var response = new CheckoutResponse(
            order.OrderId,
            order.OrderNumber,
            order.HotelId,
            order.KitchenId,
            order.TotalAmount,
            order.CurrencyCode,
            order.PaymentMethod,
            new DateTimeOffset(order.CreatedAtUtc, TimeSpan.Zero),
            lines.Select(l => new CheckoutLineDto(l.ItemId, l.ItemSnapshotName, l.Quantity, l.UnitPrice, l.LineTotal)).ToList());

        return new ApiResponse<CheckoutResponse>(true, response, null);
    }

    public async Task<ApiResponse<OrderStatusResponse>> GetOrderStatusAsync(string orderNumber, CancellationToken cancellationToken = default)
    {
        var order = await db.Orders.FirstOrDefaultAsync(o => o.OrderNumber == orderNumber, cancellationToken);
        if (order is null)
        {
            return new ApiResponse<OrderStatusResponse>(false, null, new ApiError("ORDER_NOT_FOUND", "Order not found."));
        }

        var hotelCode = await db.Hotels.Where(h => h.HotelId == order.HotelId).Select(h => h.HotelCode).FirstAsync(cancellationToken);

        var serviceTime = (int)Math.Max(1, (clock.UtcNow - order.CreatedAtUtc).TotalMinutes);
        var response = new OrderStatusResponse(
            order.OrderId,
            order.OrderNumber,
            hotelCode,
            order.PaymentMethod,
            order.PaymentStatus,
            order.OrderStatus,
            new DateTimeOffset(order.CreatedAtUtc, TimeSpan.Zero),
            new DateTimeOffset(order.UpdatedAtUtc, TimeSpan.Zero),
            serviceTime,
            order.TotalAmount,
            order.CurrencyCode);

        return new ApiResponse<OrderStatusResponse>(true, response, null);
    }
}










