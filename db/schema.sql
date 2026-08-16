-- Maintenance fee ledger (append-only; no UPDATE or DELETE ever executed against this table).
-- PK on (HouseholdRef, IdempotencyKey) guarantees idempotent POST semantics at the DB layer.
-- ChargedAt is application-supplied (DateTimeOffset.UtcNow in use case); no SQL DEFAULT.
IF OBJECT_ID(N'dbo.MaintenanceFeeCharges', N'U') IS NULL
CREATE TABLE dbo.MaintenanceFeeCharges
(
    Id             uniqueidentifier  NOT NULL,
    HouseholdRef   nvarchar(128)     NOT NULL,
    AmountEur      decimal(18, 2)    NOT NULL,
    Description    nvarchar(256)     NOT NULL,
    Period         nvarchar(16)      NOT NULL,
    ChargedAt      datetimeoffset(3) NOT NULL,
    IdempotencyKey nvarchar(128)     NOT NULL,
    CONSTRAINT PK_MaintenanceFeeCharges PRIMARY KEY (HouseholdRef, IdempotencyKey),
    CONSTRAINT UQ_MaintenanceFeeCharges_Id UNIQUE (Id)
);

-- Association expense ledger (append-only; no UPDATE or DELETE ever executed).
-- PK on IdempotencyKey guarantees idempotent POST semantics at the DB layer.
-- Expenses are complex-wide; no HouseholdRef.
IF OBJECT_ID(N'dbo.AssociationExpenses', N'U') IS NULL
CREATE TABLE dbo.AssociationExpenses
(
    Id             uniqueidentifier  NOT NULL,
    AmountEur      decimal(18, 2)    NOT NULL,
    Description    nvarchar(256)     NOT NULL,
    Category       nvarchar(128)     NOT NULL,
    ExpenseDate    date              NOT NULL,
    RecordedAt     datetimeoffset(3) NOT NULL,
    IdempotencyKey nvarchar(128)     NOT NULL,
    CONSTRAINT PK_AssociationExpenses    PRIMARY KEY (IdempotencyKey),
    CONSTRAINT UQ_AssociationExpenses_Id UNIQUE (Id)
);

-- Add ParentCategory to existing expense rows (idempotent).
IF COL_LENGTH('dbo.AssociationExpenses', 'ParentCategory') IS NULL
    ALTER TABLE dbo.AssociationExpenses ADD ParentCategory nvarchar(100) NULL;

-- Non-maintenance income ledger (parking, recovered costs, etc.).
-- PK on IdempotencyKey guarantees idempotent POST semantics at the DB layer.
IF OBJECT_ID(N'dbo.AssociationIncomes', N'U') IS NULL
CREATE TABLE dbo.AssociationIncomes
(
    Id             uniqueidentifier  NOT NULL,
    Category       nvarchar(100)     NOT NULL,
    Description    nvarchar(512)     NOT NULL,
    AmountEur      decimal(18, 2)    NOT NULL,
    IncomeDate     date              NOT NULL,
    RecordedAt     datetimeoffset(3) NOT NULL,
    IdempotencyKey nvarchar(128)     NOT NULL,
    CONSTRAINT PK_AssociationIncomes    PRIMARY KEY (IdempotencyKey),
    CONSTRAINT UQ_AssociationIncomes_Id UNIQUE (Id)
);

-- Reservation store schema (ADR-0002, 700-data-design).
-- The PRIMARY KEY on (DayDate, SlotKey) IS the concurrency mechanism (R1):
-- a claim is a plain INSERT and the engine's unique enforcement decides the race.
IF OBJECT_ID(N'dbo.Reservations', N'U') IS NULL
CREATE TABLE dbo.Reservations
(
    DayDate      date          NOT NULL,
    SlotKey      nvarchar(64)  NOT NULL,
    HouseholdRef nvarchar(128) NOT NULL,
    ClaimedAt    datetime2(3)  NOT NULL
        CONSTRAINT DF_Reservations_ClaimedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_Reservations PRIMARY KEY (DayDate, SlotKey)
);

