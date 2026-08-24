# 03 - Task: ariadne report command

Type: task
Status: open
Blocked by: 01, 02

## Question

Реализовать `ariadne report [FRAME-id] [--json]`: без аргумента лес всех корней, с аргументом одно дерево (DEC-RPT-08); рёбра с типами связи (DEC-RPT-10); промежуточные ответы из разрешённых UNK / вердиктов EVD / обоснований DEC (DEC-RPT-07); лог изменений по фильтру CAN/DEC/EVD/UNK/инвалидации с шагами действие-причина-ссылка (DEC-RPT-04); ссылки на `.ariadne/cards/<ID>.md`; запись в `.ariadne/reports/<NN>-<slug из FRAME>.md` (DEC-RPT-05, DEC-RPT-11); все пути корне-относительные (DEC-RPT-06); gsd-зеркало (DEC-RPT-12). Формат — утверждённый прототипом 01. Тесты по каждому пункту.

Критерий готовности: на текущем живом графе команда выдаёт читаемый отчёт, включая дерево от FRAME-RPT-001 с DEC-RPT-01..13.
