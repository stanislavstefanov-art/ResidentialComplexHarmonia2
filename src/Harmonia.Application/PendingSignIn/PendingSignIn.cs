namespace Harmonia.Application.PendingSignIn;

public sealed record PendingSignIn(
    string          EntraObjectId,
    string          Email,
    string          DisplayName,
    DateTimeOffset  FirstSeenAt);
