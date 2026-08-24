# 02 - Task: Materialize per-card markdown files

Type: task
Status: resolved

## Question

В `GraphStorage` при каждой записи узла (в той же транзакции, где пишется INDEX.md) генерировать файл карточки `.ariadne/cards/<ID>.md` из узла графа: шапка со статусом/provenance/датой ревизии, тело statement и payload в читаемом markdown (DEC-RPT-02). При удалении/инвалидации файл сохраняется, обновляется только шапка статуса (DEC-RPT-09). Для уже существующих узлов — разовая регенерация (как regenerateIndex). Gsd-режим пишет в `.planning/ariadne/cards/` (DEC-RPT-12). Тесты на создание, обновление, tombstone и gsd-зеркало.

Критерий готовности: после любого `ariadne node add/update/remove` и `ariadne invalidate` файлы в cards/ согласованы с материализованным графом.

## Comments

- 2026-08-25 (agent): Реализовано в `GraphStorage` (src/graph/storage.ts): `renderCard(node)` рендерит шапку (Status/Provenance/Type/Revised) + Statement + Payload (json-блок остатка полей); запись карточек идёт в `transaction()` сразу после записи INDEX.md под тем же file lock, поэтому все пути (`node add/update/remove`, `invalidate`, `appendEvents`) консистентны автоматически. Разовая регенерация свёрстана в `regenerateIndex()` (вызывается из init). Gsd-зеркало бесплатно: cardsDirectory = `<storageRoot>/cards`, а в gsd-режиме storageRoot = `.planning/ariadne` (DEC-RPT-12, одна логика). Tombstone: файл не удаляется никогда, переписывается с новым статусом REMOVED/INVALIDATED (DEC-RPT-09).
- 2026-08-25 (agent): Тесты tests/graph/cards.test.ts — 5 штук: создание, обновление тела+статуса, tombstone (REMOVED и INVALIDATED), gsd-зеркало `.planning/ariadne/cards`, регенерация для pre-existing узлов. Полный suite 564 passed (55 файлов), tsc --noEmit чисто, `gate all --strict` зелёный.
- 2026-08-25 (agent): Для существующих узлов репо выполнен регенерационный проход — `.ariadne/cards/` (180 карточек) закоммичен по прецеденту INDEX.md (материализованные виды трекаются); содержимое INDEX.md при этом не изменилось.
