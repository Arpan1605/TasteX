using HotelRoomOrdering.Api.Contracts.Enums;

namespace HotelRoomOrdering.Api.Domain;

public sealed class City
{
    public long CityId { get; set; }
    public string CityCode { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? StateName { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }

    public ICollection<Kitchen> Kitchens { get; set; } = new List<Kitchen>();
    public ICollection<Hotel> Hotels { get; set; } = new List<Hotel>();
}

public sealed class Kitchen
{
    public long KitchenId { get; set; }
    public long CityId { get; set; }
    public string KitchenCode { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? AddressLine { get; set; }
    public string? ContactPhone { get; set; }
    public string? ManagerName { get; set; }
    public string LoginUsername { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }

    public City City { get; set; } = null!;
    public ICollection<Hotel> Hotels { get; set; } = new List<Hotel>();
}

public sealed class Hotel
{
    public long HotelId { get; set; }
    public long CityId { get; set; }
    public long KitchenId { get; set; }
    public string HotelCode { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? AddressLine { get; set; }
    public int RoomCount { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }

    public City City { get; set; } = null!;
    public Kitchen Kitchen { get; set; } = null!;
    public ICollection<HotelMenuItem> MenuItems { get; set; } = new List<HotelMenuItem>();
}

public sealed class Category
{
    public long CategoryId { get; set; }
    public string CategoryCode { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }

    public ICollection<Item> Items { get; set; } = new List<Item>();
}

public sealed class Item
{
    public long ItemId { get; set; }
    public string ItemCode { get; set; } = string.Empty;
    public long CategoryId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal BasePrice { get; set; }
    public bool IsVeg { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }

    public Category Category { get; set; } = null!;
    public ICollection<HotelMenuItem> HotelMenuItems { get; set; } = new List<HotelMenuItem>();
}

public sealed class HotelMenuItem
{
    public long HotelMenuItemId { get; set; }
    public long HotelId { get; set; }
    public long ItemId { get; set; }
    public bool IsActive { get; set; }
    public int InventoryQuantity { get; set; }
    public int? PrepTimeMinutes { get; set; }
    public string? ImageUrl { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }

    public Hotel Hotel { get; set; } = null!;
    public Item Item { get; set; } = null!;
}

public sealed class KitchenItemAvailability
{
    public long KitchenItemAvailabilityId { get; set; }
    public long KitchenId { get; set; }
    public long ItemId { get; set; }
    public bool IsAvailable { get; set; }
    public decimal? EffectivePrice { get; set; }
    public DateTime EffectiveFromUtc { get; set; }
    public DateTime? EffectiveToUtc { get; set; }
    public string? UpdatedBy { get; set; }
    public DateTime UpdatedAtUtc { get; set; }

    public Kitchen Kitchen { get; set; } = null!;
    public Item Item { get; set; } = null!;
}

public sealed class OtpSession
{
    public Guid OtpSessionId { get; set; }
    public long HotelId { get; set; }
    public string MobileNumber { get; set; } = string.Empty;
    public string OtpHash { get; set; } = string.Empty;
    public OtpPurpose OtpPurpose { get; set; }
    public DateTime ExpiresAtUtc { get; set; }
    public DateTime? VerifiedAtUtc { get; set; }
    public int AttemptCount { get; set; }
    public int MaxAttempts { get; set; }
    public bool IsBlocked { get; set; }
    public DateTime? LastAttemptAtUtc { get; set; }
    public DateTime CreatedAtUtc { get; set; }

    public Hotel Hotel { get; set; } = null!;
}

public sealed class GuestSession
{
    public Guid GuestSessionId { get; set; }
    public Guid OtpSessionId { get; set; }
    public long HotelId { get; set; }
    public string MobileNumber { get; set; } = string.Empty;
    public string SessionTokenHash { get; set; } = string.Empty;
    public DateTime ExpiresAtUtc { get; set; }
    public bool IsRevoked { get; set; }
    public DateTime? RevokedAtUtc { get; set; }
    public DateTime CreatedAtUtc { get; set; }

