# Research modern agent harness construction

Type: research
Status: resolved
Blocked by: None
Parent: [Methodological Harness System](../map.md)
Assignee: `research_modern_harnesses`
Research branch: `research/methodological-harness-modern`

## Question

Which current primary-source practices for agent harnesses materially determine context assembly, skill and tool routing, state ownership, artifact contracts, evaluation, observability, failure recovery, security, and lifecycle—and do they support or falsify the need for a new Orchestration Harness rather than the existing skill loader plus Ariadne CLI?

## Comments

- Claimed for AFK research on 2026-08-22.
- Research branch context: `research/methodological-harness-modern` at `23fe5916e3c15297a73799fd527740c710363dc4`.

## Answer

Current primary sources conditionally support a new neutral Orchestration Harness, but only as a minimal kernel for cross-session cursor state, artifact gates, recovery, approval references, replay safety, version pinning, and trace correlation. The skill loader continues to own progressive disclosure; Ariadne owns epistemic state; Matt skills and the tracker own work semantics; the host owns the model/tool loop, sandbox, and native approvals. The runtime remains falsifiable: delete it if the thin baseline passes the same clean-session, resume, approval, replay, artifact, and versioning invariants without hidden human memory.

Research asset: [Modern Agent Harness Construction](/tmp/ariadne-harness-research.iVXYQ2/modern/docs/research/modern-agent-harness-practices.md).
