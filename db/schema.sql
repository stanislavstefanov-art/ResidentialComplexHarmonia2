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
