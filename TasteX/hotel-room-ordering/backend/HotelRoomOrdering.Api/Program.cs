using HotelRoomOrdering.Api.Contracts.Contracts;
using HotelRoomOrdering.Api.Data;
using HotelRoomOrdering.Api.Services;
using Microsoft.EntityFrameworkCore;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.Configure<OtpDeliveryOptions>(builder.Configuration.GetSection("OtpDelivery"));
builder.Services.AddHttpClient<IOtpDeliveryService, TwilioOtpDeliveryService>();

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? Array.Empty<string>();
builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        if (allowedOrigins.Length == 0)
        {
            return;
        }

        policy.WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

builder.Services.AddDbContext<OrderingDbContext>(options =>
{
    var connectionString = builder.Configuration.GetConnectionString("OrderingDb")
        ?? throw new InvalidOperationException("Connection string 'OrderingDb' was not found.");

    options.UseNpgsql(NormalizePostgresConnectionString(connectionString));
});

builder.Services.AddScoped<IClock, SystemClock>();
builder.Services.AddScoped<IHashService, Sha256HashService>();
builder.Services.AddScoped<IPasswordHashService, Pbkdf2PasswordHashService>();
builder.Services.AddScoped<IGuestOrderingContract, GuestOrderingService>();
builder.Services.AddScoped<IKitchenDashboardContract, KitchenDashboardService>();
builder.Services.AddScoped<IPaymentContract, PaymentService>();
builder.Services.AddScoped<IWebhookContract, WebhookService>();
builder.Services.AddScoped<IAdminManagementContract, AdminManagementService>();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<OrderingDbContext>();
    db.Database.Migrate();
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

if (allowedOrigins.Length > 0)
{
    app.UseCors("Frontend");
}

app.MapControllers();
app.Run();

static string NormalizePostgresConnectionString(string connectionString)
{
    connectionString = connectionString.Trim();

    if ((connectionString.StartsWith("\"") && connectionString.EndsWith("\"")) ||
        (connectionString.StartsWith("'") && connectionString.EndsWith("'")))
    {
        connectionString = connectionString[1..^1].Trim();
    }

    var postgresUrlIndex = connectionString.IndexOf("postgres://", StringComparison.OrdinalIgnoreCase);
    if (postgresUrlIndex < 0)
    {
        postgresUrlIndex = connectionString.IndexOf("postgresql://", StringComparison.OrdinalIgnoreCase);
    }

    if (postgresUrlIndex > 0)
    {
        connectionString = connectionString[postgresUrlIndex..].Trim();
    }

    if (!connectionString.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase) &&
        !connectionString.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
    {
        return connectionString;
    }

    var uri = new Uri(connectionString);
    var userInfo = uri.UserInfo.Split(':', 2);
    if (userInfo.Length != 2)
    {
        throw new InvalidOperationException("PostgreSQL connection URL is missing username or password.");
    }

    var builder = new NpgsqlConnectionStringBuilder
    {
        Host = uri.Host,
        Port = uri.Port > 0 ? uri.Port : 5432,
        Database = uri.AbsolutePath.Trim('/'),
        Username = Uri.UnescapeDataString(userInfo[0]),
        Password = Uri.UnescapeDataString(userInfo[1]),
        SslMode = SslMode.Require,
        TrustServerCertificate = true
    };

    return builder.ConnectionString;
}

