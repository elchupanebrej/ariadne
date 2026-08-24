# DEC-RPT-06: Root-relative paths invariant for emitted artifacts

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-08-24

## Statement

Выбрано б репо-vaйд: все артефакты, которые ariadne пишет или печатает, нормализуют пути относительно корня проекта. Отклонено а (только новый отчёт) как оставляющее старые абсолютные пути в evidence и notices.

## Payload

```json
{
  "owner": "human",
  "adversarial_critique": "Риск: внутренние операции fs остаются абсолютными - инвариант касается только выдаваемых наружу строк, иначе ломаются resolve-проверки worktree."
}
```
