# 0001. Hybrid CLI and Agent Skills Architecture

## Context and Decision
Ariadne must operate across diverse agent hosts, with or without GSD and Matt Pocock Skills. We decided to implement Ariadne as a hybrid system: a TypeScript/Node.js engine providing a standalone CLI (`ariadne`) alongside a lightweight progressive-disclosure Agent Skill (`.agents/skills/ariadne/` and `rules/*.md`). 

## Consequences and Trade-offs
- Avoids requiring an always-on background daemon or MCP server while retaining deterministic graph validation, schema checks, and state transitions via the CLI.
- Agent interactions remain token-efficient through two-stage rule loading (root skill index loading specific `rules/*.md` on demand).
- Host environments without Node.js can still interpret the pure Markdown reasoning rules (Mode D fallback), while environments with Node.js gain automated validation and epistemic state management.
