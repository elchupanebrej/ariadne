# DEP-harness-lifecycle-propagation: Harness lifecycle dependency matrix

- Status: ACTIVE
- Provenance: DECIDED
- Type: DEP
- Revised: 2026-09-07

## Statement

Change propagation follows explicit owner boundaries and only reaches consumers whose schema, static, dynamic, deployment, event, or migration contract is touched.

## Payload

```json
{
  "dependencies": [
    "DEC-harness-change-propagation",
    "DEC-harness-compatibility-policy",
    "DEC-harness-feedback-channel"
  ],
  "changed_component": "any Tested Release Bundle component",
  "owner": "changing component owner",
  "authoritative_data_owner": "each component owner owns its versions and compatibility claims; the bundle maintainer owns only the derived tested tuple",
  "coupling_classes": {
    "schema": "Method Contract format, artifact schemas, adapter envelopes, receipt schemas",
    "static": "teaching references, validator imports, CLI/package APIs",
    "dynamic": "kernel-to-adapter lifecycle calls and owner operations",
    "deployment": "exact bundle tuple and host capability set",
    "event": "cursor and lifecycle envelope compatibility",
    "migration": "deprecated bundle drain, dual-readable formats, cleanup receipts"
  },
  "dependency_matrix": {
    "Method Contract normative content": [
      "teaching skills",
      "worked examples",
      "method evaluations",
      "self-application candidates"
    ],
    "Method Contract format or effect surface": [
      "kernel validators",
      "adapters",
      "teaching skills",
      "worked examples",
      "evaluations"
    ],
    "Teaching Skill": [
      "its worked example",
      "clean-session teaching evaluation"
    ],
    "Adapter": [
      "kernel assembly",
      "owner conformance evaluation",
      "host combination claim"
    ],
    "Kernel": [
      "adapter integration",
      "safety evaluation",
      "bundle assembly"
    ],
    "Worked example": [
      "its teaching evaluation only"
    ],
    "Receipt or event schema": [
      "issuing owner",
      "kernel generic gate",
      "affected evaluator"
    ]
  },
  "direct_dependents": [
    "owners named by the Change Impact Receipt"
  ],
  "transitive_dependents": [
    "bundles and evaluations that include an affected direct dependent"
  ],
  "change_radius": "the union of changed owner surface, named consumer boundaries, assembled bundles, and their evidence claims",
  "boundary_contracts": [
    "owners publish versions and compatibility receipts",
    "bundle maintainer checks exact pins and evidence without interpreting semantics",
    "unsupported combinations fail before dispatch"
  ],
  "required_invariants": [
    "one authority per component datum",
    "no shadow normative or owner state",
    "no mandatory release for unaffected components",
    "migration and deployment coupling are explicit"
  ],
  "evidence_requests": [
    "clean-session owner-adapter conformance",
    "bundle compatibility prototype",
    "Rung 8 lifecycle fault injection"
  ]
}
```
