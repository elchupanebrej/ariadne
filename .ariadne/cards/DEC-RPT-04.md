# DEC-RPT-04: Change log filtered to decision-relevant events

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-08-24

## Statement

Выбрано а с фильтром: лог изменений включает события решающих типов CAN, DEC, EVD, UNK и инвалидации; каждый шаг = действие, ссылка на карточку и причина. Отклонён вариант без фильтра как шумный.

## Payload

```json
{
  "owner": "human",
  "adversarial_critique": "Риск: фильтр скроет причинную цепочку через узлы вне списка; смягчение - типы фильтра пересматриваются прототипом T1."
}
```
