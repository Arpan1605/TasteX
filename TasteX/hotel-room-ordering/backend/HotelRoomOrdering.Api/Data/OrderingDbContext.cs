using HotelRoomOrdering.Api.Contracts.Enums;
using HotelRoomOrdering.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace HotelRoomOrdering.Api.Data;

public sealed class OrderingDbContext(DbContextOptions<OrderingDbContext> options) : DbContext(options)
{
    public DbSet<City> Cities => Set<City>();
    public DbSet<Kitchen> Kitchens => Set<Kitchen>();
    public DbSet<Hotel> Hotels => Set<Hotel>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Item> Items => Set<Item>();
    public DbSet<HotelMenuItem> HotelMenuItems => Set<HotelMenuItem>();
    public DbSet<KitchenItemAvailability> KitchenItemAvailability => Set<KitchenItemAvailability>();
    public DbSet<OtpSession> OtpSessions => Set<OtpSession>();
    public DbSet<GuestSession> GuestSessions => Set<GuestSession>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderLine> OrderLines => Set<OrderLine>();
    public DbSet<OrderStatusHistory> OrderStatusHistory => Set<OrderStatusHistory>();
    public DbSet<PaymentOrder> PaymentOrders => Set<PaymentOrder>();
    public DbSet<PaymentTransaction> PaymentTransactions => Set<PaymentTransaction>();
    public DbSet<WebhookLog> WebhookLogs => Set<WebhookLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<City>(entity =>
        {
            entity.ToTable("Cities", "dbo");
            entity.HasKey(x => x.CityId);
            entity.HasIndex(x => x.CityCode).IsUnique();
            entity.Property(x => x.CityCode).HasMaxLength(32);
            entity.Property(x => x.Name).HasMaxLength(120);
            entity.Property(x => x.StateName).HasMaxLength(120);
        });

        modelBuilder.Entity<Kitchen>(entity =>
        {
            entity.ToTable("Kitchens", "dbo");
            entity.HasKey(x => x.KitchenId);
            entity.HasIndex(x => x.KitchenCode).IsUnique();
            entity.HasIndex(x => x.LoginUsername).IsUnique();
            entity.Property(x => x.KitchenCode).HasMaxLength(32);
            entity.Property(x => x.Name).HasMaxLength(160);
            entity.Property(x => x.AddressLine).HasMaxLength(300);
            entity.Property(x => x.ContactPhone).HasMaxLength(20);
            entity.Property(x => x.ManagerName).HasMaxLength(120);
            entity.Property(x => x.LoginUsername).HasMaxLength(80);
            entity.Property(x => x.PasswordHash).HasMaxLength(512);
            entity.HasOne(x => x.City).WithMany(x => x.Kitchens).HasForeignKey(x => x.CityId);
        });

        modelBuilder.Entity<Hotel>(entity =>
        {
            entity.ToTable("Hotels", "dbo");
            entity.HasKey(x => x.HotelId);
            entity.HasIndex(x => x.HotelCode).IsUnique();
            entity.Property(x => x.HotelCode).HasMaxLength(32);
            entity.Property(x => x.Name).HasMaxLength(180);
            entity.Property(x => x.AddressLine).HasMaxLength(300);
            entity.Property(x => x.RoomCount).HasDefaultValue(0);
            entity.HasOne(x => x.City).WithMany(x => x.Hotels).HasForeignKey(x => x.CityId);
            entity.HasOne(x => x.Kitchen).WithMany(x => x.Hotels).HasForeignKey(x => x.KitchenId);
        });

        modelBuilder.Entity<Category>(entity =>
        {
            entity.ToTable("Categories", "dbo");
            entity.HasKey(x => x.CategoryId);
            entity.HasIndex(x => x.CategoryCode).IsUnique();
            entity.Property(x => x.CategoryCode).HasMaxLength(32);
            entity.Property(x => x.Name).HasMaxLength(120);
        });

