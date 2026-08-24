# 02 - Task: Materialize per-card markdown files

Type: task
Status: open

## Question

В `GraphStorage` при каждой записи узла (в той же транзакции, где пишется INDEX.md) генерировать файл карточки `.ariadne/cards/<ID>.md` из узла графа: шапка со статусом/provenance/датой ревизии, тело statement и payload в читаемом markdown (DEC-RPT-02). При удалении/инвалидации файл сохраняется, обновляется только шапка статуса (DEC-RPT-09). Для уже существующих узлов — разовая регенерация (как regenerateIndex). Gsd-режим пишет в `.planning/ariadne/cards/` (DEC-RPT-12). Тесты на создание, обновление, tombstone и gsd-зеркало.

Критерий готовности: после любого `ariadne node add/update/remove` и `ariadne invalidate` файлы в cards/ согласованы с материализованным графом.
