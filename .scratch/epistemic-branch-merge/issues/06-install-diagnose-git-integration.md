# 06 — Install and diagnose Git merge integration safely

**What to build:** Let a repository owner install and verify Ariadne's semantic merge driver locally without overwriting repository policy, changing global Git configuration, or downloading code during merge.

**Blocked by:** 01 — Merge compatible Branch Epistemic Models through Git.

**Status:** ready-for-agent

- [ ] Setup idempotently adds only missing repository attributes and local driver configuration for the canonical Epistemic Graph log.
- [ ] Existing incompatible attributes or driver configuration are left unchanged and reported with exact manual integration guidance.
- [ ] Driver identity pins Merge Protocol Version independently from package version, and incompatible protocol combinations fail before graph output changes.
- [ ] Doctor checks committed attributes, local driver configuration, executable availability, and compatible versions without modifying repository state.
- [ ] A fresh clone without the required local integration fails doctor with an actionable diagnosis before graph-changing work proceeds.
- [ ] Setup and merge never alter global Git configuration, invoke the network, commit, push, or open a pull request.
- [ ] Re-running setup produces no duplicate attributes or configuration and preserves unrelated Git settings.
