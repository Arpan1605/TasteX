using HotelRoomOrdering.Api.Contracts.Common;
using HotelRoomOrdering.Api.Contracts.Contracts;
using HotelRoomOrdering.Api.Contracts.Webhooks;

namespace HotelRoomOrdering.Api.Services;

public sealed class WebhookService : IWebhookContract
{
    public Task<ApiResponse<PaymentWebhookAcknowledgeResponse>> ReceivePaymentWebhookAsync(PaymentWebhookRequest request, CancellationToken cancellationToken = default)
    {
        var response = new ApiResponse<PaymentWebhookAcknowledgeResponse>(
            false,
            null,
            new ApiError("WEBHOOK_DISABLED", "Payment webhook processing is disabled in current COD-only phase."));

        return Task.FromResult(response);
    }
}
