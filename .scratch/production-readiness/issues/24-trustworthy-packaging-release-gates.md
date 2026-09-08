# 24 — Make Packaging and Release Gates Trustworthy

**What to build:**
Make the package and release workflow enforce the production contract before publication and provide verifiable provenance afterward. The workflow must be self-contained, supply-chain hardened, and consistent with the package surface, benchmark evidence, and clean-consumer behavior.

**Blocked by:** 21, 22, 23

**Status:** ready-for-agent

- [ ] Required release notes exist and are checked before publication.
- [ ] Workflow actions are pinned to immutable commit SHAs.
- [ ] Publication uses the approved OIDC trusted-publishing flow without relying on a long-lived npm token.
- [ ] All required build, typecheck, test, benchmark, tarball, and clean-consumer gates run before publication.
- [ ] The tarball contains only the approved production allowlist and includes the canonical skills.
- [ ] Post-publication checks verify registry availability, dist-tag assignment, CLI execution, and signature evidence.
- [ ] The release evidence bundle is complete, reproducible, and attached to the release.
