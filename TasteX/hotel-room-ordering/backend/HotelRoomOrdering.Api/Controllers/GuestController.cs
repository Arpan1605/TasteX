using HotelRoomOrdering.Api.Contracts.Contracts;
using HotelRoomOrdering.Api.Contracts.Guest;
using Microsoft.AspNetCore.Mvc;

namespace HotelRoomOrdering.Api.Controllers;

[Route("api/v1/guest")]
public sealed class GuestController(IGuestOrderingContract service) : ApiControllerBase
{
    [HttpGet("kitchens/{kitchenCode}/context")]
    public async Task<IActionResult> GetKitchenContext([FromRoute] string kitchenCode, CancellationToken cancellationToken)
        => ToActionResult(await service.GetKitchenEntryAsync(kitchenCode, cancellationToken));

    [HttpGet("hotels/{hotelCode}/menu")]
    public async Task<IActionResult> GetMenu([FromRoute] string hotelCode, CancellationToken cancellationToken)
        => ToActionResult(await service.GetHotelMenuAsync(hotelCode, cancellationToken));

    [HttpPost("otp/send")]
    public async Task<IActionResult> SendOtp([FromBody] SendOtpRequest request, CancellationToken cancellationToken)
        => ToActionResult(await service.SendOtpAsync(request, cancellationToken));

    [HttpPost("otp/verify")]
    public async Task<IActionResult> VerifyOtp([FromBody] VerifyOtpRequest request, CancellationToken cancellationToken)
        => ToActionResult(await service.VerifyOtpAsync(request, cancellationToken));

    [HttpPost("checkout")]
    public async Task<IActionResult> Checkout([FromBody] CheckoutRequest request, CancellationToken cancellationToken)
        => ToActionResult(await service.CheckoutAsync(request, cancellationToken));

    [HttpGet("orders/{orderNumber}/status")]
    public async Task<IActionResult> OrderStatus([FromRoute] string orderNumber, CancellationToken cancellationToken)
        => ToActionResult(await service.GetOrderStatusAsync(orderNumber, cancellationToken));
}
