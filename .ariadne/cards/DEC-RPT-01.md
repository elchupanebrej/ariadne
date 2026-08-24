# DEC-RPT-01: Delivery: CLI renders, skill mandates embedding

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-08-24

## Statement

Выбрано в: отчёт рендерит команда ariadne report детерминированно из графа, а правило скилла обязывает агента вызвать её и вложить вывод в ответ. Отклонено а (рендерит только агент) как недетерминированное между сессиями и б (только CLI) как не гарантирующее показ пользователю.

## Payload

```json
{
  "owner": "human",
  "adversarial_critique": "Риск: в хост-режиме без CLI отчёт недоступен; смягчение - правило 05 оставляет ручной ASCII-формат как деградацию."
}
```
