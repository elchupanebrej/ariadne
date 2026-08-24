# DEC-RPT-05: Reports persisted as numbered history

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-08-24

## Statement

Выбрано б: отчёты сохраняются в .ariadne/reports/<NN>-<slug>.md как история. Отклонены а (один перезаписываемый файл теряет историю прогонов) и в (без сохранения нельзя пройти путь после исследования).

## Payload

```json
{
  "owner": "human",
  "adversarial_critique": "Риск: неограниченный рост каталога; чистка признана вне рамок этого усилия."
}
```
