using HotelRoomOrdering.Api.Contracts.Common;
using HotelRoomOrdering.Api.Contracts.Webhooks;

namespace HotelRoomOrdering.Api.Contracts.Contracts;

public interface IWebhookContract
{
    Task<ApiResponse<PaymentWebhookAcknowledgeResponse>> ReceivePaymentWebhookAsync(PaymentWebhookRequest request, CancellationToken cancellationToken = default);
}
