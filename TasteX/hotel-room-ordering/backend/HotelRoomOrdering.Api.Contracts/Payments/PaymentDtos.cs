using HotelRoomOrdering.Api.Contracts.Enums;

namespace HotelRoomOrdering.Api.Contracts.Payments;

public sealed record CreatePaymentOrderRequest(
    long OrderId,
    decimal Amount,
    string CurrencyCode,
    PaymentGatewayProvider GatewayProvider,
    string CustomerMobile,
    string CustomerName,
    string CallbackUrl,
    string ClientReference);

public sealed record CreatePaymentOrderResponse(
    string PaymentOrderId,
    PaymentGatewayProvider GatewayProvider,
    string CheckoutUrl,
    DateTimeOffset ExpiresAtUtc);

public sealed record VerifyPaymentRequest(
    long OrderId,
    string PaymentOrderId,
    string GatewayPaymentId,
    string Signature,
    string RawPayload);

public sealed record VerifyPaymentResponse(
    bool Verified,
    PaymentStatus PaymentStatus,
    DateTimeOffset VerifiedAtUtc,
    string VerificationReference);
