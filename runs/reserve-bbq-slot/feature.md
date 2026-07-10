# Feature: Reserve the shared BBQ zone

Residents share one BBQ zone, booked today on a paper sheet by the entrance plus a
shared spreadsheet — which causes double-bookings and "we both thought we had Saturday"
disputes. This slice lets a resident of the building reserve an available time slot for
the zone, so the same slot can never be held by two households.

## Acceptance criteria
- [ ] A resident can see, for a given day, which BBQ slots are free and which are taken.
- [ ] A resident can reserve a free slot and gets a clear confirmation; the slot then shows as taken.
- [ ] A resident trying to reserve a slot that is already held is refused with a clear "already taken", and the existing reservation is unchanged.
- [ ] If two residents try to reserve the same free slot at the same moment, exactly one succeeds and the other is refused — never both.
- [ ] Only a signed-in resident of the building can view or reserve.