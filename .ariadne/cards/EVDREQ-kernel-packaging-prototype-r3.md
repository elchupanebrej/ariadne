# EVDREQ-kernel-packaging-prototype-r3: Prototype kernel packaging and substrate

- Status: RESOLVED
- Provenance: MEASURED
- Type: EVDREQ
- Revised: 2026-09-07

## Statement

Run a deterministic in-memory logic prototype across happy path, crash-after-intent, concurrent resumers, invalid pins, partial tail, direct owner use, and deletion to discriminate the four packaging candidates.

## Payload

```json
{
  "dependencies": [
    "SPACE-kernel-packaging-substrate"
  ],
  "claim": "UNK-kernel-packaging-substrate",
  "candidate": "CAN-colocated-neutral-file-kernel",
  "claim_class": "Deterministic state and lifecycle model",
  "minimum_rung": 3,
  "pass_condition": "Exactly one eligible candidate passes every hard scenario without owner-state pollution or unrequested infrastructure; the thin baseline remains an explicit Rung 6 deletion test.",
  "fail_condition": "No candidate preserves unique disposition and neutrality, or the result depends on unmodeled service behavior.",
  "providers": [
    "Matt prototype skill"
  ],
  "method": "Self-contained HTML with a pure reducer, free play, guided scenarios, visible full state, and embedded deterministic self-check.",
  "inputs": [
    "tickets 03 and 09-12",
    "src/graph/storage.ts",
    "src/harness/controller.ts",
    "package.json"
  ],
  "environment": "browser, in-memory state only",
  "stopping_rule": "Stop after every hard scenario produces a deterministic pass or rejection for each candidate and the self-check verifies those outcomes.",
  "safety": "No filesystem, owner adapter, network, service, or external effect is invoked.",
  "cleanup_rule": "Keep the HTML as a throwaway primary source only; production code receives no prototype shell.",
  "owner": "ticket 13 prototype",
  "deadline": "before ticket 13 decision",
  "resolved_by": "EVD-kernel-packaging-prototype-r3"
}
```
