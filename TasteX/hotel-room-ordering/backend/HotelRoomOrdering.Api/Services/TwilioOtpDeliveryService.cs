using System.Net.Http.Headers;
using System.Text;
using Microsoft.Extensions.Options;

namespace HotelRoomOrdering.Api.Services;

public sealed class TwilioOtpDeliveryService(
    HttpClient httpClient,
    IOptions<OtpDeliveryOptions> optionsAccessor,
    ILogger<TwilioOtpDeliveryService> logger) : IOtpDeliveryService
{
    private readonly OtpDeliveryOptions options = optionsAccessor.Value;

    public bool IsConfigured =>
        options.Enabled &&
        string.Equals(options.Provider, "Twilio", StringComparison.OrdinalIgnoreCase) &&
        !string.IsNullOrWhiteSpace(options.Twilio.AccountSid) &&
        !string.IsNullOrWhiteSpace(options.Twilio.AuthToken) &&
        (!string.IsNullOrWhiteSpace(options.Twilio.MessagingServiceSid) ||
         !string.IsNullOrWhiteSpace(options.Twilio.FromNumber));

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

        var toNumber = NormalizeMobileNumber(mobileNumber, options.DefaultCountryCode);
        if (string.IsNullOrWhiteSpace(toNumber))
        {
            return new OtpDeliveryResult(false, "Mobile number is invalid for SMS delivery.");
        }

        using var request = new HttpRequestMessage(
            HttpMethod.Post,
            $"https://api.twilio.com/2010-04-01/Accounts/{options.Twilio.AccountSid}/Messages.json");

        var basicAuthValue = Convert.ToBase64String(Encoding.ASCII.GetBytes($"{options.Twilio.AccountSid}:{options.Twilio.AuthToken}"));
        request.Headers.Authorization = new AuthenticationHeaderValue("Basic", basicAuthValue);

        var fields = new List<KeyValuePair<string, string>>
        {
            new("To", toNumber),
            new("Body", $"TasteX OTP: {otpCode}. Valid for 5 minutes.")
        };

        if (!string.IsNullOrWhiteSpace(options.Twilio.MessagingServiceSid))
        {
            fields.Add(new("MessagingServiceSid", options.Twilio.MessagingServiceSid));
        }
        else
        {
            fields.Add(new("From", options.Twilio.FromNumber));
        }

        request.Content = new FormUrlEncodedContent(fields);

        using var response = await httpClient.SendAsync(request, cancellationToken);
        if (response.IsSuccessStatusCode)
        {
            return new OtpDeliveryResult(true);
        }

        var errorBody = await response.Content.ReadAsStringAsync(cancellationToken);
        logger.LogWarning(
            "Twilio OTP send failed. StatusCode: {StatusCode}. Response: {Response}",
            (int)response.StatusCode,
            errorBody);

        return new OtpDeliveryResult(false, "Unable to send OTP SMS right now.");
    }

    private static string NormalizeMobileNumber(string mobileNumber, string defaultCountryCode)
    {
        var trimmed = mobileNumber.Trim();
        if (string.IsNullOrWhiteSpace(trimmed))
        {
            return string.Empty;
        }

        if (trimmed.StartsWith("+", StringComparison.Ordinal))
        {
            var digitsWithPlus = "+" + new string(trimmed.Skip(1).Where(char.IsDigit).ToArray());
            return digitsWithPlus.Length > 1 ? digitsWithPlus : string.Empty;
        }

        var digits = new string(trimmed.Where(char.IsDigit).ToArray());
        if (string.IsNullOrWhiteSpace(digits))
        {
            return string.Empty;
        }

        var countryCode = defaultCountryCode.Trim();
        if (string.IsNullOrWhiteSpace(countryCode))
        {
            countryCode = "+";
        }
        else if (!countryCode.StartsWith("+", StringComparison.Ordinal))
        {
            countryCode = "+" + new string(countryCode.Where(char.IsDigit).ToArray());
        }

        return countryCode + digits;
    }
}
