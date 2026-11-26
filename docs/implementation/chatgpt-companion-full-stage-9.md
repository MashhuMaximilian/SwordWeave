# EGM Stage 9 review of the three-phase SwordWeave build plan

Reviewed 2026-11-23. Scope was implementation readiness for the three phases in the [delivery roadmap](chatgpt-companion-roadmap.md). The agreed product decisions in the companion design were outside the review scope.

## Verdict

The first implementation milestone can start once isolated staging is provisioned. It links two synthetic SwordWeave accounts through a real Clerk development instance and checks identity, scopes, reconnect, denials and write/replay on a disposable fixture.

All three phases now have plans, tool and permission contracts, release cutlines and verification steps. The reviewers found that the drafts fell short of the Stage 9 implementation-readiness standard for the full build. The plans incorporate the design fixes below. The remaining release gates need working staging evidence. This report records the independent review of the drafts and the subsequent document changes.

## Review and resolution

| Fresh-context reviewer | Main findings |
| --- | --- |
| Implementation readiness | The approval challenge, operation lifecycle, fresh authorization at commit, pinned creation graph, PDF and note handoffs, and release cutlines needed explicit contracts. |
| Codebase details | The draft engine still called Clerk browser handlers. Attachment could substitute the effective version. The inspected follower and publication writers bypassed the proposed synchronization. The play reads reconciled storage, and native and pinned Vitality could differ. |
| Style | Shared fields and tool names differed across plans. Some selectors had no source, catalogue continuation could skip results, and the fixture test did not exercise same-client reconnect. |

| Finding | Planning resolution |
| --- | --- |
| Approval, supersession and replay | The roadmap now defines same-origin staging confirmation, a one-time nonce, exact operation binding, idempotent status, dispatch by kind and independent flag checks. It names the tests for an authenticated ChatGPT approval. The operation preserves minimal, typed receipts and the original action result. [Shared contract](chatgpt-companion-roadmap.md#tool-and-approval-contract-across-phases) |
| Current permissions and source versions | Commit uses fresh reads after the operation, character and relevant publishing locks. The plan names participating website writers and requires proof of both orderings. Phase 1 specifies typed draft inputs, dependency order and pin checks at persistence. Catalogue continuation resumes after the last examined row. [Phase 1 plan](chatgpt-companion-phase-1.md) |
| Existing-character edits and proposals | Phase 2 maps authorized occurrence paths to native draft commands, requires Phase 1's actor-aware operations for container changes, and preserves the proposal author's authority on owner approval. The first attachment slice requires the exact reproducible effective pin. Version-only proposals and direct composition or player-directed forks have explicit follow-on gates. [Phase 2 plan](chatgpt-companion-phase-2.md) |
| Play state, consequences and notes | Phase 3 specifies how to project canonical play state without reconciliation writes, how a later commit maps to the native revision, and which actions need owner or editor access. It records native occurrence revisions, permitted source selection, Vitality parity and replay. Phase 2 owns permanent build writes even when they occur during play. [Phase 3 plan](chatgpt-companion-phase-3.md) |
| PDF and release | Phase 1 binds the document to the review and confirms it before authorized browser download. Expiry deletes the normalized plan. A separate reviewed operation is required to append it to the sheet. Release gates distinguish private Free staging from published availability. [Phase 1 PDF plan](chatgpt-companion-phase-1.md#milestone-4-progression-pdf-and-release) |

## Evidence still required

| When | What to verify |
| --- | --- |
| Start of Phase 1 | Select the release SHA, lockfile and isolated runtime. Record the real Clerk callback, issuer, audience, scope behavior and revocation window. Pass same-client reconnect and both actors' authorization tests. |
| Before applying companion changes to real data | Prove a host-authenticated action binds the exact operation to the linked user. If the intended surface lacks that binding, keep its public write group disabled and record the platform limitation. Confirm the private-data notice and provider handling. |
| Before each write rollout | Verify the relevant migration and no-regression paths. Demonstrate revoke-during-wait ordering, exact persisted pins and cost, original author behavior, play revision parity, and read-back after interruption on isolated PostgreSQL. Confirm each kind's authoring parser and persistence adapter on the selected source revision. Keep a write adapter gated if its approved input cannot be reproduced. |
| Before claiming download or account support | Verify an authenticated PDF on the release host, with expiry and wrong-account denials. Test each intended ChatGPT surface and record public directory eligibility separately. |

The Free web experiment established private installation, conversation context, a card, manual recap handoff, a sample browser PDF download, and a synthetic OAuth fixture write and replay. The fixture did not exercise real Clerk, an exact user approval or durable database recovery. [Free-account experiment](chatgpt-companion-free-account-check.md)

This was a planning and review pass.
