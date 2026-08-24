# 01 - Prototype: ASCII tree and change-log grammar

Type: prototype
Status: resolved

## Question

Как точно выглядит ASCII-грамматика отчёта: дерево от корневого FRAME со всеми узлами, метки типов на рёбрах, промежуточные ответы в узлах, отфильтрованный лог изменений? Сделай дешёвый мокап-рендер на живом графе `.ariadne/GRAPH.jsonl` (можно одноразовым скриптом) и дай человеку отреагировать.

Опирается на: DEC-RPT-03 (весь граф), DEC-RPT-04 (фильтр лога), DEC-RPT-07 (ответы из существующих узлов), DEC-RPT-10 (метки рёбер), CTR-RPT-01/ASM-RPT-02 (читаемость — вот что проверяем).
Результат закрывает пункт фога про JSON-схему: текстовая форма первична, JSON ей следует.

## Answer

Скрипт: `scripts/proto-tree.mjs` (одноразовый, но закоммичен для перезапуска; `node scripts/proto-tree.mjs [--selfcheck]`).

**Грамматика (фиксируется этим прототипом):**

1. **Ориентация.** В живом графе каждое ребро читается «source зависит от / выводится из target», т.е. source — внизу. Дети узла X = источники рёбер с target=X. Корень = узел, который ни разу не встречается как source. Это уточняет формулировку DEC-RPT-08 («корень без входящих структурных рёбер»): буквально она исключила бы FRAME-RPT-001, потому что его собственные решения указывают НА него. Замечание оркестратору: wording DEC-RPT-08 стоит поправить при материализации команды report.
2. **Секции.** Лес по корневым FRAME (DEC-RPT-08), каждая секция = полное поддерево (DEC-RPT-03). Узлы, не достижимые ни от одного FRAME-корня, идут секцией REMAINDER от собственных локальных корней. Повтор узла внутри секции печатается один раз полностью, дальше — заглушка `<id> (rendered above)`.
3. **Строка узла:** `<префикс>``|-- ` или ``` `` `-- `` ``` + `<edge-type>` + ` --> ` + `<ID>` + ` [СТАТУС] ` + обрезанный title. Цель — ≤100 колонок; title обрезается до остатка бюджета (многоточие `\u2026`), при отсутствии места строка остаётся без title.
4. **Метки рёбер** (DEC-RPT-10): полный текст типа связи — `derived_from`, `references`, `depends_on`, `supports`, `satisfies`, `tests`, `answers`, `violates`, `falsifies`. Сокращения не понадобились: полные слова читаются и влезают.
5. **Ответ шага** (DEC-RPT-07): следующей строкой под узлом, с тем же префиксом продолжения, маркер `~ `. Источник ответа из существующего поля узла: UNK → `resolved by <DEC-id>`, иначе `~ UNRESOLVED`; EVD → `verdict: <verdict>`; остальные → первое предложение statement. Отсутствие ответа честно видно (`~ UNRESOLVED`), не маскируется.
6. **Глубина.** При префиксе глубже 24 колонок поддерево закрывается маркером `... ` и продолжает отдельным блоком `-- subtree continued: <type> --> <ID> --` от нулевой колонки после текущего блока. Один известный потолок: единичные строки могут превышать 100 колонок фиксированной частью (длинный id на большой глубине), максимум 107 в живом графе; помечено `ponytail:` в скрипте.
7. **Лог изменений** (DEC-RPT-04): события = аппенды узлов типов CAN/DEC/EVD/UNK плюс переходы в REMOVED/INVALIDATED (tombstone), в файловом (хронологическом) порядке, без фолдинга. Каждый шаг — три строки: `[NNN] <append|TOMBSTONE> <ID> -> <статус>`, ссылка на карточку `.ariadne/cards/<ID>.md`, причина (первое предложение adversarial_critique, иначе statement). Фильтр показал 177 из 277 аппендов (~64%): 165 решающих + 12 tombstones. Карточки ещё не существуют (это тикет 02) — путь печатается по контракту DEC-RPT-02.

**Проверяемая гипотеза CTR-RPT-01/ASM-RPT-02:** полный граф (180 уникальных узлов — крупнее ожидаемых «124+») остаётся читаемым: 1924 строки вывода, все строки в бюджете кроме одной заглушки. Секции + лимиты ширины + дедуп повторов работают. ASM-RPT-02 не фальсифицирован.

### Образец рендера (дерево этого усилия целиком)

```
== TREE 1: FRAME-RPT-001 (17 nodes reachable) ==
FRAME-RPT-001 [ACTIVE] Research decision-tree report artifact
~ По итогам исследования ariadne выдаёт: дерево обхода от поставленной проблемы, промежуточные отве…
|-- references --> ASM-RPT-01 [ACTIVE] Why-log reconstructable only if rationale is recorded
|    ~ Лог изменений восстанавливает почему только если причина решения записана в карточке в момен…
|-- references --> ASM-RPT-02 [ACTIVE] Full-graph ASCII readable at realistic scale
|    ~ Полный граф в ASCII остаётся читаемым при реалистичном размере активных узлов поряд…
|-- references --> CTR-RPT-01 [RESOLVED] Completeness versus readability of full-graph tree
|    ~ Полнота дерева против читаемости ASCII на больших графах.
|-- derived_from --> DEC-RPT-01 [DECIDED] Delivery: CLI renders, skill mandates embedding
|    ~ Выбрано в: отчёт рендерит команда ariadne report детерминированно из графа…
|-- derived_from --> DEC-RPT-02 [DECIDED] Card files materialized per node
|    ~ Выбрано а: при каждой записи узла генерируется файл .ariadne/cards/<ID>.md (как IND…
|-- derived_from --> DEC-RPT-03 [DECIDED] Tree shows full graph
|    ~ Выбрано в: дерево показывает весь граф со всеми узлами, а не только выбранный путь …
|-- derived_from --> DEC-RPT-04 [DECIDED] Change log filtered to decision-relevant events
|    ~ Выбрано а с фильтром: лог изменений включает события решающих типов CAN, DEC, EVD, …
|-- derived_from --> DEC-RPT-05 [DECIDED] Reports persisted as numbered history
|    ~ Выбрано б: отчёты сохраняются в .ariadne/reports/<NN>-<slug>.md как история.
|-- derived_from --> DEC-RPT-06 [DECIDED] Root-relative paths invariant for emitted artifacts
|    ~ Выбрано б репо-vaйд: все артефакты, которые ariadne пишет или печатает, нормализуют…
|-- derived_from --> DEC-RPT-07 [DECIDED] Intermediate answers derived from existing nodes
|    ~ Выбрано а: промежуточный ответ шага выводится из существующих узлов - разрешённый U…
|-- derived_from --> DEC-RPT-08 [DECIDED] Forest by default, single tree by argument
|    ~ Выбрано: без аргумента отчёт рендерит лес всех корневых FRAME, с аргументом - одно де…
|-- derived_from --> DEC-RPT-09 [DECIDED] Tombstoned cards keep their file
|    ~ Выбрано а: при удалении или инвалидации файл карточки сохраняется, шапка обновляетс…
|-- derived_from --> DEC-RPT-10 [DECIDED] Edge types rendered on tree edges
|    ~ Выбрано да: на каждом ребре дерева печатается тип связи, например derived_from или s…
|-- derived_from --> DEC-RPT-11 [DECIDED] Report slug from root frame id
|    ~ Выбрано а: слаг отчёта строится из id корневого FRAME, например 001-frame-login-retry.md.
|-- derived_from --> DEC-RPT-12 [DECIDED] GSD mode mirrors cards and reports
|    ~ Выбрано да: в gsd-режиме карточки и отчёты живут зеркально под .planning/ariadne/cards…
`-- derived_from --> DEC-RPT-13 [DECIDED] ASCII spiral wording replaced by defined artifact
     ~ Выбрано да: упоминание неопределённого ASCII spiral в SKILL.md заменяется определённым…
```

### Глубокое поддерево + re-anchor (TREE 2/REMAINDER, фрагмент)

```
|         |-- violates --> CAN-author-guided-demonstration-evaluation [REJECTED] Author-guided demo…
|         |    ~ Let the methodology author guide a session through the worked examples and judge w…
|         |    `-- references --> VAL-SELECT-clean-session-verification [SELECTED] Select matched c…
|         |         ~ A non-compensatory filter selects matched held-out Clean-Session Runs and rej…
|         |         `-- derived_from --> DEC-clean-session-verification-contract (rendered above)
...
-- subtree continued: derived_from --> DEC-matt-ariadne-adapter-contract --
DEC-matt-ariadne-adapter-contract [PROVISIONAL] Pointer-only Matt and Ariadne adapter contracts
~ Coordinate Matt Pocock Skills and Ariadne through one five-operation pointer-only lifecycle surfa…
|-- depends_on --> CTR-continuity-vs-authority-boundary (rendered above)
|-- depends_on --> DEC-clean-session-verification-contract (rendered above)
`-- references --> OBS-adapter-contract-post-evidence-gate [OBSERVED] Adapter-contract task-local g…
     ~ After lowering the dependency card to the strongest provenance expressible by the current ed…
```

### Лог изменений (фрагмент)

```
== CHANGE LOG (filter: appends of CAN/DEC/EVD/UNK + tombstones; 177 of 277 appends shown) ==
[  2] append UNK-uncertainty-trigger-boundary -> OPEN
       .ariadne/cards/UNK-uncertainty-trigger-boundary.md
       Which observable task signals are sufficient to activate Ariadne before downstream work?
[ 56] append DEC-uncertainty-interaction-contract -> DECIDED
       .ariadne/cards/DEC-uncertainty-interaction-contract.md
       The preflight keeps the substrate in Ariadne, avoids host-specific wrapper coupling, and pre…
[ 80] append UNK-semantic-preflight-placement -> RESOLVED
       .ariadne/cards/UNK-semantic-preflight-placement.md
       Which seam should own candidate-breadth preflight diagnostics: a pure semantic-gate…
[108] TOMBSTONE VAL-SELECT-methodological-harness-defaults -> REMOVED
       .ariadne/cards/VAL-SELECT-methodological-harness-defaults.md
       Layering can become duplicated documentation,Self-application can become circular self-justi…
```

**Конфликты с DEC:** один, мягкий — буквальная формулировка DEC-RPT-08 о корне противоречит фактической ориентации рёбер живого графа (см. п.1); прототип фиксирует рабочее правило, выбор за человеком при реализации T3. Прочие DEC соблюдены; spec.md в каталоге усилия отсутствует (только map.md) — на работу не повлияло.

**Человеческая реакция pending**: orchestrator собирает реакцию на грамматику до T3; этот ответ — материал для реакции, не финальное слово.
