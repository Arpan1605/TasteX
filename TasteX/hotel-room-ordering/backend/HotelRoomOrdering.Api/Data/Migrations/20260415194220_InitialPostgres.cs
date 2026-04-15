using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace HotelRoomOrdering.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class InitialPostgres : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "public");

            migrationBuilder.CreateTable(
                name: "Categories",
                schema: "public",
                columns: table => new
                {
                    CategoryId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CategoryCode = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    CategoryIcon = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Categories", x => x.CategoryId);
                });

            migrationBuilder.CreateTable(
                name: "Cities",
                schema: "public",
                columns: table => new
                {
                    CityId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CityCode = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    StateName = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Cities", x => x.CityId);
                });

            migrationBuilder.CreateTable(
                name: "WebhookLogs",
                schema: "public",
                columns: table => new
                {
                    WebhookLogId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    GatewayProvider = table.Column<byte>(type: "smallint", nullable: false),
                    EventId = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    EventType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Signature = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    PayloadJson = table.Column<string>(type: "text", nullable: false),
                    ReceivedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ProcessedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ProcessingStatus = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    ErrorMessage = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    RelatedOrderId = table.Column<long>(type: "bigint", nullable: true),
                    RelatedPaymentOrderId = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WebhookLogs", x => x.WebhookLogId);
                });

            migrationBuilder.CreateTable(
                name: "Items",
                schema: "public",
                columns: table => new
                {
                    ItemId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ItemCode = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    CategoryId = table.Column<long>(type: "bigint", nullable: false),
                    Name = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    Description = table.Column<string>(type: "character varying(600)", maxLength: 600, nullable: true),
                    BasePrice = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    IsVeg = table.Column<bool>(type: "boolean", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Items", x => x.ItemId);
                    table.ForeignKey(
                        name: "FK_Items_Categories_CategoryId",
                        column: x => x.CategoryId,
                        principalSchema: "public",
                        principalTable: "Categories",
                        principalColumn: "CategoryId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Kitchens",
                schema: "public",
                columns: table => new
                {
                    KitchenId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CityId = table.Column<long>(type: "bigint", nullable: false),
                    KitchenCode = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Name = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    AddressLine = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    ContactPhone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    ManagerName = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    LoginUsername = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    PasswordHash = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Kitchens", x => x.KitchenId);
                    table.ForeignKey(
                        name: "FK_Kitchens_Cities_CityId",
                        column: x => x.CityId,
                        principalSchema: "public",
                        principalTable: "Cities",
                        principalColumn: "CityId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Hotels",
                schema: "public",
                columns: table => new
                {
                    HotelId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CityId = table.Column<long>(type: "bigint", nullable: false),
                    KitchenId = table.Column<long>(type: "bigint", nullable: false),
                    HotelCode = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Name = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    AddressLine = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    RoomCount = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Hotels", x => x.HotelId);
                    table.ForeignKey(
                        name: "FK_Hotels_Cities_CityId",
                        column: x => x.CityId,
                        principalSchema: "public",
                        principalTable: "Cities",
                        principalColumn: "CityId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Hotels_Kitchens_KitchenId",
                        column: x => x.KitchenId,
                        principalSchema: "public",
                        principalTable: "Kitchens",
                        principalColumn: "KitchenId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "KitchenItemAvailability",
                schema: "public",
                columns: table => new
                {
                    KitchenItemAvailabilityId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    KitchenId = table.Column<long>(type: "bigint", nullable: false),
                    ItemId = table.Column<long>(type: "bigint", nullable: false),
                    IsAvailable = table.Column<bool>(type: "boolean", nullable: false),
                    EffectivePrice = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: true),
                    EffectiveFromUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EffectiveToUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_KitchenItemAvailability", x => x.KitchenItemAvailabilityId);
                    table.ForeignKey(
                        name: "FK_KitchenItemAvailability_Items_ItemId",
                        column: x => x.ItemId,
                        principalSchema: "public",
                        principalTable: "Items",
                        principalColumn: "ItemId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_KitchenItemAvailability_Kitchens_KitchenId",
                        column: x => x.KitchenId,
                        principalSchema: "public",
                        principalTable: "Kitchens",
                        principalColumn: "KitchenId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "HotelMenuItems",
                schema: "public",
                columns: table => new
                {
                    HotelMenuItemId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    HotelId = table.Column<long>(type: "bigint", nullable: false),
                    ItemId = table.Column<long>(type: "bigint", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    InventoryQuantity = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    PrepTimeMinutes = table.Column<int>(type: "integer", nullable: true),
                    ImageUrl = table.Column<string>(type: "character varying(600)", maxLength: 600, nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HotelMenuItems", x => x.HotelMenuItemId);
                    table.ForeignKey(
                        name: "FK_HotelMenuItems_Hotels_HotelId",
                        column: x => x.HotelId,
                        principalSchema: "public",
                        principalTable: "Hotels",
                        principalColumn: "HotelId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_HotelMenuItems_Items_ItemId",
                        column: x => x.ItemId,
                        principalSchema: "public",
                        principalTable: "Items",
                        principalColumn: "ItemId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "OtpSessions",
                schema: "public",
                columns: table => new
                {
                    OtpSessionId = table.Column<Guid>(type: "uuid", nullable: false),
                    HotelId = table.Column<long>(type: "bigint", nullable: false),
                    MobileNumber = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    OtpHash = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    OtpPurpose = table.Column<byte>(type: "smallint", nullable: false),
                    ExpiresAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    VerifiedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    AttemptCount = table.Column<int>(type: "integer", nullable: false),
                    MaxAttempts = table.Column<int>(type: "integer", nullable: false),
                    IsBlocked = table.Column<bool>(type: "boolean", nullable: false),
                    LastAttemptAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OtpSessions", x => x.OtpSessionId);
                    table.ForeignKey(
                        name: "FK_OtpSessions_Hotels_HotelId",
                        column: x => x.HotelId,
                        principalSchema: "public",
                        principalTable: "Hotels",
                        principalColumn: "HotelId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "GuestSessions",
                schema: "public",
                columns: table => new
                {
                    GuestSessionId = table.Column<Guid>(type: "uuid", nullable: false),
                    OtpSessionId = table.Column<Guid>(type: "uuid", nullable: false),
                    HotelId = table.Column<long>(type: "bigint", nullable: false),
                    MobileNumber = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    SessionTokenHash = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    ExpiresAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsRevoked = table.Column<bool>(type: "boolean", nullable: false),
                    RevokedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GuestSessions", x => x.GuestSessionId);
                    table.ForeignKey(
                        name: "FK_GuestSessions_Hotels_HotelId",
                        column: x => x.HotelId,
                        principalSchema: "public",
                        principalTable: "Hotels",
                        principalColumn: "HotelId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_GuestSessions_OtpSessions_OtpSessionId",
                        column: x => x.OtpSessionId,
                        principalSchema: "public",
                        principalTable: "OtpSessions",
                        principalColumn: "OtpSessionId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Orders",
                schema: "public",
                columns: table => new
                {
                    OrderId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    OrderNumber = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    GuestSessionId = table.Column<Guid>(type: "uuid", nullable: true),
                    HotelId = table.Column<long>(type: "bigint", nullable: false),
                    KitchenId = table.Column<long>(type: "bigint", nullable: false),
                    MobileNumber = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    RoomNumber = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    CurrencyCode = table.Column<string>(type: "character(3)", fixedLength: true, maxLength: 3, nullable: false),
                    SubTotalAmount = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    TaxAmount = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    DiscountAmount = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    TotalAmount = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    PaymentMethod = table.Column<byte>(type: "smallint", nullable: false),
                    PaymentStatus = table.Column<byte>(type: "smallint", nullable: false),
                    WebhookVerified = table.Column<bool>(type: "boolean", nullable: false),
                    WebhookVerifiedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    OrderStatus = table.Column<byte>(type: "smallint", nullable: false),
                    GuestNotes = table.Column<string>(type: "character varying(600)", maxLength: 600, nullable: true),
                    AcceptedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    PreparingAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ReadyAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeliveredAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CancelledAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Orders", x => x.OrderId);
                    table.ForeignKey(
                        name: "FK_Orders_GuestSessions_GuestSessionId",
                        column: x => x.GuestSessionId,
                        principalSchema: "public",
                        principalTable: "GuestSessions",
                        principalColumn: "GuestSessionId");
                    table.ForeignKey(
                        name: "FK_Orders_Hotels_HotelId",
                        column: x => x.HotelId,
                        principalSchema: "public",
                        principalTable: "Hotels",
                        principalColumn: "HotelId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Orders_Kitchens_KitchenId",
                        column: x => x.KitchenId,
                        principalSchema: "public",
                        principalTable: "Kitchens",
                        principalColumn: "KitchenId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "OrderLines",
                schema: "public",
                columns: table => new
                {
                    OrderLineId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    OrderId = table.Column<long>(type: "bigint", nullable: false),
                    ItemId = table.Column<long>(type: "bigint", nullable: false),
                    ItemSnapshotName = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    IsVegSnapshot = table.Column<bool>(type: "boolean", nullable: false),
                    Quantity = table.Column<int>(type: "integer", nullable: false),
                    UnitPrice = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    LineTotal = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrderLines", x => x.OrderLineId);
                    table.ForeignKey(
                        name: "FK_OrderLines_Items_ItemId",
                        column: x => x.ItemId,
                        principalSchema: "public",
                        principalTable: "Items",
                        principalColumn: "ItemId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_OrderLines_Orders_OrderId",
                        column: x => x.OrderId,
                        principalSchema: "public",
                        principalTable: "Orders",
                        principalColumn: "OrderId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "OrderStatusHistory",
                schema: "public",
                columns: table => new
                {
                    OrderStatusHistoryId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    OrderId = table.Column<long>(type: "bigint", nullable: false),
                    PreviousStatus = table.Column<byte>(type: "smallint", nullable: true),
                    NewStatus = table.Column<byte>(type: "smallint", nullable: false),
                    ChangedBy = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Notes = table.Column<string>(type: "character varying(600)", maxLength: 600, nullable: true),
                    ChangedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrderStatusHistory", x => x.OrderStatusHistoryId);
                    table.ForeignKey(
                        name: "FK_OrderStatusHistory_Orders_OrderId",
                        column: x => x.OrderId,
                        principalSchema: "public",
                        principalTable: "Orders",
                        principalColumn: "OrderId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PaymentOrders",
                schema: "public",
                columns: table => new
                {
                    PaymentOrderId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    OrderId = table.Column<long>(type: "bigint", nullable: false),
                    GatewayProvider = table.Column<byte>(type: "smallint", nullable: false),
                    GatewayOrderId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    CurrencyCode = table.Column<string>(type: "character(3)", fixedLength: true, maxLength: 3, nullable: false),
                    Status = table.Column<byte>(type: "smallint", nullable: false),
                    CheckoutUrl = table.Column<string>(type: "character varying(600)", maxLength: 600, nullable: true),
                    ExpiresAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PaymentOrders", x => x.PaymentOrderId);
                    table.ForeignKey(
                        name: "FK_PaymentOrders_Orders_OrderId",
                        column: x => x.OrderId,
                        principalSchema: "public",
                        principalTable: "Orders",
                        principalColumn: "OrderId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PaymentTransactions",
                schema: "public",
                columns: table => new
                {
                    PaymentTransactionId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    PaymentOrderId = table.Column<long>(type: "bigint", nullable: false),
                    GatewayPaymentId = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Signature = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    TransactionStatus = table.Column<byte>(type: "smallint", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    CurrencyCode = table.Column<string>(type: "character(3)", fixedLength: true, maxLength: 3, nullable: false),
                    RawPayload = table.Column<string>(type: "text", nullable: true),
                    Verified = table.Column<bool>(type: "boolean", nullable: false),
                    VerifiedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PaymentTransactions", x => x.PaymentTransactionId);
                    table.ForeignKey(
                        name: "FK_PaymentTransactions_PaymentOrders_PaymentOrderId",
                        column: x => x.PaymentOrderId,
                        principalSchema: "public",
                        principalTable: "PaymentOrders",
                        principalColumn: "PaymentOrderId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Categories_CategoryCode",
                schema: "public",
                table: "Categories",
                column: "CategoryCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Cities_CityCode",
                schema: "public",
                table: "Cities",
                column: "CityCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_GuestSessions_HotelId",
                schema: "public",
                table: "GuestSessions",
                column: "HotelId");

            migrationBuilder.CreateIndex(
                name: "IX_GuestSessions_OtpSessionId",
                schema: "public",
                table: "GuestSessions",
                column: "OtpSessionId");

            migrationBuilder.CreateIndex(
                name: "IX_HotelMenuItems_HotelId_ItemId",
                schema: "public",
                table: "HotelMenuItems",
                columns: new[] { "HotelId", "ItemId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_HotelMenuItems_ItemId",
                schema: "public",
                table: "HotelMenuItems",
                column: "ItemId");

            migrationBuilder.CreateIndex(
                name: "IX_Hotels_CityId",
                schema: "public",
                table: "Hotels",
                column: "CityId");

            migrationBuilder.CreateIndex(
                name: "IX_Hotels_HotelCode",
                schema: "public",
                table: "Hotels",
                column: "HotelCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Hotels_KitchenId",
                schema: "public",
                table: "Hotels",
                column: "KitchenId");

            migrationBuilder.CreateIndex(
                name: "IX_Items_CategoryId",
                schema: "public",
                table: "Items",
                column: "CategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_Items_ItemCode",
                schema: "public",
                table: "Items",
                column: "ItemCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_KitchenItemAvailability_ItemId",
                schema: "public",
                table: "KitchenItemAvailability",
                column: "ItemId");

            migrationBuilder.CreateIndex(
                name: "IX_KitchenItemAvailability_KitchenId_ItemId",
                schema: "public",
                table: "KitchenItemAvailability",
                columns: new[] { "KitchenId", "ItemId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Kitchens_CityId",
                schema: "public",
                table: "Kitchens",
                column: "CityId");

            migrationBuilder.CreateIndex(
                name: "IX_Kitchens_KitchenCode",
                schema: "public",
                table: "Kitchens",
                column: "KitchenCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Kitchens_LoginUsername",
                schema: "public",
                table: "Kitchens",
                column: "LoginUsername",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OrderLines_ItemId",
                schema: "public",
                table: "OrderLines",
                column: "ItemId");

            migrationBuilder.CreateIndex(
                name: "IX_OrderLines_OrderId",
                schema: "public",
                table: "OrderLines",
                column: "OrderId");

            migrationBuilder.CreateIndex(
                name: "IX_Orders_GuestSessionId",
                schema: "public",
                table: "Orders",
                column: "GuestSessionId");

            migrationBuilder.CreateIndex(
                name: "IX_Orders_HotelId",
                schema: "public",
                table: "Orders",
                column: "HotelId");

            migrationBuilder.CreateIndex(
                name: "IX_Orders_KitchenId",
                schema: "public",
                table: "Orders",
                column: "KitchenId");

            migrationBuilder.CreateIndex(
                name: "IX_Orders_OrderNumber",
                schema: "public",
                table: "Orders",
                column: "OrderNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OrderStatusHistory_OrderId",
                schema: "public",
                table: "OrderStatusHistory",
                column: "OrderId");

            migrationBuilder.CreateIndex(
                name: "IX_OtpSessions_HotelId",
                schema: "public",
                table: "OtpSessions",
                column: "HotelId");

            migrationBuilder.CreateIndex(
                name: "IX_PaymentOrders_GatewayOrderId",
                schema: "public",
                table: "PaymentOrders",
                column: "GatewayOrderId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PaymentOrders_OrderId",
                schema: "public",
                table: "PaymentOrders",
                column: "OrderId");

            migrationBuilder.CreateIndex(
                name: "IX_PaymentTransactions_GatewayPaymentId",
                schema: "public",
                table: "PaymentTransactions",
                column: "GatewayPaymentId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PaymentTransactions_PaymentOrderId",
                schema: "public",
                table: "PaymentTransactions",
                column: "PaymentOrderId");

            migrationBuilder.CreateIndex(
                name: "IX_WebhookLogs_GatewayProvider_EventId",
                schema: "public",
                table: "WebhookLogs",
                columns: new[] { "GatewayProvider", "EventId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "HotelMenuItems",
                schema: "public");

            migrationBuilder.DropTable(
                name: "KitchenItemAvailability",
                schema: "public");

            migrationBuilder.DropTable(
                name: "OrderLines",
                schema: "public");

            migrationBuilder.DropTable(
                name: "OrderStatusHistory",
                schema: "public");

            migrationBuilder.DropTable(
                name: "PaymentTransactions",
                schema: "public");

            migrationBuilder.DropTable(
                name: "WebhookLogs",
                schema: "public");

            migrationBuilder.DropTable(
                name: "Items",
                schema: "public");

            migrationBuilder.DropTable(
                name: "PaymentOrders",
                schema: "public");

            migrationBuilder.DropTable(
                name: "Categories",
                schema: "public");

            migrationBuilder.DropTable(
                name: "Orders",
                schema: "public");

            migrationBuilder.DropTable(
                name: "GuestSessions",
                schema: "public");

            migrationBuilder.DropTable(
                name: "OtpSessions",
                schema: "public");

            migrationBuilder.DropTable(
                name: "Hotels",
                schema: "public");

            migrationBuilder.DropTable(
                name: "Kitchens",
                schema: "public");

            migrationBuilder.DropTable(
                name: "Cities",
                schema: "public");
        }
    }
}
