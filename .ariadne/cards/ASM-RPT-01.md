# ASM-RPT-01: Why-log reconstructable only if rationale is recorded

- Status: ACTIVE
- Provenance: ASSUMED
- Type: ASM
- Revised: 2026-08-24

## Statement

Лог изменений восстанавливает почему только если причина решения записана в карточке в момент выбора. Все DEC этого диалога вкладывают обоснование в statement.

## Payload

```json
{
  "falsification_conditions": [
    "Появляется DEC без rationale в payload - шаг лога остаётся без объяснения"
  ]
}
```
