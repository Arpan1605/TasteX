using HotelRoomOrdering.Api.Contracts.Common;
using HotelRoomOrdering.Api.Contracts.Kitchen;

namespace HotelRoomOrdering.Api.Contracts.Contracts;

public interface IKitchenDashboardContract
{
    Task<ApiResponse<KitchenLoginResponse>> LoginAsync(KitchenLoginRequest request, CancellationToken cancellationToken = default);

    Task<ApiResponse<KitchenOrdersResponse>> GetPaidOrdersAsync(KitchenOrdersQuery query, CancellationToken cancellationToken = default);

    Task<ApiResponse<UpdateOrderStatusResponse>> UpdateOrderStatusAsync(UpdateOrderStatusRequest request, CancellationToken cancellationToken = default);

    Task<ApiResponse<UpdatePaymentStatusResponse>> UpdatePaymentStatusAsync(UpdatePaymentStatusRequest request, CancellationToken cancellationToken = default);
}



