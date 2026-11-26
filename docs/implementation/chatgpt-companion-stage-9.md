# EGM Stage 9 follow-up for the SwordWeave companion

Reviewed 2026-11-20. The target was the [Phase 1 build plan](chatgpt-companion-phase-1.md) and its [Free-account evidence](chatgpt-companion-free-account-check.md). This was the implementation-readiness stage only.

| Fresh-context reviewer | Result |
| --- | --- |
| Implementation readiness | Completed. The isolated connection spike could start. The full plan still delegated decisions around OAuth, proposal storage, approval and delivery. |
| Codebase details | Completed. Verified specific mismatches in pinned Clerk behavior, Library graph projection, character version selection, per-kind fork entry points, and the migration baseline. |
| Style | Completed. Found ambiguous fixture flags, operation IDs, test commands and the distinction between private staging and public Free availability. |

## Changes made after the review

1. **OAuth and test isolation.** The plan now names the staging-only fixture, exact token and scope checks, active identity mapping, and reconnect behavior. A real Clerk development instance remains the first implementation test. The two committed dependency lockfiles differed in the inspected checkout, so pin and verify the actual release pair.
2. **Catalogue authorization and proposal lifecycle.** The plan now uses a bounded viewer-scoped query, authorizes nested data before matching, and distinguishes stateless preview from the later owner-bound save operation. A single operation ID carries the immutable review through approval, status and retry.
3. **Version pins, forks and recovery.** The plan now points to the collection POST handlers for creation and the existing PATCH handlers for four fork types. It specifies approved pins, source graph rechecks, transaction ordering, atomic receipts and conflict handling. The isolated suite covers permission and version changes, retries, response loss and expiry.
4. **Release and delivery.** The plan now records the migration baseline hazard, separate unit and integration commands, PDF tool and ownership rules, the optional notes path, and the verified versus pending platform behavior. Provider handling and the player notice precede real private-data use.

## Readiness verdict

**Ready to start milestone 1 as an isolated Clerk feasibility implementation.** The Free web experiment established private installation, same-chat handoff, embedded cards and manual recap handoff. After the review, browser checks confirmed the sample PDF download and synthetic OAuth with a protected write, repeat and read-back. Use fictional accounts, complete the first milestone's denial and reconnect checks, and record the actual Clerk issuer, callback mode and supported scopes. [Free-account evidence](chatgpt-companion-free-account-check.md)

**Full Phase 1 implementation readiness remains conditional.** The prior reviews and this follow-up found release-critical behavior that only the staged implementation can establish. Exact integration details remain open for production Clerk claims and revocation, an authenticated in-chat action bound to the reviewed save, extraction and authorization of pinned dependency graphs, the selected migration baseline and host scheduler, and owner-only PDF delivery on the intended surfaces. Keep real account writes disabled until the relevant milestones pass. The current plan reflects the three reviewers' findings. They reviewed the pre-repair plan, so their reviews do not certify the revised design as passing the zero-decision standard or the prototype as production ready.

This follow-up preserves the ten product decisions and the existing EGM review report. Agreed scope · Original EGM review
