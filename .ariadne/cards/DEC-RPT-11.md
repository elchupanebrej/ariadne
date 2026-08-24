# DEC-RPT-11: Report slug from root frame id

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-08-24

## Statement

Выбрано а: слаг отчёта строится из id корневого FRAME, например 001-frame-login-retry.md. Отклонено б (дата) как не говорящее, какое исследование открыто.

## Payload

```json
{
  "owner": "human",
  "adversarial_critique": "Риск: коллизия NN при параллельных исследованиях одного корня; смягчение - NN глобальный счётчик каталога."
}
```