        modelBuilder.Entity<Item>(entity =>
        {
            entity.ToTable("Items", "dbo");
            entity.HasKey(x => x.ItemId);
            entity.HasIndex(x => x.ItemCode).IsUnique();
            entity.Property(x => x.ItemCode).HasMaxLength(32);
            entity.Property(x => x.Name).HasMaxLength(180);
            entity.Property(x => x.Description).HasMaxLength(600);
            entity.Property(x => x.BasePrice).HasPrecision(12, 2);
            entity.HasOne(x => x.Category).WithMany(x => x.Items).HasForeignKey(x => x.CategoryId);
        });

        modelBuilder.Entity<HotelMenuItem>(entity =>
        {
            entity.ToTable("HotelMenuItems", "dbo");
            entity.HasKey(x => x.HotelMenuItemId);
            entity.HasIndex(x => new { x.HotelId, x.ItemId }).IsUnique();
            entity.Property(x => x.InventoryQuantity).HasDefaultValue(0);
            entity.Property(x => x.ImageUrl).HasMaxLength(600);
            entity.HasOne(x => x.Hotel).WithMany(x => x.MenuItems).HasForeignKey(x => x.HotelId);
            entity.HasOne(x => x.Item).WithMany(x => x.HotelMenuItems).HasForeignKey(x => x.ItemId);
        });

        modelBuilder.Entity<KitchenItemAvailability>(entity =>
        {
            entity.ToTable("KitchenItemAvailability", "dbo");
            entity.HasKey(x => x.KitchenItemAvailabilityId);
            entity.HasIndex(x => new { x.KitchenId, x.ItemId }).IsUnique();
            entity.Property(x => x.EffectivePrice).HasPrecision(12, 2);
            entity.Property(x => x.UpdatedBy).HasMaxLength(120);
            entity.HasOne(x => x.Kitchen).WithMany().HasForeignKey(x => x.KitchenId);
            entity.HasOne(x => x.Item).WithMany().HasForeignKey(x => x.ItemId);
        });

        modelBuilder.Entity<OtpSession>(entity =>
        {
            entity.ToTable("OtpSessions", "dbo");
            entity.HasKey(x => x.OtpSessionId);
            entity.Property(x => x.MobileNumber).HasMaxLength(20);
            entity.Property(x => x.OtpHash).HasMaxLength(256);
            entity.Property(x => x.OtpPurpose).HasConversion<byte>();
            entity.HasOne(x => x.Hotel).WithMany().HasForeignKey(x => x.HotelId);
        });

        modelBuilder.Entity<GuestSession>(entity =>
        {
            entity.ToTable("GuestSessions", "dbo");
            entity.HasKey(x => x.GuestSessionId);
            entity.Property(x => x.MobileNumber).HasMaxLength(20);
            entity.Property(x => x.SessionTokenHash).HasMaxLength(256);
            entity.HasOne(x => x.OtpSession).WithMany().HasForeignKey(x => x.OtpSessionId);
            entity.HasOne(x => x.Hotel).WithMany().HasForeignKey(x => x.HotelId);
        });

        modelBuilder.Entity<Order>(entity =>
        {
            entity.ToTable("Orders", "dbo");
            entity.HasKey(x => x.OrderId);
            entity.HasIndex(x => x.OrderNumber).IsUnique();
            entity.Property(x => x.OrderNumber).HasMaxLength(40);
            entity.Property(x => x.MobileNumber).HasMaxLength(20);
            entity.Property(x => x.CurrencyCode).HasMaxLength(3).IsFixedLength();
            entity.Property(x => x.SubTotalAmount).HasPrecision(12, 2);
            entity.Property(x => x.TaxAmount).HasPrecision(12, 2);
            entity.Property(x => x.DiscountAmount).HasPrecision(12, 2);
            entity.Property(x => x.TotalAmount).HasPrecision(12, 2);
            entity.Property(x => x.PaymentMethod).HasConversion<byte>();
            entity.Property(x => x.PaymentStatus).HasConversion<byte>();
            entity.Property(x => x.OrderStatus).HasConversion<byte>();
            entity.Property(x => x.GuestNotes).HasMaxLength(600);
            entity.HasOne(x => x.GuestSession).WithMany().HasForeignKey(x => x.GuestSessionId);
            entity.HasOne(x => x.Hotel).WithMany().HasForeignKey(x => x.HotelId);
            entity.HasOne(x => x.Kitchen).WithMany().HasForeignKey(x => x.KitchenId);
        });

