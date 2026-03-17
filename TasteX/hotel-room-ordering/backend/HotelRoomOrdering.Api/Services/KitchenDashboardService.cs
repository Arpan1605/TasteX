using HotelRoomOrdering.Api.Contracts.Common;
using HotelRoomOrdering.Api.Contracts.Contracts;
using HotelRoomOrdering.Api.Contracts.Enums;
using HotelRoomOrdering.Api.Contracts.Kitchen;
using HotelRoomOrdering.Api.Data;
using HotelRoomOrdering.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace HotelRoomOrdering.Api.Services;

public sealed class KitchenDashboardService(OrderingDbContext db, IClock clock, IPasswordHashService passwordHashService) : IKitchenDashboardContract
{
    public async Task<ApiResponse<KitchenLoginResponse>> LoginAsync(KitchenLoginRequest request, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password))
        {
            return new ApiResponse<KitchenLoginResponse>(false, null, new ApiError("LOGIN_INVALID", "Username and password are required."));
        }

        var normalizedUsername = request.Username.Trim().ToLowerInvariant();
        var kitchen = await db.Kitchens
            .AsNoTracking()
            .Include(k => k.City)
            .FirstOrDefaultAsync(k => k.LoginUsername == normalizedUsername, cancellationToken);

        if (kitchen is null || !kitchen.IsActive || !passwordHashService.VerifyPassword(request.Password, kitchen.PasswordHash))
        {
            return new ApiResponse<KitchenLoginResponse>(false, null, new ApiError("LOGIN_INVALID", "Invalid kitchen credentials."));
        }

        return new ApiResponse<KitchenLoginResponse>(
            true,
            new KitchenLoginResponse(
                kitchen.KitchenId,
                kitchen.Name,
                kitchen.LoginUsername,
                kitchen.City.Name,
                kitchen.IsActive),
            null);
    }

    public async Task<ApiResponse<KitchenOrdersResponse>> GetPaidOrdersAsync(KitchenOrdersQuery query, CancellationToken cancellationToken = default)
    {
        var baseQuery = db.Orders
            .AsNoTracking()
            .Include(o => o.Lines)
            .Where(o => o.KitchenId == query.KitchenId)
            .Where(o => o.PaymentMethod == PaymentMethod.Cod || (o.PaymentStatus == PaymentStatus.Paid && o.WebhookVerified));

        if (query.HotelId.HasValue)
        {
            baseQuery = baseQuery.Where(o => o.HotelId == query.HotelId.Value);
        }

        if (query.FromUtc.HasValue)
        {
            baseQuery = baseQuery.Where(o => o.CreatedAtUtc >= query.FromUtc.Value.UtcDateTime);
        }

        if (query.ToUtc.HasValue)
        {
            baseQuery = baseQuery.Where(o => o.CreatedAtUtc <= query.ToUtc.Value.UtcDateTime);
        }

        var totalCount = await baseQuery.CountAsync(cancellationToken);

        var pageSize = Math.Clamp(query.PageSize, 1, 200);
        var pageNumber = Math.Max(1, query.PageNumber);

        var orders = await baseQuery
            .OrderByDescending(o => o.CreatedAtUtc)
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var hotelIds = orders
            .Select(o => o.HotelId)
            .Distinct()
            .ToArray();

        var itemIds = orders
            .SelectMany(o => o.Lines)
            .Select(l => l.ItemId)
            .Distinct()
            .ToArray();

        var hotelMap = await db.Hotels
            .Where(h => hotelIds.Contains(h.HotelId))
            .ToDictionaryAsync(h => h.HotelId, cancellationToken);

        var itemMap = await db.Items
            .Where(i => itemIds.Contains(i.ItemId))
            .ToDictionaryAsync(i => i.ItemId, cancellationToken);

        var orderDtos = orders
            .Select(o =>
            {
                if (!hotelMap.TryGetValue(o.HotelId, out var hotel))
                {
                    return null;
                }

                var serviceMinutes = Math.Max(1, (int)(clock.UtcNow - o.CreatedAtUtc).TotalMinutes);

                var lines = o.Lines.Select(l =>
                {
                    var isVeg = itemMap.TryGetValue(l.ItemId, out var item) && item.IsVeg;
                    return new KitchenOrderLineDto(l.ItemId, l.ItemSnapshotName, isVeg, l.Quantity, l.UnitPrice, l.LineTotal);
                }).ToList();

                return new KitchenOrderDto(
                    o.OrderId,
                    o.OrderNumber,
                    o.HotelId,
                    hotel.Name,
                    hotel.HotelCode,
                    MaskMobile(o.MobileNumber),
                    o.MobileNumber,
                    o.RoomNumber,
                    o.PaymentMethod,
                    o.PaymentStatus,
                    o.OrderStatus,
                    new DateTimeOffset(o.CreatedAtUtc, TimeSpan.Zero),
                    new DateTimeOffset(o.UpdatedAtUtc, TimeSpan.Zero),
                    serviceMinutes,
                    o.TotalAmount,
                    o.CurrencyCode,
                    lines);
            })
            .Where(dto => dto is not null)
            .Select(dto => dto!)
            .ToList();

        return new ApiResponse<KitchenOrdersResponse>(
            true,
            new KitchenOrdersResponse(pageNumber, pageSize, totalCount, orderDtos),
            null);
    }

    public async Task<ApiResponse<UpdateOrderStatusResponse>> UpdateOrderStatusAsync(UpdateOrderStatusRequest request, CancellationToken cancellationToken = default)
    {
        var order = await db.Orders
            .AsNoTracking()
            .Where(o => o.OrderId == request.OrderId)
            .Select(o => new { o.OrderId, o.OrderNumber, o.OrderStatus })
            .FirstOrDefaultAsync(cancellationToken);

        if (order is null)
        {
            return new ApiResponse<UpdateOrderStatusResponse>(false, null, new ApiError("ORDER_NOT_FOUND", "Order not found."));
        }

        var previous = order.OrderStatus;
        var now = clock.UtcNow;
        var nextStatus = (byte)request.NewStatus;

        // Use SQL update to avoid failures when local DB schema drifts from EF model.
        await db.Database.ExecuteSqlRawAsync(
            "UPDATE dbo.Orders SET OrderStatus = {0}, UpdatedAtUtc = SYSUTCDATETIME() WHERE OrderId = {1};",
            [nextStatus, request.OrderId],
            cancellationToken);

        if (request.NewStatus == OrderStatus.Accepted)
        {
            await db.Database.ExecuteSqlRawAsync(
                "IF COL_LENGTH('dbo.Orders','AcceptedAtUtc') IS NOT NULL UPDATE dbo.Orders SET AcceptedAtUtc = SYSUTCDATETIME() WHERE OrderId = {0};",
                [request.OrderId],
                cancellationToken);
        }
        else if (request.NewStatus == OrderStatus.Preparing)
        {
            await db.Database.ExecuteSqlRawAsync(
                "IF COL_LENGTH('dbo.Orders','PreparingAtUtc') IS NOT NULL UPDATE dbo.Orders SET PreparingAtUtc = SYSUTCDATETIME() WHERE OrderId = {0};",
                [request.OrderId],
                cancellationToken);
        }
        else if (request.NewStatus == OrderStatus.Ready)
        {
            await db.Database.ExecuteSqlRawAsync(
                "IF COL_LENGTH('dbo.Orders','ReadyAtUtc') IS NOT NULL UPDATE dbo.Orders SET ReadyAtUtc = SYSUTCDATETIME() WHERE OrderId = {0};",
                [request.OrderId],
                cancellationToken);
        }
        else if (request.NewStatus == OrderStatus.Delivered)
        {
            await db.Database.ExecuteSqlRawAsync(
                "IF COL_LENGTH('dbo.Orders','DeliveredAtUtc') IS NOT NULL UPDATE dbo.Orders SET DeliveredAtUtc = SYSUTCDATETIME() WHERE OrderId = {0};",
                [request.OrderId],
                cancellationToken);
        }
        else if (request.NewStatus == OrderStatus.Cancelled)
        {
            await db.Database.ExecuteSqlRawAsync(
                "IF COL_LENGTH('dbo.Orders','CancelledAtUtc') IS NOT NULL UPDATE dbo.Orders SET CancelledAtUtc = SYSUTCDATETIME() WHERE OrderId = {0};",
                [request.OrderId],
                cancellationToken);
        }

        // Keep history write best-effort.
        try
        {
            db.OrderStatusHistory.Add(new OrderStatusHistory
            {
                OrderId = order.OrderId,
                PreviousStatus = previous,
                NewStatus = request.NewStatus,
                ChangedBy = request.UpdatedBy,
                Notes = request.Notes,
                ChangedAtUtc = now
            });

            await db.SaveChangesAsync(cancellationToken);
        }
        catch
        {
            // History write failure should not block kitchen workflow.
        }

        return new ApiResponse<UpdateOrderStatusResponse>(
            true,
            new UpdateOrderStatusResponse(order.OrderId, order.OrderNumber, previous, request.NewStatus, new DateTimeOffset(now, TimeSpan.Zero)),
            null);
    }

    public async Task<ApiResponse<UpdatePaymentStatusResponse>> UpdatePaymentStatusAsync(UpdatePaymentStatusRequest request, CancellationToken cancellationToken = default)
    {
        var order = await db.Orders
            .AsNoTracking()
            .Where(o => o.OrderId == request.OrderId)
            .Select(o => new { o.OrderId, o.OrderNumber, o.PaymentMethod, o.PaymentStatus })
            .FirstOrDefaultAsync(cancellationToken);

        if (order is null)
        {
            return new ApiResponse<UpdatePaymentStatusResponse>(false, null, new ApiError("ORDER_NOT_FOUND", "Order not found."));
        }

        if (order.PaymentMethod != PaymentMethod.Cod)
        {
            return new ApiResponse<UpdatePaymentStatusResponse>(false, null, new ApiError("PAYMENT_METHOD_NOT_COD", "Only COD payments can be marked as received from kitchen."));
        }

        if (request.NewStatus != PaymentStatus.Paid)
        {
            return new ApiResponse<UpdatePaymentStatusResponse>(false, null, new ApiError("PAYMENT_STATUS_INVALID", "Only 'Paid' status is supported for COD received."));
        }

        var previous = order.PaymentStatus;
        var now = clock.UtcNow;

        if (previous != PaymentStatus.Paid)
        {
            await db.Database.ExecuteSqlRawAsync(
                "UPDATE dbo.Orders SET PaymentStatus = {0}, UpdatedAtUtc = SYSUTCDATETIME() WHERE OrderId = {1};",
                [(byte)request.NewStatus, request.OrderId],
                cancellationToken);
        }

        return new ApiResponse<UpdatePaymentStatusResponse>(
            true,
            new UpdatePaymentStatusResponse(order.OrderId, order.OrderNumber, previous, request.NewStatus, new DateTimeOffset(now, TimeSpan.Zero)),
            null);
    }
    private static string MaskMobile(string mobile)
    {
        if (string.IsNullOrWhiteSpace(mobile) || mobile.Length < 6)
        {
            return "******";
        }

        return $"{mobile[..2]}******{mobile[^2..]}";
    }
}





