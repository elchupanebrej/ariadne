# EVD-peer-repository-harness-patterns: Peer repository harness comparison

- Status: SUPPORTED
- Provenance: MEASURED
- Type: EVD
- Revised: 2026-09-07

## Statement

Primary-source inspection of Matt Pocock Skills, OpenGSD, OpenSpec, and OpenCode demonstrates two reproducible Ariadne gaps—bounded continuation orientation and portable release packaging—while supporting the existing crash-safe attempt seam and falsifying the need for a broader owner-duplicating runtime.

## Payload

```json
{
  "verdict": "SUPPORTED",
  "method": "Static inspection of pinned upstream revisions plus current-worktree call-site, package, CLI, and verification checks",
  "rung": 1,
  "receipt": "docs/research/peer-repository-harness-comparison.md",
  "environment": "Ariadne workspace and disposable shallow clones, 2026-08-30",
  "claim": "EVDREQ-peer-repository-harness-patterns",
  "claim_class": "Architectural boundary",
  "evidence_rung": 1,
  "inputs": [
    "mattpocock/skills@6654f6b60cd9d5be8b54c6fafe44346dabeb3b76",
    "open-gsd/gsd-core@86452da7cb4d23147e850b1758214d9f9b86818d",
    "Fission-AI/OpenSpec@a0ddb60d040c61f4907436a9d91310934b1dda63",
    "anomalyco/opencode@10765ff2a9da8c3b88e4de873aa383a49c318912",
    "current Ariadne worktree"
  ],
  "observations": [
    "Ariadne status exposed 94 frontier nodes but no active frame or recommended next action",
    "OpenSpec returns ordered readiness, dependencies, next steps, instructions, templates, and fixes from one graph contract",
    "OpenGSD uses one compact orientation spine and deterministic resume priority",
    "Matt skills use explicit invocation policy, name-based dependencies, and pointer-only handoff",
    "OpenCode owns sessions, permissions, retries, compaction, and snapshots at the host boundary",
    "Ariadne teach-harness is about 3000 lines with no non-test runtime caller found; generated teach JavaScript is about 31 percent of the dry-run package",
    "The dry-run package lacks README, LICENSE, declaration files, types, and exports metadata",
    "Ariadne verification passed"
  ],
  "receipt_sha256": "89fcf8d0099299d311b82f6fda388f79fe0c7a50133a6fe67c9422b7ad07e82d",
  "limitations": [
    "Static evidence does not prove a production host adapter",
    "Published consumer usage of star-exported teaching APIs was not measured",
    "Package size is a surface proxy, not a performance result"
  ],
  "falsification_result": "No inspected source showed a hard need for Ariadne to own host sessions, workflow scheduling, permissions, retry, compaction, or snapshots; current CLI and package checks reproduced narrower gaps."
}
```
