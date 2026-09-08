# 17 — Production Release 0.2.0 Cut and Prototype Deprecation Playbook

**What to build:**
The official execution of the Ariadne 0.2.0 production release and deprecation of the 0.1.0 experimental prototype. Curates and finalizes release notes in `CHANGELOG.md`, tags the commit with `v0.2.0`, pushes the tag to GitHub to trigger `.github/workflows/release.yml`, monitors post-publication verification, verifies public npm package availability, asserts `latest` dist-tag resolution, and executes the official npm deprecation notice on `0.1.0`.

**Blocked by:** 16 — OIDC Trusted Release Pipeline and Evidence Automation

**Status:** ready-for-agent

- [ ] Release notes for `0.2.0` are curated, reviewed, and committed to `CHANGELOG.md`.
- [ ] Git tag `v0.2.0` is created and pushed to GitHub repository.
- [ ] Release pipeline execution in `.github/workflows/release.yml` completes green, publishing `ariadne-reasoning@0.2.0` with provenance.
- [ ] Post-publication checks verify registry propagation and dist-tag assignment: `npm dist-tag ls ariadne-reasoning` returns `latest: 0.2.0`.
- [ ] Public execution test succeeds: `npx ariadne-reasoning@0.2.0 --version` exits 0 and outputs `0.2.0`.
- [ ] GitHub Release is verified to contain the uploaded Release Evidence Bundle artifacts.
- [ ] Experimental prototype 0.1.0 is deprecated on npm:
  `npm deprecate ariadne-reasoning@0.1.0 "0.1.0 was an unhardened experimental prototype. Please upgrade to 0.2.0 and run 'ariadne migrate'."`