    public OtpSession OtpSession { get; set; } = null!;
    public Hotel Hotel { get; set; } = null!;
}

public sealed class Order
{
    public long OrderId { get; set; }
    public string OrderNumber { get; set; } = string.Empty;
    public Guid? GuestSessionId { get; set; }
    public long HotelId { get; set; }
    public long KitchenId { get; set; }
    public string MobileNumber { get; set; } = string.Empty;
    public string CurrencyCode { get; set; } = "INR";
    public decimal SubTotalAmount { get; set; }
    public decimal TaxAmount { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal TotalAmount { get; set; }
    public PaymentMethod PaymentMethod { get; set; }
    public PaymentStatus PaymentStatus { get; set; }
    public bool WebhookVerified { get; set; }
    public DateTime? WebhookVerifiedAtUtc { get; set; }
    public OrderStatus OrderStatus { get; set; }
    public string? GuestNotes { get; set; }
    public DateTime? AcceptedAtUtc { get; set; }
    public DateTime? PreparingAtUtc { get; set; }
    public DateTime? ReadyAtUtc { get; set; }
    public DateTime? DeliveredAtUtc { get; set; }
    public DateTime? CancelledAtUtc { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }

    public GuestSession? GuestSession { get; set; }
    public Hotel Hotel { get; set; } = null!;
    public Kitchen Kitchen { get; set; } = null!;
    public ICollection<OrderLine> Lines { get; set; } = new List<OrderLine>();
}

public sealed class OrderLine
{
    public long OrderLineId { get; set; }
    public long OrderId { get; set; }
    public long ItemId { get; set; }
    public string ItemSnapshotName { get; set; } = string.Empty;
    public bool IsVegSnapshot { get; set; }
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal LineTotal { get; set; }
    public DateTime CreatedAtUtc { get; set; }

    public Order Order { get; set; } = null!;
    public Item Item { get; set; } = null!;
}

public sealed class OrderStatusHistory
{
    public long OrderStatusHistoryId { get; set; }
    public long OrderId { get; set; }
    public OrderStatus? PreviousStatus { get; set; }
    public OrderStatus NewStatus { get; set; }
    public string ChangedBy { get; set; } = string.Empty;
    public string? Notes { get; set; }
    public DateTime ChangedAtUtc { get; set; }

    public Order Order { get; set; } = null!;
}

public sealed class PaymentOrder
{
    public long PaymentOrderId { get; set; }
    public long OrderId { get; set; }
    public PaymentGatewayProvider GatewayProvider { get; set; }
    public string GatewayOrderId { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string CurrencyCode { get; set; } = "INR";
    public PaymentStatus Status { get; set; }
    public string? CheckoutUrl { get; set; }
    public DateTime? ExpiresAtUtc { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }

    public Order Order { get; set; } = null!;
}

public sealed class PaymentTransaction
{
    public long PaymentTransactionId { get; set; }
    public long PaymentOrderId { get; set; }
    public string GatewayPaymentId { get; set; } = string.Empty;
    public string? Signature { get; set; }
    public PaymentStatus TransactionStatus { get; set; }
    public decimal Amount { get; set; }
    public string CurrencyCode { get; set; } = "INR";
    public string? RawPayload { get; set; }
    public bool Verified { get; set; }
    public DateTime? VerifiedAtUtc { get; set; }
    public DateTime CreatedAtUtc { get; set; }

    public PaymentOrder PaymentOrder { get; set; } = null!;
}

public sealed class WebhookLog
{
    public long WebhookLogId { get; set; }
    public PaymentGatewayProvider GatewayProvider { get; set; }
    public string EventId { get; set; } = string.Empty;
    public string EventType { get; set; } = string.Empty;
    public string? Signature { get; set; }
    public string PayloadJson { get; set; } = string.Empty;
    public DateTime ReceivedAtUtc { get; set; }
    public DateTime? ProcessedAtUtc { get; set; }
    public string ProcessingStatus { get; set; } = "RECEIVED";
    public string? ErrorMessage { get; set; }
    public long? RelatedOrderId { get; set; }
    public long? RelatedPaymentOrderId { get; set; }
}





