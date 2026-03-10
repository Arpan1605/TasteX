using HotelRoomOrdering.Api.Contracts.Common;
using Microsoft.AspNetCore.Mvc;

namespace HotelRoomOrdering.Api.Controllers;

[ApiController]
public abstract class ApiControllerBase : ControllerBase
{
    protected IActionResult ToActionResult<T>(ApiResponse<T> response)
    {
        if (response.Success)
        {
            return Ok(response);
        }

        var code = response.Error?.Code ?? string.Empty;
        if (code.Contains("NOT_FOUND", StringComparison.OrdinalIgnoreCase))
        {
            return NotFound(response);
        }

        if (code.Contains("LOGIN_", StringComparison.OrdinalIgnoreCase) || code.Contains("AUTH_", StringComparison.OrdinalIgnoreCase))
        {
            return Unauthorized(response);
        }

        if (code.Contains("INVALID", StringComparison.OrdinalIgnoreCase) || code.Contains("EXPIRED", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(response);
        }

        return UnprocessableEntity(response);
    }
}