-- Payment ledger (append-only; no UPDATE or DELETE ever executed against this table).
-- PK on (HouseholdRef, IdempotencyKey) mirrors MaintenanceFeeCharges.
-- DateReceived is admin-supplied (supports backfilling); RecordedAt is server-stamped.
IF OBJECT_ID(N'dbo.MaintenanceFeePayments', N'U') IS NULL
CREATE TABLE dbo.MaintenanceFeePayments
(
    Id             uniqueidentifier  NOT NULL,
    HouseholdRef   nvarchar(128)     NOT NULL,
    AmountEur      decimal(18, 2)    NOT NULL,
    Period         nvarchar(16)      NOT NULL,
    DateReceived   date              NOT NULL,
    RecordedAt     datetimeoffset(3) NOT NULL,
    IdempotencyKey nvarchar(128)     NOT NULL,
    CONSTRAINT PK_MaintenanceFeePayments    PRIMARY KEY (HouseholdRef, IdempotencyKey),
    CONSTRAINT UQ_MaintenanceFeePayments_Id UNIQUE (Id)
);

-- Push subscription store (one row per household; UPSERT semantics).
-- Endpoint, P256dhKey, AuthKey, FallbackEmail are personal data (GDPR/R3) — never logged.
IF OBJECT_ID(N'dbo.PushSubscriptions', N'U') IS NULL
CREATE TABLE dbo.PushSubscriptions
(
    HouseholdRef  nvarchar(128)     NOT NULL,
    Endpoint      nvarchar(2048)    NOT NULL,
    P256dhKey     nvarchar(128)     NOT NULL,
    AuthKey       nvarchar(128)     NOT NULL,
    FallbackEmail nvarchar(320)     NULL,
    CreatedAt     datetimeoffset(3) NOT NULL,
    UpdatedAt     datetimeoffset(3) NOT NULL,
    CONSTRAINT PK_PushSubscriptions PRIMARY KEY (HouseholdRef)
);

-- Notification history (last 30 days queried; no purge job in v1).
IF OBJECT_ID(N'dbo.NotificationHistory', N'U') IS NULL
CREATE TABLE dbo.NotificationHistory
(
    Id           uniqueidentifier  NOT NULL,
    HouseholdRef nvarchar(128)     NOT NULL,
    Title        nvarchar(256)     NOT NULL,
    SentAt       datetimeoffset(3) NOT NULL,
    Channel      nvarchar(16)      NOT NULL,
    CONSTRAINT PK_NotificationHistory PRIMARY KEY (Id),
    INDEX IX_NotificationHistory_HouseholdRef_SentAt (HouseholdRef, SentAt DESC)
);

-- Member directory contacts (one or two rows per household: Owner and/or Renter).
-- Phone and Email are personal data (R3) — never logged.
IF OBJECT_ID(N'dbo.HouseholdContacts', N'U') IS NULL
CREATE TABLE dbo.HouseholdContacts
(
    HouseholdRef  nvarchar(128)     NOT NULL,
    Role          nvarchar(10)      NOT NULL
        CONSTRAINT DF_HouseholdContacts_Role DEFAULT 'Owner',
    DisplayName   nvarchar(256)     NULL,
    Phone         nvarchar(32)      NULL,
    Email         nvarchar(320)     NULL,
    Notes         nvarchar(2048)    NULL,
    IsOptedOut    bit               NOT NULL
        CONSTRAINT DF_HouseholdContacts_IsOptedOut DEFAULT 0,
    UpdatedAt     datetimeoffset(3) NOT NULL,
    CONSTRAINT PK_HouseholdContacts PRIMARY KEY (HouseholdRef, Role)
);

-- GDPR Art. 6(1)(f) departure marker — retention clock start (ADR-0004).
-- Idempotent: SqlServerFixture applies schema.sql on every integration test run.
IF COL_LENGTH('dbo.HouseholdContacts', 'DepartedAt') IS NULL
    ALTER TABLE dbo.HouseholdContacts ADD DepartedAt datetimeoffset NULL;

