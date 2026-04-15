namespace HotelRoomOrdering.Api.Services;

public sealed class OtpDeliveryOptions
{
    public bool Enabled { get; set; }
    public string Provider { get; set; } = "MSG91";
    public string DefaultCountryCode { get; set; } = "+91";
    public Msg91OtpOptions Msg91 { get; set; } = new();
}

public sealed class Msg91OtpOptions
{
    public string AuthKey { get; set; } = string.Empty;
    public string TemplateId { get; set; } = string.Empty;
    public string BaseUrl { get; set; } = "https://control.msg91.com";
}

public sealed record OtpDeliveryResult(bool Success, string? ErrorMessage = null);
