using HotelRoomOrdering.Api.Contracts.Admin;
using HotelRoomOrdering.Api.Contracts.Common;

namespace HotelRoomOrdering.Api.Contracts.Contracts;

public interface IAdminManagementContract
{
    Task<ApiResponse<IReadOnlyList<AdminCityDto>>> GetCitiesAsync(CancellationToken cancellationToken = default);
    Task<ApiResponse<AdminCityDto>> CreateCityAsync(UpsertCityRequest request, CancellationToken cancellationToken = default);
    Task<ApiResponse<AdminCityDto>> UpdateCityAsync(long cityId, UpsertCityRequest request, CancellationToken cancellationToken = default);

    Task<ApiResponse<IReadOnlyList<AdminKitchenDto>>> GetKitchensAsync(CancellationToken cancellationToken = default);
    Task<ApiResponse<AdminKitchenDto>> CreateKitchenAsync(UpsertKitchenRequest request, CancellationToken cancellationToken = default);
    Task<ApiResponse<AdminKitchenDto>> UpdateKitchenAsync(long kitchenId, UpsertKitchenRequest request, CancellationToken cancellationToken = default);

    Task<ApiResponse<IReadOnlyList<AdminHotelDto>>> GetHotelsAsync(CancellationToken cancellationToken = default);
    Task<ApiResponse<AdminHotelDto>> CreateHotelAsync(UpsertHotelRequest request, CancellationToken cancellationToken = default);
    Task<ApiResponse<AdminHotelDto>> UpdateHotelAsync(long hotelId, UpsertHotelRequest request, CancellationToken cancellationToken = default);

    Task<ApiResponse<IReadOnlyList<AdminMenuCategoryDto>>> GetMenuAsync(CancellationToken cancellationToken = default);
    Task<ApiResponse<AdminMenuItemDto>> CreateMenuItemAsync(CreateMenuItemRequest request, CancellationToken cancellationToken = default);
    Task<ApiResponse<AdminMenuItemDto>> UpdateMenuItemStatusAsync(long itemId, UpdateMenuItemStatusRequest request, CancellationToken cancellationToken = default);

    Task<ApiResponse<AdminMenuCategoryDto>> CreateCategoryAsync(UpsertCategoryRequest request, CancellationToken cancellationToken = default);
    Task<ApiResponse<AdminMenuCategoryDto>> UpdateCategoryAsync(long categoryId, UpsertCategoryRequest request, CancellationToken cancellationToken = default);
    Task<ApiResponse<bool>> DeleteCategoryAsync(long categoryId, CancellationToken cancellationToken = default);

    Task<ApiResponse<IReadOnlyList<AdminMenuCategoryDto>>> GetHotelMenuAsync(long hotelId, CancellationToken cancellationToken = default);
    Task<ApiResponse<AdminMenuItemDto>> CreateHotelMenuItemAsync(long hotelId, UpsertHotelMenuItemRequest request, CancellationToken cancellationToken = default);
    Task<ApiResponse<AdminMenuItemDto>> UpdateHotelMenuItemAsync(long hotelId, long itemId, UpsertHotelMenuItemRequest request, CancellationToken cancellationToken = default);
    Task<ApiResponse<AdminMenuItemDto>> UpdateHotelMenuItemStatusAsync(long hotelId, long itemId, UpdateHotelMenuItemStatusRequest request, CancellationToken cancellationToken = default);
    Task<ApiResponse<AdminMenuItemDto>> UpdateHotelMenuInventoryAsync(long hotelId, long itemId, UpdateHotelMenuInventoryRequest request, CancellationToken cancellationToken = default);
    Task<ApiResponse<bool>> DeleteHotelMenuItemAsync(long hotelId, long itemId, CancellationToken cancellationToken = default);
}