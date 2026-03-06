namespace HotelRoomOrdering.Api.Services;

public interface IClock
{
    DateTime UtcNow { get; }
}

public sealed class SystemClock : IClock
{
    public DateTime UtcNow => DateTime.UtcNow;
}

public interface IHashService
{
    string Hash(string value);
}

public sealed class Sha256HashService : IHashService
{
    public string Hash(string value)
    {
        using var sha = System.Security.Cryptography.SHA256.Create();
        var bytes = System.Text.Encoding.UTF8.GetBytes(value);
        var hash = sha.ComputeHash(bytes);
        return Convert.ToHexString(hash);
    }
}
