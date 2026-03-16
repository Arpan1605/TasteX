SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/*
  Hotel Room Ordering - SQL Server Schema
  Covers:
  - Cities/Kitchens/Hotels mapping
  - Central categories/items
  - Kitchen item availability + pricing overrides
  - OTP sessions and verifications
  - Guest sessions
  - Orders and order lines
  - Payments and payment transactions
  - Webhook logs and processing
*/

/* =========================
   Master & Catalog Tables
   ========================= */

CREATE TABLE dbo.Cities (
    CityId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    CityCode NVARCHAR(32) NOT NULL,
    Name NVARCHAR(120) NOT NULL,
    StateName NVARCHAR(120) NULL,
    IsActive BIT NOT NULL CONSTRAINT DF_Cities_IsActive DEFAULT (1),
    CreatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_Cities_CreatedAtUtc DEFAULT (SYSUTCDATETIME()),
    UpdatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_Cities_UpdatedAtUtc DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT UQ_Cities_CityCode UNIQUE (CityCode)
);
GO

CREATE TABLE dbo.Kitchens (
    KitchenId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    CityId BIGINT NOT NULL,
    KitchenCode NVARCHAR(32) NOT NULL,
    Name NVARCHAR(160) NOT NULL,
    AddressLine NVARCHAR(300) NULL,
    ContactPhone NVARCHAR(20) NULL,
    ManagerName NVARCHAR(120) NULL,
    LoginUsername NVARCHAR(80) NOT NULL,
    PasswordHash NVARCHAR(512) NOT NULL,
    IsActive BIT NOT NULL CONSTRAINT DF_Kitchens_IsActive DEFAULT (1),
    CreatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_Kitchens_CreatedAtUtc DEFAULT (SYSUTCDATETIME()),
    UpdatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_Kitchens_UpdatedAtUtc DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_Kitchens_Cities_CityId FOREIGN KEY (CityId) REFERENCES dbo.Cities(CityId),
    CONSTRAINT UQ_Kitchens_KitchenCode UNIQUE (KitchenCode),
    CONSTRAINT UQ_Kitchens_LoginUsername UNIQUE (LoginUsername)
);
GO

CREATE TABLE dbo.Hotels (
    HotelId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    CityId BIGINT NOT NULL,
    KitchenId BIGINT NOT NULL,
    HotelCode NVARCHAR(32) NOT NULL,
    Name NVARCHAR(180) NOT NULL,
    AddressLine NVARCHAR(300) NULL,
    RoomCount INT NOT NULL CONSTRAINT DF_Hotels_RoomCount DEFAULT (0),
    IsActive BIT NOT NULL CONSTRAINT DF_Hotels_IsActive DEFAULT (1),
    CreatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_Hotels_CreatedAtUtc DEFAULT (SYSUTCDATETIME()),
    UpdatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_Hotels_UpdatedAtUtc DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_Hotels_Cities_CityId FOREIGN KEY (CityId) REFERENCES dbo.Cities(CityId),
    CONSTRAINT FK_Hotels_Kitchens_KitchenId FOREIGN KEY (KitchenId) REFERENCES dbo.Kitchens(KitchenId),
    CONSTRAINT UQ_Hotels_HotelCode UNIQUE (HotelCode)
);
GO

CREATE TABLE dbo.Categories (
    CategoryId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    CategoryCode NVARCHAR(32) NOT NULL,
    Name NVARCHAR(120) NOT NULL,
    CategoryIcon NVARCHAR(400) NULL,
    SortOrder INT NOT NULL,
    IsActive BIT NOT NULL CONSTRAINT DF_Categories_IsActive DEFAULT (1),
    CreatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_Categories_CreatedAtUtc DEFAULT (SYSUTCDATETIME()),
    UpdatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_Categories_UpdatedAtUtc DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT UQ_Categories_CategoryCode UNIQUE (CategoryCode)
);
GO

CREATE TABLE dbo.Items (
    ItemId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    ItemCode NVARCHAR(32) NOT NULL,
    CategoryId BIGINT NOT NULL,
    Name NVARCHAR(180) NOT NULL,
    Description NVARCHAR(600) NULL,
    BasePrice DECIMAL(12,2) NOT NULL,
    IsVeg BIT NOT NULL,
    IsActive BIT NOT NULL CONSTRAINT DF_Items_IsActive DEFAULT (1),
    CreatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_Items_CreatedAtUtc DEFAULT (SYSUTCDATETIME()),
    UpdatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_Items_UpdatedAtUtc DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_Items_Categories_CategoryId FOREIGN KEY (CategoryId) REFERENCES dbo.Categories(CategoryId),
    CONSTRAINT UQ_Items_ItemCode UNIQUE (ItemCode),
    CONSTRAINT CK_Items_BasePrice_NonNegative CHECK (BasePrice >= 0)
);
GO

