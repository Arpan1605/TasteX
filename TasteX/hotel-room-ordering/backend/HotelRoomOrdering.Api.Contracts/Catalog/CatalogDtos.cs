namespace HotelRoomOrdering.Api.Contracts.Catalog;

public sealed record CityDto(
    long CityId,
    string CityCode,
    string Name,
    bool IsActive);

public sealed record KitchenDto(
    long KitchenId,
    long CityId,
    string KitchenCode,
    string Name,
    string? ContactPhone,
    bool IsActive);

public sealed record HotelDto(
    long HotelId,
    long CityId,
    long KitchenId,
    string HotelCode,
    string Name,
    string? AddressLine,
    bool IsActive);

public sealed record CategoryDto(
    long CategoryId,
    string CategoryCode,
    string Name,
    int SortOrder,
    bool IsActive);

public sealed record ItemDto(
    long ItemId,
    string ItemCode,
    long CategoryId,
    string Name,
    string? Description,
    decimal BasePrice,
    bool IsVeg,
    bool IsActive);

public sealed record MenuItemDto(
    long ItemId,
    string ItemCode,
    string Name,
    string? Description,
    decimal Price,
    bool IsVeg,
    bool IsAvailable);

public sealed record MenuCategoryDto(
    long CategoryId,
    string CategoryName,
    int SortOrder,
    IReadOnlyList<MenuItemDto> Items);

public sealed record HotelMenuResponse(
    long HotelId,
    string HotelCode,
    string HotelName,
    long CityId,
    string CityName,
    long KitchenId,
    string KitchenName,
    IReadOnlyList<MenuCategoryDto> Categories);
