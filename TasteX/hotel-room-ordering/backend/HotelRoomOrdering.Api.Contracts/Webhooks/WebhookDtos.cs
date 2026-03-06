using HotelRoomOrdering.Api.Contracts.Enums;

namespace HotelRoomOrdering.Api.Contracts.Webhooks;

public sealed record PaymentWebhookRequest(
    PaymentGatewayProvider GatewayProvider,
    string EventType,
    string EventId,
    DateTimeOffset EventCreatedAtUtc,
    string Signature,
    string PayloadJson);

public sealed record PaymentWebhookAcknowledgeResponse(
    bool Accepted,
    string WebhookLogId,
    string Message);