CREATE TABLE dbo.HotelMenuItems (
    HotelMenuItemId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    HotelId BIGINT NOT NULL,
    ItemId BIGINT NOT NULL,
    IsActive BIT NOT NULL CONSTRAINT DF_HotelMenuItems_IsActive DEFAULT (1),
    InventoryQuantity INT NOT NULL CONSTRAINT DF_HotelMenuItems_InventoryQuantity DEFAULT (0),
    PrepTimeMinutes INT NULL,
    ImageUrl NVARCHAR(600) NULL,
    CreatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_HotelMenuItems_CreatedAtUtc DEFAULT (SYSUTCDATETIME()),
    UpdatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_HotelMenuItems_UpdatedAtUtc DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_HotelMenuItems_Hotels_HotelId FOREIGN KEY (HotelId) REFERENCES dbo.Hotels(HotelId),
    CONSTRAINT FK_HotelMenuItems_Items_ItemId FOREIGN KEY (ItemId) REFERENCES dbo.Items(ItemId),
    CONSTRAINT UQ_HotelMenuItems_HotelId_ItemId UNIQUE (HotelId, ItemId),
    CONSTRAINT CK_HotelMenuItems_InventoryQuantity_NonNegative CHECK (InventoryQuantity >= 0)
);
GO
CREATE TABLE dbo.KitchenItemAvailability (
    KitchenItemAvailabilityId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    KitchenId BIGINT NOT NULL,
    ItemId BIGINT NOT NULL,
    IsAvailable BIT NOT NULL CONSTRAINT DF_KitchenItemAvailability_IsAvailable DEFAULT (1),
    EffectivePrice DECIMAL(12,2) NULL,
    EffectiveFromUtc DATETIME2(3) NOT NULL CONSTRAINT DF_KitchenItemAvailability_EffectiveFromUtc DEFAULT (SYSUTCDATETIME()),
    EffectiveToUtc DATETIME2(3) NULL,
    UpdatedBy NVARCHAR(120) NULL,
    UpdatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_KitchenItemAvailability_UpdatedAtUtc DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_KitchenItemAvailability_Kitchens_KitchenId FOREIGN KEY (KitchenId) REFERENCES dbo.Kitchens(KitchenId),
    CONSTRAINT FK_KitchenItemAvailability_Items_ItemId FOREIGN KEY (ItemId) REFERENCES dbo.Items(ItemId),
    CONSTRAINT UQ_KitchenItemAvailability_KitchenId_ItemId UNIQUE (KitchenId, ItemId),
    CONSTRAINT CK_KitchenItemAvailability_EffectivePrice_NonNegative CHECK (EffectivePrice IS NULL OR EffectivePrice >= 0),
    CONSTRAINT CK_KitchenItemAvailability_EffectiveWindow CHECK (EffectiveToUtc IS NULL OR EffectiveToUtc >= EffectiveFromUtc)
);
GO
/* =========================
   OTP & Session Tables
   ========================= */

CREATE TABLE dbo.OtpSessions (
    OtpSessionId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    HotelId BIGINT NOT NULL,
    MobileNumber NVARCHAR(20) NOT NULL,
    OtpHash NVARCHAR(256) NOT NULL,
    OtpPurpose TINYINT NOT NULL,
    ExpiresAtUtc DATETIME2(3) NOT NULL,
    VerifiedAtUtc DATETIME2(3) NULL,
    AttemptCount INT NOT NULL CONSTRAINT DF_OtpSessions_AttemptCount DEFAULT (0),
    MaxAttempts INT NOT NULL CONSTRAINT DF_OtpSessions_MaxAttempts DEFAULT (5),
    IsBlocked BIT NOT NULL CONSTRAINT DF_OtpSessions_IsBlocked DEFAULT (0),
    LastAttemptAtUtc DATETIME2(3) NULL,
    CreatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_OtpSessions_CreatedAtUtc DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_OtpSessions_Hotels_HotelId FOREIGN KEY (HotelId) REFERENCES dbo.Hotels(HotelId),
    CONSTRAINT CK_OtpSessions_Expiry_AfterCreate CHECK (ExpiresAtUtc >= CreatedAtUtc),
    CONSTRAINT CK_OtpSessions_OtpPurpose CHECK (OtpPurpose IN (1))
);
GO

