using HotelRoomOrdering.Api.Contracts.Enums;

namespace HotelRoomOrdering.Api.Contracts.Kitchen;

public sealed record KitchenOrderLineDto(
    long ItemId,
    string ItemName,
    bool IsVeg,
    int Quantity,
    decimal UnitPrice,
    decimal LineTotal);

public sealed record KitchenOrderDto(
    long OrderId,
    string OrderNumber,
    long HotelId,
    string HotelName,
    string HotelCode,
    string MaskedMobileNumber,
    PaymentMethod PaymentMethod,
    PaymentStatus PaymentStatus,
    OrderStatus OrderStatus,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc,
    int ServiceTimeMinutes,
    decimal TotalAmount,
    string CurrencyCode,
    IReadOnlyList<KitchenOrderLineDto> Lines);

public sealed record KitchenOrdersQuery(
    long KitchenId,
    long? HotelId,
    DateTimeOffset? FromUtc,
    DateTimeOffset? ToUtc,
    int PageNumber = 1,
    int PageSize = 50);

public sealed record KitchenOrdersResponse(
    int PageNumber,
    int PageSize,
    int TotalCount,
    IReadOnlyList<KitchenOrderDto> Orders);

public sealed record UpdateOrderStatusRequest(
    long OrderId,
    OrderStatus NewStatus,
    string UpdatedBy,
    string? Notes);

public sealed record UpdateOrderStatusResponse(
    long OrderId,
    string OrderNumber,
    OrderStatus PreviousStatus,
    OrderStatus CurrentStatus,
    DateTimeOffset UpdatedAtUtc);
