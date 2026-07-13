namespace Harmonia.Application.Payments;

public sealed class ListMyPayments(ISession session, IPaymentStore store)
{
    public async Task<ListPaymentsResult> ExecuteAsync(CancellationToken ct = default)
    {
        var ctx = session.Resolve();
        if (ctx is not ({ IsResident: true } or { IsAdmin: true }))
            return new ListPaymentsResult.Refused();
        if (ctx.HouseholdRef is null)
            return new ListPaymentsResult.Refused();

        try
        {
            var payments = await store.ListPaymentsByHouseholdAsync(ctx.HouseholdRef.Value, ct);
            return new ListPaymentsResult.Ok(payments);
        }
        catch (Exception)
        {
            return new ListPaymentsResult.Failed();
        }
    }
}
