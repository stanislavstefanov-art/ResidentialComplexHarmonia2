using Harmonia.Application.MaintenanceFees;
using Harmonia.Domain.MaintenanceFees;
using Harmonia.Domain.Payments;

namespace Harmonia.Application.Payments;

public sealed class GetBalance(
    ISession session,
    IMaintenanceFeeStore feeStore,
    IPaymentStore paymentStore)
{
    public async Task<GetBalanceResult> ExecuteAsync(
        string? period, CancellationToken ct = default)
    {
        var ctx = session.Resolve();
        if (ctx is not ({ IsResident: true } or { IsAdmin: true }))
            return new GetBalanceResult.Refused();

        string label;
        Func<MaintenanceFeeCharge,  bool> chargeFilter;
        Func<MaintenanceFeePayment, bool> paymentFilter;

        if (!string.IsNullOrEmpty(period))
        {
            if (!TryParsePeriod(period))
                return new GetBalanceResult.InvalidPeriod();
            label         = period;
            chargeFilter  = c => c.Period == period;
            paymentFilter = p => p.Period == period;
        }
        else
        {
            var prefix    = $"{DateTime.UtcNow.Year}-";
            label         = $"YTD-{DateTime.UtcNow.Year}";
            chargeFilter  = c => c.Period.StartsWith(prefix);
            paymentFilter = p => p.Period.StartsWith(prefix);
        }

        try
        {
            IReadOnlyList<MaintenanceFeeCharge>  charges;
            IReadOnlyList<MaintenanceFeePayment> payments;

            if (ctx.IsAdmin)
            {
                charges  = await feeStore.ListAllChargesAsync(ct);
                payments = await paymentStore.ListAllPaymentsAsync(ct);
            }
            else
            {
                if (ctx.HouseholdRef is null)
                    return new GetBalanceResult.Refused();
                var hh = ctx.HouseholdRef.Value;
                charges  = await feeStore.ListChargesAsync(hh, ct);
                payments = await paymentStore.ListPaymentsByHouseholdAsync(hh, ct);
            }

            var chargedByHh = charges
                .Where(chargeFilter)
                .GroupBy(c => c.HouseholdRef)
                .ToDictionary(g => g.Key, g => g.Sum(c => c.AmountEur));

            var paidByHh = payments
                .Where(paymentFilter)
                .GroupBy(p => p.HouseholdRef)
                .ToDictionary(g => g.Key, g => g.Sum(p => p.AmountEur));

            var households = chargedByHh.Keys.Union(paidByHh.Keys)
                                        .OrderBy(h => h.Value)
                                        .ToList();

            var lines = households
                .Select(hh =>
                {
                    var charged = chargedByHh.GetValueOrDefault(hh, 0m);
                    var paid    = paidByHh.GetValueOrDefault(hh, 0m);
                    return new BalanceLine(hh, charged, paid, charged - paid);
                })
                .ToList();

            return new GetBalanceResult.Ok(label, lines);
        }
        catch (Exception)
        {
            return new GetBalanceResult.Failed();
        }
    }

    private static bool TryParsePeriod(string period)
    {
        if (period is not { Length: 7 } || period[4] != '-')
            return false;
        return int.TryParse(period[..4], out _)
            && int.TryParse(period[5..], out var month)
            && month is >= 1 and <= 12;
    }
}
