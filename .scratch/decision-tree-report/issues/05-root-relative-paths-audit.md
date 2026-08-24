# 05 - Task: Root-relative paths invariant across emitted artifacts

Type: task
Status: open

## Question

Провести аудит всех мест, где ariadne пишет или печатает пути наружу (evidence receipts в worktree-manager, operational notices, envelope выводы, ingest сообщения, статусные строки), и нормализовать их к путям относительно корня проекта (DEC-RPT-06). Внутренние fs-операции остаются абсолютными. Тесты: ни один эмитнутый путь не начинается с `/` и не содержит абсолютного префикса репозитория.

Независим от тикетов 01–04, можно делать параллельно.
