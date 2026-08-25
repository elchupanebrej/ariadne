# 05 - Task: Root-relative paths invariant across emitted artifacts

Type: task
Status: resolved

## Question

Провести аудит всех мест, где ariadne пишет или печатает пути наружу (evidence receipts в worktree-manager, operational notices, envelope выводы, ingest сообщения, статусные строки), и нормализовать их к путям относительно корня проекта (DEC-RPT-06). Внутренние fs-операции остаются абсолютными. Тесты: ни один эмитнутый путь не начинается с `/` и не содержит абсолютного префикса репозитория.

Независим от тикетов 01–04, можно делать параллельно.

## Comments

- Аудит мест эмиссии путей наружу (DEC-RPT-06): report.ts уже был root-relative (`cardsPrefix`, `graphPath`, JSON `file`); operational notices и статусные строки путей не содержат; envelope эхо-вывод путей репозитория не добавляет. Исправлены: evidence receipt `worktree_path` в worktree-manager, stdout `storage_root` в `ariadne init`, gsd-проекция (`documents.statePath`/`phaseContextPath`, `source_path` DEC-узлов → также STATE.yaml `gsd_projection.state_path`), markdown-ссылки GRAPH.jsonl в handoff/grill-substrate.
- Один общий хелпер `toRootRelative(root, target)` в `src/core/root-relative.ts` (relative + POSIX-сепараторы), переиспользован во всех местах, включая замену локального `toRepoRelative` в report.ts. Внутренние fs-операции остались абсолютными (дескриптор worktree, чтение документов, пути для записи).
- Тесты: новые проверки формы эмитнутых путей в tests/multiagent/worktree.test.ts, tests/adapters/gsd.test.ts, tests/cli/init-template.test.ts (ожидания переведены с абсолютных на root-relative), tests/adapters/handoff.test.ts. Ни один эмитнутый путь не начинается с `/` и не содержит абсолютного префикса репозитория.
- Проверки: vitest 56 файлов / 577 тестов зелёные; `tsc --noEmit` чисто; свежий билд `tsc -p tsconfig.build.json`; `node dist/cli/index.js gate all --strict` — passed: true, exit 0. Форматы хранения не менялись (GRAPH.jsonl append-only; семантика STATE.yaml прежняя, изменилось только значение поля на относительное).
