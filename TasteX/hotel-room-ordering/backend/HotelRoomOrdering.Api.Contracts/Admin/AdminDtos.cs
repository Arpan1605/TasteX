namespace HotelRoomOrdering.Api.Contracts.Admin;

public sealed record AdminCityDto(
    long CityId,
    string Name,
    string? StateName,
    bool IsActive,
    int KitchensCount,
    int HotelsCount,
    decimal Revenue);

public sealed record UpsertCityRequest(
    string Name,
    string? StateName,
    bool IsActive);

public sealed record AdminKitchenDto(
    long KitchenId,
    long CityId,
    string CityName,
    string Name,
    string? AddressLine,
    string? ContactPhone,
    string? ManagerName,
    string LoginUsername,
    bool HasPasswordConfigured,
    bool IsActive,
    int HotelsCount,
    int OrdersCount,
    decimal Revenue);

public sealed record UpsertKitchenRequest(
    long CityId,
    string Name,
    string? AddressLine,
    string? ContactPhone,
    string? ManagerName,
    string LoginUsername,
    string? LoginPassword,
    bool IsActive);

public sealed record AdminHotelDto(
    long HotelId,
    long CityId,
    string CityName,
    long KitchenId,
    string KitchenName,
    string HotelCode,
    string Name,
    string? AddressLine,
    int RoomCount,
    bool IsActive,
    int OrdersCount,
    decimal Revenue,
    string QrCodeUrl);

public sealed record UpsertHotelRequest(
    long CityId,
    long KitchenId,
    string Name,
    string? AddressLine,
    int RoomCount,
    bool IsActive);

public sealed record AdminMenuItemDto(
    long ItemId,
    long CategoryId,
    string Name,
    string? Description,
    decimal Price,
    bool IsVeg,
    bool IsActive,
    int? PrepTimeMinutes,
    string? ImageUrl,
    int? InventoryQuantity,
    IReadOnlyList<long> AvailableKitchenIds);

public sealed record AdminMenuCategoryDto(
    long CategoryId,
    string CategoryName,
    int SortOrder,
    IReadOnlyList<AdminMenuItemDto> Items);

public sealed record CreateMenuItemRequest(
    long CategoryId,
    string Name,
    string? Description,
    decimal Price,
    bool IsVeg,
    bool IsActive,
    int? PrepTimeMinutes,
    string? ImageUrl,
    IReadOnlyList<long> AvailableKitchenIds);

public sealed record UpdateMenuItemStatusRequest(
    bool IsActive);

public sealed record UpsertCategoryRequest(
    string Name,
    int SortOrder,
    bool IsActive);

public sealed record UpsertHotelMenuItemRequest(
    long CategoryId,
    string Name,
    string? Description,
    decimal Price,
    bool IsVeg,
    bool IsActive,
    int? PrepTimeMinutes,
    string? ImageUrl,
    int InventoryQuantity);

public sealed record UpdateHotelMenuItemStatusRequest(
    bool IsActive);

public sealed record UpdateHotelMenuInventoryRequest(
    int InventoryQuantity);