# Example Run — Meridian Cart Lookup

This is a compact worked reference run of the factory shape. It is not a new reference case and it
does not replace your own running case.

The example runs all ten stations:

- `100 Consulting / SME`
- `200 Product / BA`
- `300 Design`
- `400 Architecture`
- `500 Engineering`
- `700 Data`
- `800 Infra/Ops`
- `900 Security`
- `600 QA`
- `1000 Management / Delivery`

It exposes three useful seams: Product under-supplies Design, Design under-supplies Architecture,
and Security leaves QA needing explicit compliance-approved reason-code behavior.

Use the files here as a model for size and evidence:

- [`feature.md`](feature.md) — the feature that entered the line.
- [`station-registry.yaml`](station-registry.yaml) — example station inventory.
- [`handoff-map.yaml`](handoff-map.yaml) — example handoff graph.
- [`station-specs/`](station-specs/) — the station specs used for this worked example.
- [`transcript.md`](transcript.md) — what each station did.
- [`100-opportunity-brief.md`](100-opportunity-brief.md) — station 100 output.
- [`200-spec.md`](200-spec.md) — station 200 output.
- [`300-design.md`](300-design.md) — station 300 output.
- [`400-architecture.md`](400-architecture.md) — station 400 output.
- [`500-implementation.md`](500-implementation.md) — station 500 output.
- [`700-data-design.md`](700-data-design.md) — station 700 output.
- [`800-infra.md`](800-infra.md) — station 800 output.
- [`900-security-review.md`](900-security-review.md) — station 900 output.
- [`600-test-plan.md`](600-test-plan.md) — station 600 output.
- [`1000-release-plan.md`](1000-release-plan.md) — station 1000 output.
- [`seam-ledger.md`](seam-ledger.md) — three seam findings.
- [`human-gates.md`](human-gates.md) — two gates.
- [`eval-report.md`](eval-report.md) — evidence checks.
- [`cost-log.md`](cost-log.md) — run boundary and model/cost note.
- [`risk-note.md`](risk-note.md) — top risks.
- [`final-recommendation.md`](final-recommendation.md) — pilot recommendation.
- [`run-record.md`](run-record.md) — the run record and seam findings.

The useful point is the seam, not the domain. Your run should name its own weak handoffs.

The station outputs are flattened in this folder for reading. In your own run, write them under
`runs/<feature-slug>/` as the main template describes.