CREATE TABLE dbo.GuestSessions (
    GuestSessionId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    OtpSessionId UNIQUEIDENTIFIER NOT NULL,
    HotelId BIGINT NOT NULL,
    MobileNumber NVARCHAR(20) NOT NULL,
    SessionTokenHash NVARCHAR(256) NOT NULL,
    ExpiresAtUtc DATETIME2(3) NOT NULL,
    IsRevoked BIT NOT NULL CONSTRAINT DF_GuestSessions_IsRevoked DEFAULT (0),
    RevokedAtUtc DATETIME2(3) NULL,
    CreatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_GuestSessions_CreatedAtUtc DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_GuestSessions_OtpSessions_OtpSessionId FOREIGN KEY (OtpSessionId) REFERENCES dbo.OtpSessions(OtpSessionId),
    CONSTRAINT FK_GuestSessions_Hotels_HotelId FOREIGN KEY (HotelId) REFERENCES dbo.Hotels(HotelId),
    CONSTRAINT CK_GuestSessions_Expiry_AfterCreate CHECK (ExpiresAtUtc >= CreatedAtUtc)
);
GO

/* =========================
   Order & Fulfilment Tables
   ========================= */

CREATE TABLE dbo.Orders (
    OrderId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    OrderNumber NVARCHAR(40) NOT NULL,
    GuestSessionId UNIQUEIDENTIFIER NULL,
    HotelId BIGINT NOT NULL,
    KitchenId BIGINT NOT NULL,
    MobileNumber NVARCHAR(20) NOT NULL,
    RoomNumber NVARCHAR(20) NULL,
    CurrencyCode CHAR(3) NOT NULL CONSTRAINT DF_Orders_CurrencyCode DEFAULT ('INR'),
    SubTotalAmount DECIMAL(12,2) NOT NULL,
    TaxAmount DECIMAL(12,2) NOT NULL CONSTRAINT DF_Orders_TaxAmount DEFAULT (0),
    DiscountAmount DECIMAL(12,2) NOT NULL CONSTRAINT DF_Orders_DiscountAmount DEFAULT (0),
    TotalAmount DECIMAL(12,2) NOT NULL,
    PaymentMethod TINYINT NOT NULL CONSTRAINT DF_Orders_PaymentMethod DEFAULT (1),
    PaymentStatus TINYINT NOT NULL CONSTRAINT DF_Orders_PaymentStatus DEFAULT (1),
    WebhookVerified BIT NOT NULL CONSTRAINT DF_Orders_WebhookVerified DEFAULT (0),
    WebhookVerifiedAtUtc DATETIME2(3) NULL,
    OrderStatus TINYINT NOT NULL CONSTRAINT DF_Orders_OrderStatus DEFAULT (1),
    GuestNotes NVARCHAR(600) NULL,
    AcceptedAtUtc DATETIME2(3) NULL,
    PreparingAtUtc DATETIME2(3) NULL,
    ReadyAtUtc DATETIME2(3) NULL,
    DeliveredAtUtc DATETIME2(3) NULL,
    CancelledAtUtc DATETIME2(3) NULL,
    CreatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_Orders_CreatedAtUtc DEFAULT (SYSUTCDATETIME()),
    UpdatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_Orders_UpdatedAtUtc DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_Orders_GuestSessions_GuestSessionId FOREIGN KEY (GuestSessionId) REFERENCES dbo.GuestSessions(GuestSessionId),
    CONSTRAINT FK_Orders_Hotels_HotelId FOREIGN KEY (HotelId) REFERENCES dbo.Hotels(HotelId),
    CONSTRAINT FK_Orders_Kitchens_KitchenId FOREIGN KEY (KitchenId) REFERENCES dbo.Kitchens(KitchenId),
    CONSTRAINT UQ_Orders_OrderNumber UNIQUE (OrderNumber),
    CONSTRAINT CK_Orders_Amounts_NonNegative CHECK (
      SubTotalAmount >= 0 AND TaxAmount >= 0 AND DiscountAmount >= 0 AND TotalAmount >= 0
    ),
    CONSTRAINT CK_Orders_PaymentMethod CHECK (PaymentMethod IN (1)),
    CONSTRAINT CK_Orders_PaymentStatus CHECK (PaymentStatus IN (1,2,3,4)),
    CONSTRAINT CK_Orders_OrderStatus CHECK (OrderStatus IN (1,2,3,4,5))
);
GO

