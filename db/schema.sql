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
