# DEC-RPT-09: Tombstoned cards keep their file

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-08-24

## Statement

Выбрано а: при удалении или инвалидации файл карточки сохраняется, шапка обновляется статусом INVALIDATED или REMOVED. Отклонено б (удалять файл) как разрывающее ссылки из лога изменений.

## Payload

```json
{
  "owner": "human",
  "adversarial_critique": "Риск: накопление мёртвых файлов; принят осознанно ради постоянства ссылок."
}
```
