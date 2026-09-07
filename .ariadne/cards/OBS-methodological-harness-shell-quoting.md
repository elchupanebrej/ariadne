# OBS-methodological-harness-shell-quoting: Decision mutation batch hit shell quoting

- Status: RESOLVED
- Provenance: FACT
- Type: OBS
- Revised: 2026-09-07

## Statement

A decision-enrichment CLI batch failed before execution because an apostrophe inside a single-quoted JSON payload terminated shell quoting; no graph mutation occurred.

## Payload

```json
{
  "command": "ariadne node remove/add decision enrichment batch",
  "error": "unexpected EOF while looking for matching double quote",
  "workaround": "Rephrased the payload without an apostrophe and reran the complete batch successfully.",
  "impact": "No persisted graph change from the failed attempt; successful retry enriched both decisions.",
  "component": "operator shell invocation"
}
```
