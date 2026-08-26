# DEC-RPT-09: Tombstoned cards keep their file

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-08-24

## Statement

Option a chosen: on removal or invalidation the card file is kept, its header updated to INVALIDATED or REMOVED. Option b (delete the file) rejected as breaking links from the change log.

## Payload

```json
{
  "owner": "human",
  "adversarial_critique": "Risk: accumulation of dead files; accepted deliberately for link permanence."
}
```
