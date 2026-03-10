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

        var hotelMap = await db.Hotels
            .Where(h => orders.Select(o => o.HotelId).Contains(h.HotelId))
            .ToDictionaryAsync(h => h.HotelId, cancellationToken);

        var itemMap = await db.Items
            .Where(i => orders.SelectMany(o => o.Lines).Select(l => l.ItemId).Contains(i.ItemId))
            .ToDictionaryAsync(i => i.ItemId, cancellationToken);

        var orderDtos = orders.Select(o =>
        {
            var hotel = hotelMap[o.HotelId];
            var serviceMinutes = Math.Max(1, (int)(clock.UtcNow - o.CreatedAtUtc).TotalMinutes);

            var lines = o.Lines.Select(l =>
            {
                var item = itemMap[l.ItemId];
                return new KitchenOrderLineDto(l.ItemId, l.ItemSnapshotName, item.IsVeg, l.Quantity, l.UnitPrice, l.LineTotal);
            }).ToList();

            return new KitchenOrderDto(
                o.OrderId,
                o.OrderNumber,
                o.HotelId,
                hotel.Name,
                hotel.HotelCode,
                MaskMobile(o.MobileNumber),
                o.PaymentMethod,
                o.PaymentStatus,
                o.OrderStatus,
                new DateTimeOffset(o.CreatedAtUtc, TimeSpan.Zero),
                new DateTimeOffset(o.UpdatedAtUtc, TimeSpan.Zero),
                serviceMinutes,
                o.TotalAmount,
                o.CurrencyCode,
                lines);
        }).ToList();

        return new ApiResponse<KitchenOrdersResponse>(
            true,
            new KitchenOrdersResponse(pageNumber, pageSize, totalCount, orderDtos),
            null);
    }

    public async Task<ApiResponse<UpdateOrderStatusResponse>> UpdateOrderStatusAsync(UpdateOrderStatusRequest request, CancellationToken cancellationToken = default)
    {
        var order = await db.Orders.FirstOrDefaultAsync(o => o.OrderId == request.OrderId, cancellationToken);
        if (order is null)
        {
            return new ApiResponse<UpdateOrderStatusResponse>(false, null, new ApiError("ORDER_NOT_FOUND", "Order not found."));
        }

        var previous = order.OrderStatus;
        order.OrderStatus = request.NewStatus;

        switch (request.NewStatus)
        {
            case OrderStatus.Accepted:
                order.AcceptedAtUtc = clock.UtcNow;
                break;
            case OrderStatus.Preparing:
                order.PreparingAtUtc = clock.UtcNow;
                break;
            case OrderStatus.Ready:
                order.ReadyAtUtc = clock.UtcNow;
                break;
            case OrderStatus.Delivered:
                order.DeliveredAtUtc = clock.UtcNow;
                break;
            case OrderStatus.Cancelled:
                order.CancelledAtUtc = clock.UtcNow;
                break;
        }

        order.UpdatedAtUtc = clock.UtcNow;

        db.OrderStatusHistory.Add(new OrderStatusHistory
        {
            OrderId = order.OrderId,
            PreviousStatus = previous,
            NewStatus = request.NewStatus,
            ChangedBy = request.UpdatedBy,
            Notes = request.Notes,
            ChangedAtUtc = clock.UtcNow
        });

        await db.SaveChangesAsync(cancellationToken);

        return new ApiResponse<UpdateOrderStatusResponse>(
            true,
            new UpdateOrderStatusResponse(order.OrderId, order.OrderNumber, previous, order.OrderStatus, new DateTimeOffset(order.UpdatedAtUtc, TimeSpan.Zero)),
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
