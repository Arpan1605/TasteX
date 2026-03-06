namespace HotelRoomOrdering.Api.Contracts.Common;

public sealed record ApiError(
    string Code,
    string Message,
    IReadOnlyDictionary<string, string[]>? ValidationErrors = null);

public sealed record ApiResponse<T>(
    bool Success,
    T? Data,
    ApiError? Error);
