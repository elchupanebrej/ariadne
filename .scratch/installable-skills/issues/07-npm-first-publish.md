# npm account and first publish

Type: task
Blocked by: 05

## Question

Manual work (HITL): make package publication possible and perform it once.

Checklist:
1. The user creates/provides an npm account (2FA per registry requirements).
2. Remove `private: true`, set the chosen name, build and publish (`npm publish --access public`).
3. Record resulting facts: published version, exact package name.

Resolved when `npm view <name>` responds and the version is recorded in the answer.