        modelBuilder.Entity<OrderLine>(entity =>
        {
            entity.ToTable("OrderLines", "dbo");
            entity.HasKey(x => x.OrderLineId);
            entity.Property(x => x.ItemSnapshotName).HasMaxLength(180);
            entity.Property(x => x.UnitPrice).HasPrecision(12, 2);
            entity.Property(x => x.LineTotal).HasPrecision(12, 2);
            entity.HasOne(x => x.Order).WithMany(x => x.Lines).HasForeignKey(x => x.OrderId);
            entity.HasOne(x => x.Item).WithMany().HasForeignKey(x => x.ItemId);
        });

        modelBuilder.Entity<OrderStatusHistory>(entity =>
        {
            entity.ToTable("OrderStatusHistory", "dbo");
            entity.HasKey(x => x.OrderStatusHistoryId);
            entity.Property(x => x.PreviousStatus).HasConversion<byte?>();
            entity.Property(x => x.NewStatus).HasConversion<byte>();
            entity.Property(x => x.ChangedBy).HasMaxLength(120);
            entity.Property(x => x.Notes).HasMaxLength(600);
            entity.HasOne(x => x.Order).WithMany().HasForeignKey(x => x.OrderId);
        });

        modelBuilder.Entity<PaymentOrder>(entity =>
        {
            entity.ToTable("PaymentOrders", "dbo");
            entity.HasKey(x => x.PaymentOrderId);
            entity.HasIndex(x => x.GatewayOrderId).IsUnique();
            entity.Property(x => x.GatewayProvider).HasConversion<byte>();
            entity.Property(x => x.GatewayOrderId).HasMaxLength(100);
            entity.Property(x => x.Amount).HasPrecision(12, 2);
            entity.Property(x => x.CurrencyCode).HasMaxLength(3).IsFixedLength();
            entity.Property(x => x.Status).HasConversion<byte>();
            entity.Property(x => x.CheckoutUrl).HasMaxLength(600);
            entity.HasOne(x => x.Order).WithMany().HasForeignKey(x => x.OrderId);
        });

        modelBuilder.Entity<PaymentTransaction>(entity =>
        {
            entity.ToTable("PaymentTransactions", "dbo");
            entity.HasKey(x => x.PaymentTransactionId);
            entity.HasIndex(x => x.GatewayPaymentId).IsUnique();
            entity.Property(x => x.GatewayPaymentId).HasMaxLength(120);
            entity.Property(x => x.Signature).HasMaxLength(300);
            entity.Property(x => x.TransactionStatus).HasConversion<byte>();
            entity.Property(x => x.Amount).HasPrecision(12, 2);
            entity.Property(x => x.CurrencyCode).HasMaxLength(3).IsFixedLength();
            entity.HasOne(x => x.PaymentOrder).WithMany().HasForeignKey(x => x.PaymentOrderId);
        });

        modelBuilder.Entity<WebhookLog>(entity =>
        {
            entity.ToTable("WebhookLogs", "dbo");
            entity.HasKey(x => x.WebhookLogId);
            entity.HasIndex(x => new { x.GatewayProvider, x.EventId }).IsUnique();
            entity.Property(x => x.GatewayProvider).HasConversion<byte>();
            entity.Property(x => x.EventId).HasMaxLength(120);
            entity.Property(x => x.EventType).HasMaxLength(100);
            entity.Property(x => x.Signature).HasMaxLength(300);
            entity.Property(x => x.ProcessingStatus).HasMaxLength(20);
            entity.Property(x => x.ErrorMessage).HasMaxLength(1000);
        });
    }
}
