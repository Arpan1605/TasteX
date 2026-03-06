using HotelRoomOrdering.Api.Contracts.Common;
using HotelRoomOrdering.Api.Contracts.Contracts;
using HotelRoomOrdering.Api.Contracts.Payments;

namespace HotelRoomOrdering.Api.Services;

public sealed class PaymentService : IPaymentContract
{
    public Task<ApiResponse<CreatePaymentOrderResponse>> CreatePaymentOrderAsync(CreatePaymentOrderRequest request, CancellationToken cancellationToken = default)
    {
        var response = new ApiResponse<CreatePaymentOrderResponse>(
            false,
            null,
            new ApiError("PAYMENT_GATEWAY_DISABLED", "Online payment gateway is disabled in current phase. Use COD."));

        return Task.FromResult(response);
    }

    public Task<ApiResponse<VerifyPaymentResponse>> VerifyPaymentAsync(VerifyPaymentRequest request, CancellationToken cancellationToken = default)
    {
        var response = new ApiResponse<VerifyPaymentResponse>(
            false,
            null,
            new ApiError("PAYMENT_GATEWAY_DISABLED", "Online payment gateway is disabled in current phase. Use COD."));

        return Task.FromResult(response);
    }
}
