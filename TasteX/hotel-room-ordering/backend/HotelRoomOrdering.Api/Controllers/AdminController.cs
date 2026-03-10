using HotelRoomOrdering.Api.Contracts.Admin;
using HotelRoomOrdering.Api.Contracts.Contracts;
using Microsoft.AspNetCore.Mvc;

namespace HotelRoomOrdering.Api.Controllers;

[Route("api/v1/admin")]
public sealed class AdminController(IAdminManagementContract service) : ApiControllerBase
{
    [HttpGet("cities")]
    public async Task<IActionResult> GetCities(CancellationToken cancellationToken)
        => ToActionResult(await service.GetCitiesAsync(cancellationToken));

    [HttpPost("cities")]
    public async Task<IActionResult> CreateCity([FromBody] UpsertCityRequest request, CancellationToken cancellationToken)
        => ToActionResult(await service.CreateCityAsync(request, cancellationToken));

    [HttpPut("cities/{cityId:long}")]
    public async Task<IActionResult> UpdateCity([FromRoute] long cityId, [FromBody] UpsertCityRequest request, CancellationToken cancellationToken)
        => ToActionResult(await service.UpdateCityAsync(cityId, request, cancellationToken));

    [HttpGet("kitchens")]
    public async Task<IActionResult> GetKitchens(CancellationToken cancellationToken)
        => ToActionResult(await service.GetKitchensAsync(cancellationToken));

    [HttpPost("kitchens")]
    public async Task<IActionResult> CreateKitchen([FromBody] UpsertKitchenRequest request, CancellationToken cancellationToken)
        => ToActionResult(await service.CreateKitchenAsync(request, cancellationToken));

    [HttpPut("kitchens/{kitchenId:long}")]
    public async Task<IActionResult> UpdateKitchen([FromRoute] long kitchenId, [FromBody] UpsertKitchenRequest request, CancellationToken cancellationToken)
        => ToActionResult(await service.UpdateKitchenAsync(kitchenId, request, cancellationToken));

    [HttpGet("hotels")]
    public async Task<IActionResult> GetHotels(CancellationToken cancellationToken)
        => ToActionResult(await service.GetHotelsAsync(cancellationToken));

    [HttpPost("hotels")]
    public async Task<IActionResult> CreateHotel([FromBody] UpsertHotelRequest request, CancellationToken cancellationToken)
        => ToActionResult(await service.CreateHotelAsync(request, cancellationToken));

    [HttpPut("hotels/{hotelId:long}")]
    public async Task<IActionResult> UpdateHotel([FromRoute] long hotelId, [FromBody] UpsertHotelRequest request, CancellationToken cancellationToken)
        => ToActionResult(await service.UpdateHotelAsync(hotelId, request, cancellationToken));

    [HttpGet("menu")]
    public async Task<IActionResult> GetMenu(CancellationToken cancellationToken)
        => ToActionResult(await service.GetMenuAsync(cancellationToken));

    [HttpPost("menu/categories")]
    public async Task<IActionResult> CreateCategory([FromBody] UpsertCategoryRequest request, CancellationToken cancellationToken)
        => ToActionResult(await service.CreateCategoryAsync(request, cancellationToken));

    [HttpPut("menu/categories/{categoryId:long}")]
    public async Task<IActionResult> UpdateCategory([FromRoute] long categoryId, [FromBody] UpsertCategoryRequest request, CancellationToken cancellationToken)
        => ToActionResult(await service.UpdateCategoryAsync(categoryId, request, cancellationToken));

    [HttpDelete("menu/categories/{categoryId:long}")]
    public async Task<IActionResult> DeleteCategory([FromRoute] long categoryId, CancellationToken cancellationToken)
        => ToActionResult(await service.DeleteCategoryAsync(categoryId, cancellationToken));

    [HttpPost("menu/items")]
    public async Task<IActionResult> CreateMenuItem([FromBody] CreateMenuItemRequest request, CancellationToken cancellationToken)
        => ToActionResult(await service.CreateMenuItemAsync(request, cancellationToken));

    [HttpPatch("menu/items/{itemId:long}/status")]
    public async Task<IActionResult> UpdateMenuItemStatus([FromRoute] long itemId, [FromBody] UpdateMenuItemStatusRequest request, CancellationToken cancellationToken)
        => ToActionResult(await service.UpdateMenuItemStatusAsync(itemId, request, cancellationToken));

    [HttpGet("hotels/{hotelId:long}/menu")]
    public async Task<IActionResult> GetHotelMenu([FromRoute] long hotelId, CancellationToken cancellationToken)
        => ToActionResult(await service.GetHotelMenuAsync(hotelId, cancellationToken));

    [HttpPost("hotels/{hotelId:long}/menu/items")]
    public async Task<IActionResult> CreateHotelMenuItem([FromRoute] long hotelId, [FromBody] UpsertHotelMenuItemRequest request, CancellationToken cancellationToken)
        => ToActionResult(await service.CreateHotelMenuItemAsync(hotelId, request, cancellationToken));

    [HttpPut("hotels/{hotelId:long}/menu/items/{itemId:long}")]
    public async Task<IActionResult> UpdateHotelMenuItem([FromRoute] long hotelId, [FromRoute] long itemId, [FromBody] UpsertHotelMenuItemRequest request, CancellationToken cancellationToken)
        => ToActionResult(await service.UpdateHotelMenuItemAsync(hotelId, itemId, request, cancellationToken));

    [HttpPatch("hotels/{hotelId:long}/menu/items/{itemId:long}/status")]
    public async Task<IActionResult> UpdateHotelMenuItemStatus([FromRoute] long hotelId, [FromRoute] long itemId, [FromBody] UpdateHotelMenuItemStatusRequest request, CancellationToken cancellationToken)
        => ToActionResult(await service.UpdateHotelMenuItemStatusAsync(hotelId, itemId, request, cancellationToken));

    [HttpPatch("hotels/{hotelId:long}/menu/items/{itemId:long}/inventory")]
    public async Task<IActionResult> UpdateHotelMenuInventory([FromRoute] long hotelId, [FromRoute] long itemId, [FromBody] UpdateHotelMenuInventoryRequest request, CancellationToken cancellationToken)
        => ToActionResult(await service.UpdateHotelMenuInventoryAsync(hotelId, itemId, request, cancellationToken));

    [HttpDelete("hotels/{hotelId:long}/menu/items/{itemId:long}")]
    public async Task<IActionResult> DeleteHotelMenuItem([FromRoute] long hotelId, [FromRoute] long itemId, CancellationToken cancellationToken)
        => ToActionResult(await service.DeleteHotelMenuItemAsync(hotelId, itemId, cancellationToken));
}