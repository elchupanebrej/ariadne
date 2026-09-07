# DEC-harness-version-identity: Use owner-native versions and immutable bundle labels

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-08-24

## Statement

Each owner uses its native version identity plus a byte digest; the Method Contract retains semantic content version and format major, packages may use SemVer, examples and receipts use schema versions and digests, and the Tested Release Bundle reuses immutable b_n labels that carry no compatibility promise.

## Payload

```json
{
  "dependencies": [
    "DEC-harness-release-topology",
    "DEC-staged-fixed-point-contract"
  ],
  "owner": "user",
  "decision_basis": "One forced version scheme would add false coupling; exact digests and a tested bundle already provide reproducibility.",
  "invariants": [
    "every loaded artifact is digest-pinned",
    "bundle labels are provenance keys rather than semantic ranges",
    "compatibility is explicit evidence rather than inferred from matching labels"
  ],
  "adversarial_critique": [
    "Owner-native versions are not directly comparable; compatibility therefore comes only from exact tested tuples and digests."
  ]
}
```
