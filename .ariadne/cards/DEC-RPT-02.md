# DEC-RPT-02: Card files materialized per node

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-08-24

## Statement

Выбрано а: при каждой записи узла генерируется файл .ariadne/cards/<ID>.md (как INDEX.md), ссылки ведут на него; запрет выдуманных per-card путей в правиле 05 переписывается. Отклонены б (якоря на строки GRAPH.jsonl хрупки при компакции) и в (ссылка на общий граф не даёт пути карточки).

## Payload

```json
{
  "owner": "human",
  "adversarial_critique": "Риск: рассинхрон файла и журнала при сбое; смягчение - материализация внутри той же транзакции storage и регенерация как у INDEX."
}
```
