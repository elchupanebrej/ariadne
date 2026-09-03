# 02 — `ariadne edge add` не перечисляет допустимые связи ни в ошибке, ни в help

**Что не работает:** CLI `ariadne` отвергает неизвестные имена связей сообщением `Invalid edge relation: <rel>`, которое не перечисляет допустимые связи; словаря связей нет ни в help, ни в docs. Обнаруживаемость словаря — только чтением исходников.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

## Детали

- **Воспроизведение:** `ariadne edge add X raises Y` → `Error: Invalid edge relation: raises` (src/cli/commands/edge.ts:57, src/graph/epistemic-graph.ts:293).
- **Реальный словарь — 12 связей** (исправляет исходный репорт, утверждавший, что «принимаются только `depends_on` и `references`»): supports, contradicts, depends_on, derived_from, answers, tests, falsifies, invalidates, satisfies, violates, supersedes, references (src/core/schemas/edges.ts:9) + алиасы `depends-on`/`dependsOn`/`derived-from`/`derivedFrom`.
- **Почему брутфорс исходного репортёра дал ложный вывод:** помимо проверки имени связи действует контракт конечных точек (EDGE_ENDPOINT_CONTRACTS, src/core/schemas/edges.ts:78) — валидное имя связи с несовместимой парой типов узлов отклоняется с *другим* сообщением. Например, из FRAME в FRAME работают supports, contradicts, depends_on, derived_from, supersedes, references.
- **Уточнение влияния:** «FRAME порождает UNK» выразимо — `depends_on` разрешён FRAME→UNK; `raises` как отдельная связь словарём не предусмотрена.
- **Предлагаемое исправление:** включать `EDGE_TYPES.join(", ")` в сообщение `Invalid edge relation` и в usage `ariadne edge add --help`. Расширение словаря (`raises`, `contradicts`, `supports` — первые два уже есть/покрыты) — отдельное решение, не часть этого дефекта.

## Acceptance criteria

- [x] `ariadne edge add X <unknown-rel> Y` печатает перечень допустимых связей
- [x] Словарь связей виден в help подкоманды `edge add`
- [x] Ошибка при нарушении контракта конечных точек отличима от ошибки неизвестного имени связи

## Comments

- Перенесено из succubus `.scratch/ariadne-cli-defects/issues/02-edge-add-ne-perechislyaet-dopustimye-svyazi.md` после валидации (2026-09-03): ядро дефекта (обнаруживаемость) подтверждено, но факты о словаре связей и «невыразимости FRAME→UNK» были неверными — исправлены здесь. Статус поднят до ready-for-agent.
- Fixed (2026-09-03): `unknownEdgeRelation` helper in `src/core/schemas/edges.ts` (built from `EDGE_TYPES`) reused at all three throw sites (`edge add`/`remove` via `EpistemicGraph.addEdge`/`removeEdge`, `edge list --relation`); `edge add --help` now lists the dictionary. Endpoint-contract errors via `EdgeSchema.parse` untouched.
