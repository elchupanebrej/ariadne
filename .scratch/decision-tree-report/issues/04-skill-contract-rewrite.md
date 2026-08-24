# 04 - Task: Rewrite skill contract for report and card links

Type: task
Status: open
Blocked by: 03

## Question

Привести контракт скилла к реализованной реальности: в `.agents/skills/ariadne/SKILL.md` заменить неопределённый "ASCII spiral" на определённый артефакт — дерево решений и лог изменений (DEC-RPT-13); в `rules/05-uncertainty.md` переписать раздел про ссылки: вместо запрета per-card путей — обязательные ссылки на `.ariadne/cards/<ID>.md` (gsd: `.planning/ariadne/cards/<ID>.md`) и обязательство агента вызвать `ariadne report` и вложить вывод в ответ (DEC-RPT-01). Проверить согласованность с `rules/agent-rules.md` и depth-modes. Править по `writing-for-agents`.

Блокируется тикетом 03: правила описывают работающую команду, а не план.
