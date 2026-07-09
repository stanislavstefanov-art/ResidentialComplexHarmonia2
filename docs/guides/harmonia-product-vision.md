# Harmonia — Product Vision

> **Purpose of this document.** This is the *business idea* for Harmonia, written to be handed to a
> fresh session or team that knows nothing else about it. It deliberately contains **no technology
> choices** — no stack, no architecture, no data model, no security mechanisms. Those are for the
> delivery process to derive. If you find yourself wanting to write "use X database" or "add an auth
> gate," stop: that decision belongs downstream, and pre-deciding it here defeats the point.

## What to bring alongside this document

This vision is the **what**. To actually build from it you also need:

1. **The build guide** — `build-application-with-ai-factory.md` (the *how*: how to turn an idea into a
   run, scope one thin slice first, drive the stations, and produce the evidence pack).
2. **The learning materials** — `docs/LearningMaterials/` (the *deep reference*). Don't read
   it all up front; load modules on demand per the map at the bottom of this file.

---

## The idea in one line

A simple shared tool that a residential building's residents actually use — replacing the paper
sign-up sheet and shared spreadsheet — and that grows into the residents' association's digital
backbone.

## Where it comes from (the origin pain)

A residential complex has a **shared BBQ zone** that any household can use. Today, booking it runs on
a **paper sign-up sheet** by the entrance and a **shared spreadsheet / chat group**. This breaks in
predictable ways:

- Two households think they both have Saturday evening. Nobody can prove who was first.
- You can't see availability without physically walking to the sheet.
- There's no history, no fairness, no single source of truth.

The same building is run by a **volunteer residents' association** that also collects monthly
maintenance fees and pays shared expenses — today tracked in yet another spreadsheet that only one
person understands. The association wants one trustworthy place for the things the whole building
shares.

## Who it's for

- **Residents** (owners and tenants) — book the shared amenity, later see what they owe and have
  paid, later find a neighbour's contact. Ordinary people, a wide range of ages and comfort with
  technology. They will use it a few times a year, on their phone, with **no training and no manual**.
- **The association board / committee** — volunteers, not IT people. They set the rules, keep the
  money records straight, and answer to the other residents at meetings.
- **The treasurer / cashier** — records fees owed and paid, and shared expenses.

## What it should become (business roadmap)

The value grows in phases. Each phase is a real, separately-useful step — not a big-bang.

- **v1 — Book the shared BBQ zone fairly.** Any resident can see when it's free and reserve it in
  under a minute from their phone. No clashes.
- **Phase 2 — Track the money.** What each household owes in maintenance fees and what they've paid;
  shared expenses and receipts; simple financial summaries the board can show at a meeting.
- **Phase 3 — Member directory.** A trusted place to find a neighbour or a board member's contact.

> A cold run should **not** try to build all of this. Use the guide to scope **one thin vertical
> slice** as the first feature, and build that.

## Business constraints that shape every decision

These are facts about the situation, stated as pains and obligations — **not** as solutions. The
delivery process is responsible for turning each into the right technical control.

- **Near-zero budget.** Nobody is paid to run this. A volunteer association can't carry a monthly
  bill. Running cost has to be negligible, ideally free while the idea is still being proven.
- **Low, spiky usage.** A few dozen households. Bursts around good weather and around meeting time;
  long quiet stretches otherwise.
- **Non-technical users on phones.** It has to be usable cold, with no accounts to chase, no manual,
  no jargon. If a resident needs help to book, it has failed.
- **This is not a public service.** Only actual residents of *this* building should be able to get
  in. Membership is a trust boundary, not an open sign-up.
- **Real personal data, real money.** Names, apartments, contact details, and who-owes-what are
  involved, for residents who live in the EU. Privacy and record-keeping obligations are real and
  non-optional — but *how* they're honoured is a decision to be made, not assumed here.
- **Fairness must be guaranteed, not hoped for.** It must be impossible for the same slot to be
  promised to two households. "We usually don't double-book" is exactly the failure to design out.
- **Money records must be trustworthy.** The history of who was charged and who paid can't silently
  change underneath people; the board has to be able to stand behind it.

## What "done" looks like for v1 (in business terms)

- The paper sheet and the booking spreadsheet are retired — nobody walks to the entrance to book.
- There are no more "we both thought we had Saturday" disputes.
- Any resident can check availability and reserve the zone, on their phone, in under a minute.

## Non-goals (v1)

- Not a payments processor — it records money, it doesn't move it.
- Not a chat/social app.
- Not a public listing or a marketing site.
- No smart-home / device integration.

---

## Learning materials — what they are and when to load them

The reference lives under `docs/LearningMaterials/modules/`. **Load on demand**, not all at
once — reading everything up front will exhaust a session's attention before any work starts. Rough
order of need:

| Module | What it is | When to load |
|--------|------------|--------------|
| `010-onboarding` | One-page orientation to the program. | Once, at the very start, if you've never seen the AI Factory idea. |
| `020-fundamentals` | The core mental model: AI-native vs AI-assisted delivery, *artifacts as the unit of delivery*, the maturity matrix, shared vocabulary, and "the AI factory in depth." | Before your first run. Blocks 2 (SDLC stages / artifacts) and 7 (factory in depth) are the load-bearing ones. |
| `030-ai-factories-and-epam` | Organisational context — how these factories fit a larger org, supply-chain framing, and worked discovery examples. | Optional / skim. Least needed to actually run a build. |
| `1111-assembly-line` | The assembly-line mechanics: how stations chain into a line, the reusable factory template, and a full worked run. | When you're about to wire up and drive the line. |
| `100-consulting-sme` | The Consulting/SME station (opportunity framing). | Just-in-time, when the run reaches station 100. |
| `200-pm-ba` | Product/BA station (specs, acceptance criteria). | At station 200. |
| `300-design` | Design station (flows, states, UX). | At station 300. |
| `400-arch` | Architecture station. | At station 400. |
| `500-eng` | Engineering station. | At station 500. |
| `700-data` | Data station (schema, retention, data policy). | At station 700 (note: the run order does Data before Infra). |
| `800-infra-oper` | Infra / operations station. | At station 800. |
| `900-security` | Security station. | At station 900. |
| `600-qa` | QA station. | Near the **end** of the run — QA runs late in the line, not at "600 = sixth." |
| `1000-management` | Management / delivery station (release, gates, sign-off). | At the final station. |

> The exact station **run order** (which is *not* numeric — Data comes before Infra, QA comes near
> the end) lives in the build guide. Load each station module when the guide's run order reaches it,
> not by number.