CREATE TABLE dbo.OrderLines (
    OrderLineId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    OrderId BIGINT NOT NULL,
    ItemId BIGINT NOT NULL,
    ItemSnapshotName NVARCHAR(180) NOT NULL,
    IsVegSnapshot BIT NOT NULL,
    Quantity INT NOT NULL,
    UnitPrice DECIMAL(12,2) NOT NULL,
    LineTotal DECIMAL(12,2) NOT NULL,
    CreatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_OrderLines_CreatedAtUtc DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_OrderLines_Orders_OrderId FOREIGN KEY (OrderId) REFERENCES dbo.Orders(OrderId),
    CONSTRAINT FK_OrderLines_Items_ItemId FOREIGN KEY (ItemId) REFERENCES dbo.Items(ItemId),
    CONSTRAINT CK_OrderLines_Quantity_Positive CHECK (Quantity > 0),
    CONSTRAINT CK_OrderLines_Amounts_NonNegative CHECK (UnitPrice >= 0 AND LineTotal >= 0)
);
GO

CREATE TABLE dbo.OrderStatusHistory (
    OrderStatusHistoryId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    OrderId BIGINT NOT NULL,
    PreviousStatus TINYINT NULL,
    NewStatus TINYINT NOT NULL,
    ChangedBy NVARCHAR(120) NOT NULL,
    Notes NVARCHAR(600) NULL,
    ChangedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_OrderStatusHistory_ChangedAtUtc DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_OrderStatusHistory_Orders_OrderId FOREIGN KEY (OrderId) REFERENCES dbo.Orders(OrderId),
    CONSTRAINT CK_OrderStatusHistory_NewStatus CHECK (NewStatus IN (1,2,3,4,5)),
    CONSTRAINT CK_OrderStatusHistory_PreviousStatus CHECK (PreviousStatus IS NULL OR PreviousStatus IN (1,2,3,4,5))
);
GO
/* =========================
   Payment & Webhook Tables
   ========================= */

CREATE TABLE dbo.PaymentOrders (
    PaymentOrderId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    OrderId BIGINT NOT NULL,
    GatewayProvider TINYINT NOT NULL,
    GatewayOrderId NVARCHAR(100) NOT NULL,
    Amount DECIMAL(12,2) NOT NULL,
    CurrencyCode CHAR(3) NOT NULL CONSTRAINT DF_PaymentOrders_CurrencyCode DEFAULT ('INR'),
    Status TINYINT NOT NULL CONSTRAINT DF_PaymentOrders_Status DEFAULT (1),
    CheckoutUrl NVARCHAR(600) NULL,
    ExpiresAtUtc DATETIME2(3) NULL,
    CreatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_PaymentOrders_CreatedAtUtc DEFAULT (SYSUTCDATETIME()),
    UpdatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_PaymentOrders_UpdatedAtUtc DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_PaymentOrders_Orders_OrderId FOREIGN KEY (OrderId) REFERENCES dbo.Orders(OrderId),
    CONSTRAINT UQ_PaymentOrders_GatewayOrderId UNIQUE (GatewayOrderId),
    CONSTRAINT CK_PaymentOrders_GatewayProvider CHECK (GatewayProvider IN (1,2,3,4,5)),
    CONSTRAINT CK_PaymentOrders_Status CHECK (Status IN (1,2,3,4)),
    CONSTRAINT CK_PaymentOrders_Amount_NonNegative CHECK (Amount >= 0)
);
GO

