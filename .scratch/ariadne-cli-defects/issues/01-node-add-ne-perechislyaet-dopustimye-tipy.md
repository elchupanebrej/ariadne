# 01 — `ariadne node add` отклоняет тип в нижнем регистре и не перечисляет допустимые типы

**Что не работает:** CLI `ariadne` отвергает тип узла, записанный в нижнем регистре, и при этом ни сообщение об ошибке, ни help не перечисляют допустимые типы. Корректный ввод подбирается перебором.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

## Детали

- **Воспроизведение:** `ariadne node add frame FRAME-2026-09-03-glossary --title "..." --payload '{...}'` → `Error: Unknown node type: frame`. Повтор с верхним регистром `FRAME` проходит.
- **Подтверждено по коду:** проверка — точное сравнение с `NODE_TYPES` (src/cli/commands/node.ts:79); словарь из 21 типа — src/core/types/nodes.ts:1.
- **Реальный словарь типов** (исправляет неверную догадку исходного репорта: `NOT` и `EXP` не существуют): TASK, FRAME, OBS, CLM, HYP, CTR, TRF, SPACE, CAN, UNK, ASM, DEP, DYN, VAL-SELECT, EVDREQ, EVD, VAL, TRANS, DEC, STATE, HANDOFF, LEAN-TASK.
- **Влияние:** агент не может узнать допустимые типы, не грепая исходники; впустую тратятся вызовы.
- **Предлагаемое исправление:** включать `NODE_TYPES.join(", ")` в сообщение об ошибке `Unknown node type` (касается и `node list --type`) и в usage-строку `ariadne node add --help`. Регистронезависимость — опционально; достаточно явно указать требуемый регистр.

## Acceptance criteria

- [x] `ariadne node add <unknown-type> ...` печатает перечень допустимых типов узлов
- [x] Словарь типов виден в help подкоманды `node add`
- [x] Либо типы принимаются регистронезависимо, либо требуемый регистр явно указан в ошибке/help

## Comments

- Перенесено из succubus `.scratch/ariadne-cli-defects/issues/01-node-add-ne-perechislyaet-dopustimye-tipy.md` после валидации (2026-09-03): дефект подтверждён, словарь типов в исходном репорте был неверным — исправлен здесь. Статус поднят до ready-for-agent.
- Fixed (2026-09-03): `Unknown node type` errors (`node add`, `node list --type`) and `node add --help` now enumerate NODE_TYPES from src/core/schemas/nodes.ts and state the uppercase requirement; exact-match validation unchanged.
