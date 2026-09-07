# DEC-artifact-links-target-files: Link artifact references to actual documents

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-09-07

## Statement

Every artifact reference shown to the user must link to the actual persisted document path that can be opened from the dialog. The visible label may be a card ID, but the href must target the real Markdown, YAML, JSONL, or other artifact file; an ID-only reference or invented card path is invalid.

## Payload

```json
{
  "owner": "Human user",
  "decision_basis": [
    "DEC-uncertainty-interaction-contract",
    "User clarification"
  ],
  "acceptance_boundary": "Ticket 02 must verify that every link target exists and opens the document containing the referenced card or state.",
  "unresolved_risks": [
    "Card-level line anchors may be unavailable when many cards share one append-only graph file."
  ],
  "adversarial_critique": "A label-only link looks clickable but does not provide direct document access; linking to a shared graph file preserves truth and direct access, while invented per-card paths violate artifact integrity.",
  "user_confirmation": "The user confirmed all recommended ticket decisions and added the actual-document-target clarification."
}
```
