using HotelRoomOrdering.Api.Contracts.Enums;

namespace HotelRoomOrdering.Api.Contracts.Guest;

public sealed record SendOtpRequest(
    string MobileNumber,
    string HotelCode,
    OtpPurpose Purpose = OtpPurpose.GuestLogin);

public sealed record SendOtpResponse(
    string OtpSessionId,
    DateTimeOffset ExpiresAtUtc,
    int ExpiresInSeconds,
    bool IsRateLimited,
    int RemainingAttempts);

public sealed record VerifyOtpRequest(
    string OtpSessionId,
    string MobileNumber,
    string OtpCode);

public sealed record VerifyOtpResponse(
    bool Verified,
    string GuestSessionToken,
    DateTimeOffset SessionExpiresAtUtc);

public sealed record CartLineRequest(
    long ItemId,
    int Quantity);

public sealed record CheckoutRequest(
    string GuestSessionToken,
    string HotelCode,
    string CurrencyCode,
    PaymentMethod PaymentMethod,
    IReadOnlyList<CartLineRequest> Lines,
    string? GuestNotes,
    string ClientOrderRef);

public sealed record CheckoutLineDto(
    long ItemId,
    string ItemName,
    int Quantity,
    decimal UnitPrice,
    decimal LineTotal);

public sealed record CheckoutResponse(
    long OrderId,
    string OrderNumber,
    long HotelId,
    long KitchenId,
    decimal TotalAmount,
    string CurrencyCode,
    PaymentMethod PaymentMethod,
    DateTimeOffset CreatedAtUtc,
    IReadOnlyList<CheckoutLineDto> Lines);

public sealed record OrderStatusResponse(
    long OrderId,
    string OrderNumber,
    string HotelCode,
    PaymentMethod PaymentMethod,
    PaymentStatus PaymentStatus,
    OrderStatus OrderStatus,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc,
    int ServiceTimeMinutes,
    decimal TotalAmount,
    string CurrencyCode);
