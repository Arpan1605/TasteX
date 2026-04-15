namespace HotelRoomOrdering.Api.Services;

public interface IOtpDeliveryService
{
    bool IsConfigured { get; }
    Task<OtpDeliveryResult> SendOtpAsync(string mobileNumber, string otpCode, DateTime expiresAtUtc, CancellationToken cancellationToken = default);
}
