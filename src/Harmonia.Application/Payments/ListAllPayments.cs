namespace Harmonia.Application.Payments;

public sealed class ListAllPayments(ISession session, IPaymentStore store)
{
    public async Task<ListPaymentsResult> ExecuteAsync(CancellationToken ct = default)
    {
        var ctx = session.Resolve();
        if (ctx is not { IsAdmin: true })
            return new ListPaymentsResult.Refused();

        try
        {
            var payments = await store.ListAllPaymentsAsync(ct);
            return new ListPaymentsResult.Ok(payments);
        }
        catch (Exception)
        {
            return new ListPaymentsResult.Failed();
        }
    }
}
