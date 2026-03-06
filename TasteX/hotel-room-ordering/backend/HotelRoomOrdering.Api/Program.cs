using HotelRoomOrdering.Api.Contracts.Contracts;
using HotelRoomOrdering.Api.Data;
using HotelRoomOrdering.Api.Services;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddDbContext<OrderingDbContext>(options =>
{
    var connectionString = builder.Configuration.GetConnectionString("OrderingDb")
        ?? throw new InvalidOperationException("Connection string 'OrderingDb' was not found.");

    options.UseSqlServer(connectionString);
});

builder.Services.AddScoped<IClock, SystemClock>();
builder.Services.AddScoped<IHashService, Sha256HashService>();
builder.Services.AddScoped<IGuestOrderingContract, GuestOrderingService>();
builder.Services.AddScoped<IKitchenDashboardContract, KitchenDashboardService>();
builder.Services.AddScoped<IPaymentContract, PaymentService>();
builder.Services.AddScoped<IWebhookContract, WebhookService>();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.MapControllers();
app.Run();
