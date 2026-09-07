# DEC-RPT-05: Reports persisted as numbered history

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-09-07

## Statement

Option b chosen: reports persist under .ariadne/reports/<NN>-<slug>.md as history. Options a (one overwritable file loses run history) and c (without persistence the path cannot be re-walked after the investigation) rejected.

## Payload

```json
{
  "owner": "human",
  "adversarial_critique": "Risk: unbounded directory growth; cleanup acknowledged out of scope for this effort."
}
```
