using HotelRoomOrdering.Api.Contracts.Catalog;
using HotelRoomOrdering.Api.Contracts.Common;
using HotelRoomOrdering.Api.Contracts.Contracts;
using HotelRoomOrdering.Api.Contracts.Enums;
using HotelRoomOrdering.Api.Contracts.Guest;
using HotelRoomOrdering.Api.Data;
using HotelRoomOrdering.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace HotelRoomOrdering.Api.Services;

public sealed class GuestOrderingService(
    OrderingDbContext db,
    IClock clock,
    IHashService hashService) : IGuestOrderingContract
{
    public async Task<ApiResponse<HotelMenuResponse>> GetHotelMenuAsync(string hotelCode, CancellationToken cancellationToken = default)
    {
        var hotel = await db.Hotels
            .Include(h => h.City)
            .Include(h => h.Kitchen)
            .FirstOrDefaultAsync(h => h.HotelCode == hotelCode && h.IsActive, cancellationToken);

        if (hotel is null)
        {
            return new ApiResponse<HotelMenuResponse>(false, null, new ApiError("HOTEL_NOT_FOUND", "Invalid or inactive hotel code."));
        }

        var availability = await db.KitchenItemAvailability
            .Where(a => a.KitchenId == hotel.KitchenId && a.IsAvailable)
            .ToListAsync(cancellationToken);

        var availableItemIds = availability.Select(a => a.ItemId).ToHashSet();

        var items = await db.Items
            .Where(i => i.IsActive && availableItemIds.Contains(i.ItemId))
            .ToListAsync(cancellationToken);

        var categories = await db.Categories
            .Where(c => c.IsActive)
            .OrderBy(c => c.SortOrder)
            .ToListAsync(cancellationToken);

        var categoryDtos = categories
            .Select(c => new MenuCategoryDto(
                c.CategoryId,
                c.Name,
                c.SortOrder,
                items.Where(i => i.CategoryId == c.CategoryId)
                    .Select(i =>
                    {
                        var effective = availability.First(a => a.ItemId == i.ItemId);
                        return new MenuItemDto(
                            i.ItemId,
                            i.ItemCode,
                            i.Name,
                            i.Description,
                            effective.EffectivePrice ?? i.BasePrice,
                            i.IsVeg,
                            effective.IsAvailable);
                    })
                    .ToList()))
            .Where(c => c.Items.Count > 0)
            .ToList();

        var response = new HotelMenuResponse(
            hotel.HotelId,
            hotel.HotelCode,
            hotel.Name,
            hotel.CityId,
            hotel.City.Name,
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

        var otpCode = Random.Shared.Next(100000, 999999).ToString();
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

        var availablePrices = await db.KitchenItemAvailability
            .Where(x => x.KitchenId == hotel.KitchenId && x.IsAvailable && itemIds.Contains(x.ItemId))
            .ToDictionaryAsync(x => x.ItemId, cancellationToken);

        var items = await db.Items.Where(i => itemIds.Contains(i.ItemId) && i.IsActive).ToDictionaryAsync(i => i.ItemId, cancellationToken);

        var lines = new List<OrderLine>();
        foreach (var lineRequest in lineRequests)
        {
            if (!items.TryGetValue(lineRequest.ItemId, out var item) || !availablePrices.TryGetValue(lineRequest.ItemId, out var availability))
            {
                return new ApiResponse<CheckoutResponse>(false, null, new ApiError("ITEM_UNAVAILABLE", $"Item {lineRequest.ItemId} is unavailable."));
            }

            var price = availability.EffectivePrice ?? item.BasePrice;
            lines.Add(new OrderLine
            {
                ItemId = item.ItemId,
                ItemSnapshotName = item.Name,
                IsVegSnapshot = item.IsVeg,
                Quantity = lineRequest.Quantity,
                UnitPrice = price,
                LineTotal = price * lineRequest.Quantity,
                CreatedAtUtc = clock.UtcNow
            });
        }

        var subtotal = lines.Sum(l => l.LineTotal);
        var order = new Order
        {
            OrderNumber = $"TX-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}",
            GuestSessionId = guestSession.GuestSessionId,
            HotelId = hotel.HotelId,
            KitchenId = hotel.KitchenId,
            MobileNumber = guestSession.MobileNumber,
            CurrencyCode = request.CurrencyCode,
            PaymentMethod = PaymentMethod.Cod,
            SubTotalAmount = subtotal,
            TaxAmount = 0,
            DiscountAmount = 0,
            TotalAmount = subtotal,
            PaymentStatus = PaymentStatus.Pending,
            WebhookVerified = false,
            OrderStatus = OrderStatus.Accepted,
            AcceptedAtUtc = clock.UtcNow,
            GuestNotes = request.GuestNotes,
            CreatedAtUtc = clock.UtcNow,
            UpdatedAtUtc = clock.UtcNow,
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
