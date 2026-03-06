using HotelRoomOrdering.Api.Contracts.Common;
using HotelRoomOrdering.Api.Contracts.Payments;

namespace HotelRoomOrdering.Api.Contracts.Contracts;

public interface IPaymentContract
{
    Task<ApiResponse<CreatePaymentOrderResponse>> CreatePaymentOrderAsync(CreatePaymentOrderRequest request, CancellationToken cancellationToken = default);

    Task<ApiResponse<VerifyPaymentResponse>> VerifyPaymentAsync(VerifyPaymentRequest request, CancellationToken cancellationToken = default);
}
