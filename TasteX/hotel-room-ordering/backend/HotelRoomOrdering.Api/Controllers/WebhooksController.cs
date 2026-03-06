using HotelRoomOrdering.Api.Contracts.Contracts;
using HotelRoomOrdering.Api.Contracts.Webhooks;
using Microsoft.AspNetCore.Mvc;

namespace HotelRoomOrdering.Api.Controllers;

[Route("api/v1/webhooks")]
public sealed class WebhooksController(IWebhookContract service) : ApiControllerBase
{
    [HttpPost("payments")]
    public async Task<IActionResult> Receive([FromBody] PaymentWebhookRequest request, CancellationToken cancellationToken)
        => ToActionResult(await service.ReceivePaymentWebhookAsync(request, cancellationToken));
}