CREATE TABLE dbo.PaymentTransactions (
    PaymentTransactionId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    PaymentOrderId BIGINT NOT NULL,
    GatewayPaymentId NVARCHAR(120) NOT NULL,
    Signature NVARCHAR(300) NULL,
    TransactionStatus TINYINT NOT NULL,
    Amount DECIMAL(12,2) NOT NULL,
    CurrencyCode CHAR(3) NOT NULL,
    RawPayload NVARCHAR(MAX) NULL,
    Verified BIT NOT NULL CONSTRAINT DF_PaymentTransactions_Verified DEFAULT (0),
    VerifiedAtUtc DATETIME2(3) NULL,
    CreatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_PaymentTransactions_CreatedAtUtc DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_PaymentTransactions_PaymentOrders_PaymentOrderId FOREIGN KEY (PaymentOrderId) REFERENCES dbo.PaymentOrders(PaymentOrderId),
    CONSTRAINT UQ_PaymentTransactions_GatewayPaymentId UNIQUE (GatewayPaymentId),
    CONSTRAINT CK_PaymentTransactions_Status CHECK (TransactionStatus IN (1,2,3,4)),
    CONSTRAINT CK_PaymentTransactions_Amount_NonNegative CHECK (Amount >= 0)
);
GO

CREATE TABLE dbo.WebhookLogs (
    WebhookLogId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    GatewayProvider TINYINT NOT NULL,
    EventId NVARCHAR(120) NOT NULL,
    EventType NVARCHAR(100) NOT NULL,
    Signature NVARCHAR(300) NULL,
    PayloadJson NVARCHAR(MAX) NOT NULL,
    ReceivedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_WebhookLogs_ReceivedAtUtc DEFAULT (SYSUTCDATETIME()),
    ProcessedAtUtc DATETIME2(3) NULL,
    ProcessingStatus NVARCHAR(20) NOT NULL CONSTRAINT DF_WebhookLogs_ProcessingStatus DEFAULT ('RECEIVED'),
    ErrorMessage NVARCHAR(1000) NULL,
    RelatedOrderId BIGINT NULL,
    RelatedPaymentOrderId BIGINT NULL,
    CONSTRAINT FK_WebhookLogs_Orders_RelatedOrderId FOREIGN KEY (RelatedOrderId) REFERENCES dbo.Orders(OrderId),
    CONSTRAINT FK_WebhookLogs_PaymentOrders_RelatedPaymentOrderId FOREIGN KEY (RelatedPaymentOrderId) REFERENCES dbo.PaymentOrders(PaymentOrderId),
    CONSTRAINT UQ_WebhookLogs_GatewayProvider_EventId UNIQUE (GatewayProvider, EventId),
    CONSTRAINT CK_WebhookLogs_GatewayProvider CHECK (GatewayProvider IN (1,2,3,4,5)),
    CONSTRAINT CK_WebhookLogs_ProcessingStatus CHECK (ProcessingStatus IN ('RECEIVED','PROCESSED','FAILED','DUPLICATE'))
);
GO

/* =========================
   Useful Indexes
   ========================= */

CREATE INDEX IX_Kitchens_CityId ON dbo.Kitchens(CityId);
CREATE INDEX IX_Hotels_CityId ON dbo.Hotels(CityId);
CREATE INDEX IX_Hotels_KitchenId ON dbo.Hotels(KitchenId);
CREATE INDEX IX_Items_CategoryId ON dbo.Items(CategoryId);
CREATE INDEX IX_KitchenItemAvailability_KitchenId_IsAvailable ON dbo.KitchenItemAvailability(KitchenId, IsAvailable);
CREATE INDEX IX_OtpSessions_Mobile_ExpiresAtUtc ON dbo.OtpSessions(MobileNumber, ExpiresAtUtc DESC);
CREATE INDEX IX_GuestSessions_HotelId_ExpiresAtUtc ON dbo.GuestSessions(HotelId, ExpiresAtUtc DESC);
CREATE INDEX IX_Orders_KitchenId_PaymentStatus_WebhookVerified ON dbo.Orders(KitchenId, PaymentStatus, WebhookVerified);
CREATE INDEX IX_Orders_HotelId_CreatedAtUtc ON dbo.Orders(HotelId, CreatedAtUtc DESC);
CREATE INDEX IX_Orders_OrderStatus ON dbo.Orders(OrderStatus);
CREATE INDEX IX_OrderLines_OrderId ON dbo.OrderLines(OrderId);
CREATE INDEX IX_PaymentOrders_OrderId_Status ON dbo.PaymentOrders(OrderId, Status);
CREATE INDEX IX_PaymentTransactions_PaymentOrderId ON dbo.PaymentTransactions(PaymentOrderId);
CREATE INDEX IX_WebhookLogs_ReceivedAtUtc ON dbo.WebhookLogs(ReceivedAtUtc DESC);
GO