-- Owner/renter support: add Role column to existing tables (idempotent).
IF COL_LENGTH('dbo.HouseholdContacts', 'Role') IS NULL
    ALTER TABLE dbo.HouseholdContacts ADD Role nvarchar(10) NOT NULL
        CONSTRAINT DF_HouseholdContacts_Role DEFAULT 'Owner';

-- Migrate PK from single-column (HouseholdRef) to composite (HouseholdRef, Role).
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes i
    INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
    INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
    WHERE i.object_id = OBJECT_ID('dbo.HouseholdContacts')
      AND i.is_primary_key = 1
      AND c.name = 'Role'
)
BEGIN
    ALTER TABLE dbo.HouseholdContacts DROP CONSTRAINT PK_HouseholdContacts;
    ALTER TABLE dbo.HouseholdContacts ADD CONSTRAINT PK_HouseholdContacts PRIMARY KEY (HouseholdRef, Role);
END

-- Pending activation queue: authenticated residents not yet linked to a household.
-- EntraObjectId is the JWT 'oid' claim. FirstSeenAt is set once on INSERT, never updated.
-- Email, DisplayName, EntraObjectId are personal data (R3) — never log their values.
IF OBJECT_ID(N'dbo.PendingSignIns', N'U') IS NULL
CREATE TABLE dbo.PendingSignIns
(
    EntraObjectId  nvarchar(36)  NOT NULL,
    Email          nvarchar(256) NOT NULL,
    DisplayName    nvarchar(256) NOT NULL,
    FirstSeenAt    datetime2(3)  NOT NULL,
    CONSTRAINT PK_PendingSignIns PRIMARY KEY (EntraObjectId)
);

-- Account-to-household link table (set by admin activation in Slice 2).
-- EntraObjectId PK: one account belongs to exactly one household.
-- Multiple OIDs can share one HouseholdRef (family members per apartment).
-- EntraObjectId is personal data (R3) — never log its value.
IF OBJECT_ID(N'dbo.HouseholdLinks', N'U') IS NULL
CREATE TABLE dbo.HouseholdLinks
(
    EntraObjectId  nvarchar(36)   NOT NULL,
    HouseholdRef   nvarchar(128)  NOT NULL,
    Role           nvarchar(10)   NOT NULL
        CONSTRAINT DF_HouseholdLinks_Role DEFAULT 'Owner',
    LinkedAt       datetime2(3)   NOT NULL,
    CONSTRAINT PK_HouseholdLinks PRIMARY KEY (EntraObjectId)
);

-- Add Role to existing HouseholdLinks rows (idempotent upgrade for pre-existing databases).
IF COL_LENGTH('dbo.HouseholdLinks', 'Role') IS NULL
    ALTER TABLE dbo.HouseholdLinks ADD Role nvarchar(10) NOT NULL
        CONSTRAINT DF_HouseholdLinks_Role DEFAULT 'Owner';

-- Household master data: sq.m. per household for fee calculation.
IF OBJECT_ID(N'dbo.Households', N'U') IS NULL
CREATE TABLE dbo.Households
(
    HouseholdRef nvarchar(128) NOT NULL,
    SqMeters     decimal(8, 2) NOT NULL
        CONSTRAINT DF_Households_SqMeters DEFAULT 0,
    CONSTRAINT PK_Households PRIMARY KEY (HouseholdRef)
);

IF OBJECT_ID(N'dbo.Counterparties', N'U') IS NULL
CREATE TABLE dbo.Counterparties (
    Id             uniqueidentifier   NOT NULL,
    Name           nvarchar(256)      NOT NULL,
    Category       nvarchar(100)      NOT NULL,
    ParentCategory nvarchar(100)      NOT NULL,
    VatNumber      nvarchar(64)       NULL,
    Phone          nvarchar(32)       NULL,
    Email          nvarchar(320)      NULL,
    CreatedAt      datetimeoffset(3)  NOT NULL,
    UpdatedAt      datetimeoffset(3)  NOT NULL,
    CONSTRAINT PK_Counterparties PRIMARY KEY (Id)
);
