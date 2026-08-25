# 04 - Task: Rewrite skill contract for report and card links

Type: task
Status: resolved
Blocked by: 03

## Question

Привести контракт скилла к реализованной реальности: в `.agents/skills/ariadne/SKILL.md` заменить неопределённый "ASCII spiral" на определённый артефакт — дерево решений и лог изменений (DEC-RPT-13); в `rules/05-uncertainty.md` переписать раздел про ссылки: вместо запрета per-card путей — обязательные ссылки на `.ariadne/cards/<ID>.md` (gsd: `.planning/ariadne/cards/<ID>.md`) и обязательство агента вызвать `ariadne report` и вложить вывод в ответ (DEC-RPT-01). Проверить согласованность с `rules/agent-rules.md` и depth-modes. Править по `writing-for-agents`.

Блокируется тикетом 03: правила описывают работающую команду, а не план.

## Comments

- `SKILL.md`: "ASCII spiral" заменён на определённый артефакт — дерево решений и лог изменений от `ariadne report` (DEC-RPT-13).
- `rules/05-uncertainty.md`: запрет per-card путей переписан на обязательные ссылки `.ariadne/cards/<ID>.md` (gsd: `.planning/ariadne/cards/<ID>.md`) плюс обязательство вызвать `ariadne report <FRAME-id>` и вложить вывод (DEC-RPT-01).
- Grep по `.agents/skills/ariadne/`: "spiral" — 0 попаданий; "per-card" — 0; остальные "report" (`10-frame.md`, `roles.md`) — английский глагол, не ссылки на команду. В `agent-rules.md` и `depth-modes.md` противоречий нет — не менялись.
- Проверка реальности: `node dist/cli/index.js report FRAME-RPT-001 --json` отработал на живом графе (`.ariadne/reports/001-frame-rpt-001.md`, 17 узлов достижимо, change log 177/277); сгенерированный отчёт удалён после проверки как воспроизводимый артефакт.
- `node dist/cli/index.js gate all --strict` — зелёный.