/* =========================
   Trigger for UpdatedAtUtc
   ========================= */

CREATE OR ALTER TRIGGER dbo.TR_Orders_SetUpdatedAtUtc
ON dbo.Orders
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE o
    SET UpdatedAtUtc = SYSUTCDATETIME()
    FROM dbo.Orders o
    INNER JOIN inserted i ON o.OrderId = i.OrderId;
END;
GO

CREATE OR ALTER TRIGGER dbo.TR_KitchenItemAvailability_SetUpdatedAtUtc
ON dbo.KitchenItemAvailability
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE kia
    SET UpdatedAtUtc = SYSUTCDATETIME()
    FROM dbo.KitchenItemAvailability kia
    INNER JOIN inserted i ON kia.KitchenItemAvailabilityId = i.KitchenItemAvailabilityId;
END;
GO

CREATE OR ALTER TRIGGER dbo.TR_PaymentOrders_SetUpdatedAtUtc
ON dbo.PaymentOrders
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE po
    SET UpdatedAtUtc = SYSUTCDATETIME()
    FROM dbo.PaymentOrders po
    INNER JOIN inserted i ON po.PaymentOrderId = i.PaymentOrderId;
END;
GO

/* =========================
   Optional Seed (minimal)
   ========================= */

INSERT INTO dbo.Cities (CityCode, Name, StateName) VALUES
('BLR', 'Bengaluru', 'Karnataka'),
('MUM', 'Mumbai', 'Maharashtra'),
('DEL', 'Delhi', 'Delhi');

INSERT INTO dbo.Kitchens (CityId, KitchenCode, Name, AddressLine, ContactPhone, ManagerName, LoginUsername, PasswordHash)
SELECT c.CityId, 'BLR-CENTRAL', 'Bengaluru Central Kitchen', 'MG Road, Bengaluru', '+919900000001', 'Ramesh Kumar', 'blrcentral', 'pbkdf2$sha256$100000$AQIDBAUGBwgJCgsMDQ4PEA==$rPQVBteGsvvwWTRt08lr9f1Eu+srr9vJc4EALkRyhQI=' FROM dbo.Cities c WHERE c.CityCode = 'BLR'
UNION ALL
SELECT c.CityId, 'BLR-SOUTH', 'Bengaluru South Kitchen', 'Koramangala, Bengaluru', '+919900000002', 'Suresh Patel', 'blrsouth', 'pbkdf2$sha256$100000$AQIDBAUGBwgJCgsMDQ4PEA==$DtBGgB8cJf8oHX/PaUSCLcs46FnRoDPccpPZ5SBDZMs=' FROM dbo.Cities c WHERE c.CityCode = 'BLR'
UNION ALL
SELECT c.CityId, 'MUM-AIR', 'Mumbai Airport Kitchen', 'Airport Road, Mumbai', '+919900000003', 'Rajesh Sharma', 'mumair', 'pbkdf2$sha256$100000$AQIDBAUGBwgJCgsMDQ4PEA==$QgAVG0Oz6BUd6dxnvXAnTrrXfiFQjXaizu1LObU/GWU=' FROM dbo.Cities c WHERE c.CityCode = 'MUM';

INSERT INTO dbo.Hotels (CityId, KitchenId, HotelCode, Name, AddressLine)
SELECT c.CityId, k.KitchenId, 'blr-gp-01', 'Grand Plaza Bengaluru', 'MG Road, Bengaluru'
FROM dbo.Cities c
JOIN dbo.Kitchens k ON k.KitchenCode = 'BLR-CENTRAL'
WHERE c.CityCode = 'BLR'
UNION ALL
SELECT c.CityId, k.KitchenId, 'blr-aur-01', 'Aurora Stay Bengaluru', 'Koramangala, Bengaluru'
FROM dbo.Cities c
JOIN dbo.Kitchens k ON k.KitchenCode = 'BLR-SOUTH'
WHERE c.CityCode = 'BLR';

INSERT INTO dbo.Categories (CategoryCode, Name, CategoryIcon, SortOrder) VALUES
('BREAKFAST', 'Breakfast', NULL, 1),
('MAIN', 'Main Course', NULL, 2),
('SNACKS', 'Snacks', NULL, 3),
('BEVERAGES', 'Beverages', NULL, 4);
GO


