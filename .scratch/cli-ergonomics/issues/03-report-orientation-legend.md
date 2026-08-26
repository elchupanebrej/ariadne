# 03 - Edge orientation legend in report header

Type: task
Status: resolved
Blocked by: none

## What to build

One legend line under the report header explaining the edge direction, e.g.:

```
edges read X --> Y: X depends on / derives from Y
```

Context: an external agent read `reachable` counts and a FRAME landing in the
REMAINDER section as a "renders only supports edges" bug. Traversal follows
all edge types; the confusion is orientation — an edge from a FRAME to an UNK
places the UNK *above* the frame, so those branches never appear beneath a
FRAME-rooted tree. Renderer output beyond the header line and the JSON
summary stay byte-identical.

## Acceptance criteria

- [x] Legend appears once per report in both forest and single-tree modes
- [x] JSON summary unchanged
- [x] Existing render-sequence tests updated only for the new header line

## Comments

### Implementation (2026-08-26)

- Header line `edges read X --> Y: X depends on / derives from Y` added under the graph stats line in `buildReport`; rendered once in both forest and tree modes.
- Test: new case asserts exactly one legend occurrence per mode. JSON summary untouched.
