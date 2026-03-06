using HotelRoomOrdering.Api.Contracts.Catalog;
using HotelRoomOrdering.Api.Contracts.Common;
using HotelRoomOrdering.Api.Contracts.Guest;

namespace HotelRoomOrdering.Api.Contracts.Contracts;

public interface IGuestOrderingContract
{
    Task<ApiResponse<HotelMenuResponse>> GetHotelMenuAsync(string hotelCode, CancellationToken cancellationToken = default);

    Task<ApiResponse<SendOtpResponse>> SendOtpAsync(SendOtpRequest request, CancellationToken cancellationToken = default);

    Task<ApiResponse<VerifyOtpResponse>> VerifyOtpAsync(VerifyOtpRequest request, CancellationToken cancellationToken = default);

    Task<ApiResponse<CheckoutResponse>> CheckoutAsync(CheckoutRequest request, CancellationToken cancellationToken = default);

    Task<ApiResponse<OrderStatusResponse>> GetOrderStatusAsync(string orderNumber, CancellationToken cancellationToken = default);
}
