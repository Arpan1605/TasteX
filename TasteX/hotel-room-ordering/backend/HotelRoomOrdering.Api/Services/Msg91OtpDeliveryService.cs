using Microsoft.Extensions.Options;

namespace HotelRoomOrdering.Api.Services;

public sealed class Msg91OtpDeliveryService(
    HttpClient httpClient,
    IOptions<OtpDeliveryOptions> optionsAccessor,
    ILogger<Msg91OtpDeliveryService> logger) : IOtpDeliveryService
{
    private readonly OtpDeliveryOptions options = optionsAccessor.Value;

    public bool IsConfigured =>
        options.Enabled &&
        string.Equals(options.Provider, "MSG91", StringComparison.OrdinalIgnoreCase) &&
        !string.IsNullOrWhiteSpace(options.Msg91.AuthKey) &&
        !string.IsNullOrWhiteSpace(options.Msg91.TemplateId);

    public async Task<OtpDeliveryResult> SendOtpAsync(
        string mobileNumber,
        string otpCode,
        DateTime expiresAtUtc,
        CancellationToken cancellationToken = default)
    {
        if (!IsConfigured)
        {
            return new OtpDeliveryResult(false, "OTP SMS provider is not configured.");
        }

        var normalizedMobile = NormalizeMobileNumber(mobileNumber, options.DefaultCountryCode);
        if (string.IsNullOrWhiteSpace(normalizedMobile))
        {
            return new OtpDeliveryResult(false, "Mobile number is invalid for SMS delivery.");
        }

        var requestUri = BuildSendOtpUri(normalizedMobile, otpCode);
        using var request = new HttpRequestMessage(HttpMethod.Get, requestUri);

        using var response = await httpClient.SendAsync(request, cancellationToken);
        if (response.IsSuccessStatusCode)
        {
            return new OtpDeliveryResult(true);
        }

        var errorBody = await response.Content.ReadAsStringAsync(cancellationToken);
        logger.LogWarning(
            "MSG91 OTP send failed. StatusCode: {StatusCode}. Response: {Response}",
            (int)response.StatusCode,
            errorBody);

        return new OtpDeliveryResult(false, "Unable to send OTP SMS right now.");
    }

    private Uri BuildSendOtpUri(string normalizedMobile, string otpCode)
    {
        var baseUrl = options.Msg91.BaseUrl.TrimEnd('/');
        var builder = new UriBuilder($"{baseUrl}/api/v5/otp");
        builder.Query = string.Join("&", new[]
        {
            $"authkey={Uri.EscapeDataString(options.Msg91.AuthKey)}",
            $"template_id={Uri.EscapeDataString(options.Msg91.TemplateId)}",
            $"mobile={Uri.EscapeDataString(normalizedMobile)}",
            $"otp={Uri.EscapeDataString(otpCode)}"
        });
        return builder.Uri;
    }

    private static string NormalizeMobileNumber(string mobileNumber, string defaultCountryCode)
    {
        var trimmed = mobileNumber.Trim();
        if (string.IsNullOrWhiteSpace(trimmed))
        {
            return string.Empty;
        }

        var digits = new string(trimmed.Where(char.IsDigit).ToArray());
        if (string.IsNullOrWhiteSpace(digits))
        {
            return string.Empty;
        }

        if (trimmed.StartsWith("+", StringComparison.Ordinal))
        {
            return digits;
        }

        var countryDigits = new string(defaultCountryCode.Where(char.IsDigit).ToArray());
        if (string.IsNullOrWhiteSpace(countryDigits))
        {
            return digits;
        }

        return countryDigits + digits;
    }
}
