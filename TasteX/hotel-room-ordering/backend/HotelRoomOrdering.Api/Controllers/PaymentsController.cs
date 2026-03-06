using HotelRoomOrdering.Api.Contracts.Contracts;
using HotelRoomOrdering.Api.Contracts.Payments;
using Microsoft.AspNetCore.Mvc;

namespace HotelRoomOrdering.Api.Controllers;

[Route("api/v1/payments")]
public sealed class PaymentsController(IPaymentContract service) : ApiControllerBase
{
    [HttpPost("orders")]
    public async Task<IActionResult> CreateOrder([FromBody] CreatePaymentOrderRequest request, CancellationToken cancellationToken)
        => ToActionResult(await service.CreatePaymentOrderAsync(request, cancellationToken));

    [HttpPost("verify")]
    public async Task<IActionResult> Verify([FromBody] VerifyPaymentRequest request, CancellationToken cancellationToken)
        => ToActionResult(await service.VerifyPaymentAsync(request, cancellationToken));
}
