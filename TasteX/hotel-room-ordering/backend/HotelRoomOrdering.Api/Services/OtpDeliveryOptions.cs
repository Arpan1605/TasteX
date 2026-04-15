namespace HotelRoomOrdering.Api.Services;

public sealed class OtpDeliveryOptions
{
    public bool Enabled { get; set; }
    public string Provider { get; set; } = "Twilio";
    public string DefaultCountryCode { get; set; } = "+91";
    public TwilioOtpOptions Twilio { get; set; } = new();
}

public sealed class TwilioOtpOptions
{
    public string AccountSid { get; set; } = string.Empty;
    public string AuthToken { get; set; } = string.Empty;
    public string MessagingServiceSid { get; set; } = string.Empty;
    public string FromNumber { get; set; } = string.Empty;
}

public sealed record OtpDeliveryResult(bool Success, string? ErrorMessage = null);
