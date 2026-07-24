// src/Harmonia.Application/PendingSignIn/PendingSignIn.cs
namespace Harmonia.Application.PendingSignIn;

public sealed record PendingSignIn(
    string   EntraObjectId,
    string   Email,
    string   DisplayName,
    DateTime FirstSeenAt);
