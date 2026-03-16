using HotelRoomOrdering.Api.Contracts.Common;
using HotelRoomOrdering.Api.Contracts.Contracts;
using HotelRoomOrdering.Api.Contracts.Enums;
using HotelRoomOrdering.Api.Contracts.Kitchen;
using Microsoft.AspNetCore.Mvc;
using System.Text.Json;

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
    public async Task<IActionResult> UpdateStatus([FromRoute] long orderId, [FromBody] JsonElement body, CancellationToken cancellationToken)
    {
        if (!TryParseStatus(body, out var newStatus))
        {
            return BadRequest(new ApiResponse<UpdateOrderStatusResponse>(false, null, new ApiError("STATUS_INVALID", "Invalid or missing 'newStatus'.")));
        }

        var updatedBy = body.TryGetProperty("updatedBy", out var updatedByNode) && updatedByNode.ValueKind == JsonValueKind.String
            ? updatedByNode.GetString()
            : null;

        var notes = body.TryGetProperty("notes", out var notesNode) && notesNode.ValueKind == JsonValueKind.String
            ? notesNode.GetString()
            : null;

        var request = new UpdateOrderStatusRequest(
            orderId,
            newStatus,
            string.IsNullOrWhiteSpace(updatedBy) ? "Kitchen Dashboard" : updatedBy.Trim(),
            string.IsNullOrWhiteSpace(notes) ? null : notes.Trim());

        return ToActionResult(await service.UpdateOrderStatusAsync(request, cancellationToken));
    }

    private static bool TryParseStatus(JsonElement body, out OrderStatus status)
    {
        status = default;
        if (!body.TryGetProperty("newStatus", out var node))
        {
            return false;
        }

        if (node.ValueKind == JsonValueKind.Number && node.TryGetInt32(out var number))
        {
            if (Enum.IsDefined(typeof(OrderStatus), number))
            {
                status = (OrderStatus)number;
                return true;
            }
            return false;
        }

        if (node.ValueKind == JsonValueKind.String)
        {
            var raw = node.GetString();
            if (string.IsNullOrWhiteSpace(raw))
            {
                return false;
            }

            if (int.TryParse(raw, out var asNumber) && Enum.IsDefined(typeof(OrderStatus), asNumber))
            {
                status = (OrderStatus)asNumber;
                return true;
            }

            if (Enum.TryParse<OrderStatus>(raw.Trim(), true, out var parsed))
            {
                status = parsed;
                return true;
            }
        }

        return false;
    }
}
