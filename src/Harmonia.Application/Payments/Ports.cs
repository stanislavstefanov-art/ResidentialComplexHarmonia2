using Harmonia.Domain;
using Harmonia.Domain.Payments;

namespace Harmonia.Application.Payments;

public abstract record RecordPaymentResult
{
    private RecordPaymentResult() { }
    public sealed record Refused                                    : RecordPaymentResult;
    public sealed record Created(MaintenanceFeePayment Payment)    : RecordPaymentResult;
    public sealed record Duplicate(MaintenanceFeePayment Payment)  : RecordPaymentResult;
    public sealed record Failed                                     : RecordPaymentResult;
}

public abstract record ListPaymentsResult
{
    private ListPaymentsResult() { }
    public sealed record Refused                                             : ListPaymentsResult;
    public sealed record Ok(IReadOnlyList<MaintenanceFeePayment> Payments)  : ListPaymentsResult;
    public sealed record Failed                                              : ListPaymentsResult;
}

public sealed record BalanceLine(
    HouseholdRef HouseholdRef,
    decimal      TotalCharged,
    decimal      TotalPaid,
    decimal      Balance);

public abstract record GetBalanceResult
{
    private GetBalanceResult() { }
    public sealed record Refused                                              : GetBalanceResult;
    public sealed record InvalidPeriod                                        : GetBalanceResult;
    public sealed record Ok(string Label, IReadOnlyList<BalanceLine> Lines)  : GetBalanceResult;
    public sealed record Failed                                               : GetBalanceResult;
}

public interface IPaymentStore
{
    Task<RecordPaymentResult> RecordPaymentAsync(
        MaintenanceFeePayment payment, CancellationToken ct = default);

    Task<IReadOnlyList<MaintenanceFeePayment>> ListPaymentsByHouseholdAsync(
        HouseholdRef householdRef, CancellationToken ct = default);

    Task<IReadOnlyList<MaintenanceFeePayment>> ListAllPaymentsAsync(
        CancellationToken ct = default);
}
