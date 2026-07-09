# Cost Guardrails

The required run is a bounded training run, not a benchmark.

## Default boundary

- One feature.
- One pass per station.
- Ten station calls maximum.
- Default or cheaper approved model first.
- No background teams.
- No parallel autonomous agents.
- No recursive station calls.
- No enterprise-transformation planning.

## Premium model rule

Premium model max: one named decision, reviewed by a human, with the reason recorded in
`runs/<feature-slug>/cost-log.md`.

Use a premium model only when the decision is narrow enough to name, such as "compare two rollback
options for the release gate." Do not use it to polish every station output.

## Stop conditions

Stop after 10 station calls or the first hard stop.

Also stop when a station:

- asks for secrets, credentials, client-confidential data, or production data;
- attempts a live write;
- starts a broader transformation than `feature.md`;
- cannot explain the current station and named output;
- needs repeated reruns to look polished;
- tries to make a human-owned decision;
- reaches an invalid station slot.

Record the stop in `transcript.md`, `seam-ledger.md`, `human-gates.md`, and `run-record.md`.

## Cost log fields

For each station, record:

- `Status`: `ran`, `skipped`, or `stopped`;
- `Runtime`;
- `Model`;
- `Passes`;
- `Cost/token note`;
- `Premium reason`.
