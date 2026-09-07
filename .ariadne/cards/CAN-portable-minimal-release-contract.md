# CAN-portable-minimal-release-contract: Portable minimal release contract

- Status: PROPOSED
- Provenance: PROPOSED
- Type: CAN
- Revised: 2026-09-07

## Statement

Publish only intentional typed entry points and portable skills, add package basics and an external pack smoke check, and remove duplicate teaching runtimes after compatibility review.

## Payload

```json
{
  "mechanism_class": "contract-first package and skill surface reduction",
  "operating_principle": "make supported entry points explicit, resolve dependencies by skill name or skill-relative path, and delete runtime code with no supported caller",
  "separation_principle": "System Boundary",
  "state_owner": "Package metadata and each owning skill",
  "system_boundary": "Published package and skill directories",
  "supported_invariants": [
    "direct skill use",
    "portable installation",
    "one authoritative implementation",
    "no new runtime state"
  ],
  "known_violated_constraints": [
    "removing star-exported names may require a major release"
  ],
  "useful_effect": "makes the harness installable and understandable while reducing duplicate surface",
  "harm": "compatibility audit and declaration work are required",
  "change_radius": "package metadata, public exports, skill references, smoke check, and unused teaching modules",
  "failure_modes": [
    "undiscovered consumers import teaching symbols",
    "packed example still relies on repository-root files"
  ],
  "required_evidence_requests": [
    "EVDREQ-peer-repository-harness-patterns"
  ],
  "falsification_predicate": "Reject deletion for any symbol with a supported consumer; reject portability claim if a packed external install cannot run the documented example.",
  "next_check": {
    "claim_class": "Boundary contract",
    "minimum_rung": 6,
    "method": "Install the packed artifact in a clean temporary project, type-check a documented import, and run the packaged skill example."
  },
  "refinement_2026_09_03": "Ticket 14 research: audit complete in docs/research/graph-native-harness-contract.md. teach-* modules have no non-test consumer; package unpublished (ariadne-reasoning free per docs/research/npm-delivery.md), so teaching export trim is safe pre-first-publish and major-only after. Minimum surface: declarations + types, intentional exports map, README, LICENSE, no install scripts, pack smoke check. attempt.ts, controller.ts, release-bundle.ts, self-application.ts are retained thin-path modules."
}
```
