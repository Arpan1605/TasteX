using HotelRoomOrdering.Api.Contracts.Contracts;
using HotelRoomOrdering.Api.Contracts.Kitchen;
using Microsoft.AspNetCore.Mvc;

namespace HotelRoomOrdering.Api.Controllers;

[Route("api/v1/kitchen")]
public sealed class KitchenController(IKitchenDashboardContract service) : ApiControllerBase
{
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] KitchenLoginRequest request, CancellationToken cancellationToken)
        => ToActionResult(await service.LoginAsync(request, cancellationToken));

    [HttpGet("orders")]
    public async Task<IActionResult> GetOrders([FromQuery] KitchenOrdersQuery query, CancellationToken cancellationToken)
        => ToActionResult(await service.GetPaidOrdersAsync(query, cancellationToken));

    [HttpPatch("orders/{orderId:long}/status")]
    public async Task<IActionResult> UpdateStatus([FromRoute] long orderId, [FromBody] UpdateOrderStatusRequest body, CancellationToken cancellationToken)
    {
        var request = body with { OrderId = orderId };
        return ToActionResult(await service.UpdateOrderStatusAsync(request, cancellationToken));
    }
}
