# npm delivery research (ticket `02-npm-delivery`)

Researched 2026-08-25 against primary sources: registry.npmjs.org API, docs.npmjs.com, and the
published `package.json` files of well-known CLIs. All registry queries were run live on this date.

## 1. Is the name `ariadne` free?

**No — taken.** Registry metadata for [`ariadne`](https://registry.npmjs.org/ariadne):

- Owner/maintainer: user **dkorolev** (Dima Korolev).
- Description: "A node.js frontend wrapper for Thrift backends."
- Latest version **0.1.1, published 2014-04-23**; first version 2014-01-20. Abandoned for 12+ years
  (registry record last touched 2022-06), but it exists and has a genuine function.
- Can we get the name transferred? Effectively no: npm's
  [Username/Name Disputes policy](https://docs.npmjs.com/policies/disputes) says names are
  first-come-first-served, "**npm does not resolve squatting claims on demand** — we do not transfer
  package… ownership simply because another user wants the name". Only a formal trademark/IP claim
  via [GitHub's trademark policy](https://docs.github.com/en/site-policy/content-removal-policies/github-trademark-policy)
  is acted on. A working 2014 package is not squatting ("squatted" = "no genuine function").

### Nearby names checked live against the registry API (404 = free)

| Name | Status |
|---|---|
| `ariadne-reasoning` | **free** |
| `ariadne-cli` | **free** |
| `ariadne-ai` | **free** |
| `ariadnejs`, `ariadne-skills`, `ariadne-agent`, `ariadne-lab` | **free** |
| `@ariadne/core`, `@ariadne/cli`, `@ariadne/*` | no public packages exist (all E404); whether the *user/org* named `ariadne` is registered could not be verified — npmjs.com profile pages are behind bot protection |

Scoping note ([Scope docs](https://docs.npmjs.com/cli/v11/using-npm/scope)): each npm user/org owns
its scope exclusively, so publishing under your own account or org scope (e.g.
`@yourorg/ariadne`) is always available after creating that user/org.

Name rules to respect ([Package name guidelines](https://docs.npmjs.com/package-name-guidelines)):
lowercase only, descriptive, and an unscoped name must not be spelled similarly to another package
or confuse readers about authorship — relevant when picking an `ariadne-*` variant near the taken one.

## 2. Install-script restrictions for a global CLI package

### What npm documents about lifecycle scripts

[`npm install -g <pkg>`](https://docs.npmjs.com/cli/v11/using-npm/scripts) runs the package's
`preinstall` → `install` → `postinstall` → `prepublish` → `preprepare` → `prepare` → `postprepare`.
Scripts run with the installing user's full permissions, from the package root, in `/bin/sh`
(`cmd.exe` on Windows). npm does not sandbox them.

Official best practices in the same doc:

- "**Don't use `install`. … The only valid use of `install` or `preinstall` scripts is for
  compilation which must be done on the target architecture.**"
- "Inspect the env to determine where to put things" — e.g. honor `NPM_CONFIG_BINROOT`; don't hardcode
  `/usr/local/bin`. I.e., writing outside npm-managed locations is explicitly discouraged.
- "Don't prefix your script commands with `sudo`."

So there is no technical prohibition on writing outside `node_modules`, but it violates documented
best practice, breaks custom-prefix/global-dir setups, and is the classic supply-chain malware vector
(which is exactly why all three major PMs now block such scripts by default — below).

### The big current fact: dependency install scripts are blocked by default everywhere

- **npm 12**: "[Dependency install scripts are blocked by default](https://docs.npmjs.com/cli/v12/commands/npm-approve-scripts)."
  Allowlisting goes through the new `allowScripts` field + `npm approve-scripts` / `npm deny-scripts`.
  Per npm 11.x→12 docs, npm 11.16 warns first, 12.0 blocks (corroborated by
  [Cypress's install docs](https://docs.cypress.io/app/get-started/install-cypress)).
- **pnpm ≥ 10** (Jan 2025): "[Lifecycle scripts of dependencies are not executed during installation by default](https://github.com/pnpm/pnpm/releases/tag/v10.0.0)";
  opt-in via `pnpm.onlyBuiltDependencies` (v10) / `allowBuilds` in `pnpm-workspace.yaml` (v11+),
  or interactively via [`pnpm approve-builds`](https://pnpm.io/cli/approve-builds).
- **Yarn ≥ 4.14**: [`enableScripts` now defaults to `false`](https://yarnpkg.com/configuration/yarnrc#enableScripts) —
  third-party postinstall scripts are not run (workspaces' own scripts still are). Older projects get
  a compat shim (`enableScripts: true` injected for lockfile version < 9); per-package control via
  [`dependenciesMeta.build: false`](https://yarnpkg.com/configuration/manifest#dependenciesMeta).

### Direct consequence for a global CLI

A `postinstall` in a globally installed package is skipped by default on all three PMs unless the
user allowlists it:

- npm: global installs have no project `package.json`, so `npm approve-scripts -g` fails with
  `EGLOBAL`; the user must pass `--allow-scripts=<pkg>` at install time or set
  `allow-scripts=<pkg>` user-level config ([npm approve-scripts doc](https://docs.npmjs.com/cli/v12/commands/npm-approve-scripts)).
- pnpm ≥ 11: use `pnpm add -g --allow-build=<pkg>` or the interactive prompt during global install
  ([pnpm approve-builds](https://pnpm.io/cli/approve-builds)).
- Yarn: user sets `enableScripts: true` (+ preapproval).

**Design implication: the CLI must be fully functional with zero install-time scripts.** Ship
prebuilt JS in the tarball; do anything dynamic lazily on first run instead of in `postinstall`.

## 3. How established CLIs structure their packages

Live-checked `package.json` files (GitHub, main branches, 2026-08-25):

| | [`eslint`](https://github.com/eslint/eslint/blob/main/package.json) | [`wrangler`](https://github.com/cloudflare/workers-sdk/blob/main/packages/wrangler/package.json) | [`netlify-cli`](https://github.com/netlify/cli/blob/main/package.json) |
|---|---|---|---|
| `bin` | `{"eslint": "./bin/eslint.js"}` | `{"wrangler": "./bin/wrangler.js", "wrangler2": …, "cf-wrangler": …}` | `{"netlify": "./bin/run.js", "ntl": "./bin/run.js"}` |
| `engines.node` | `^20.19.0 \|\| ^22.13.0 \|\| >=24` | `>=22.0.0` | `>=22.13.0` |
| `files` | `bin`, `conf`, `lib`, `messages`, LICENSE, README | `bin`, `wrangler-dist`, `miniflare-dist`, `templates`, … | `/bin`, `/scripts`, `/functions-templates`, `/dist` |
| install scripts | none | none (`postinstall`/`prepare` absent) | benign `postinstall`: generates shell autocompletion inside its own package dir |

Common practice extracted:

1. **`bin` maps command name(s) → a thin launcher inside the package**; the real code ships prebuilt
   in the tarball (`lib`/`dist`). No build step at consumer install time. Field reference:
   [package.json#bin](https://docs.npmjs.com/cli/v11/configuring-npm/package-json#bin).
2. **`files` whitelist** keeps the tarball to what's needed (publish doc:
   ["Files included in package"](https://docs.npmjs.com/cli/v11/commands/npm-publish)); if `files` is
   present, only listed entries ship.
3. **`engines` declares the minimum Node** ([package.json#engines](https://docs.npmjs.com/cli/v11/configuring-npm/package-json#engines));
   enforcement is advisory unless the consumer sets `engine-strict`.
4. **Zero reliance on install-time scripts**, except netlify's cosmetic completion generation — which
   is precisely the kind of script modern defaults skip. (`typescript@7.0.2` likewise: just
   `bin.tsc`, `engines >=16.20`, prebuilt output.)

## 4. First-publish requirements

From [Creating a new user account](https://docs.npmjs.com/creating-a-new-npm-user-account),
[About 2FA](https://docs.npmjs.com/about-two-factor-authentication),
[npm publish](https://docs.npmjs.com/cli/v11/commands/npm-publish),
[Scope](https://docs.npmjs.com/cli/v11/using-npm/scope):

- **Account + email verification.** "You must verify your email address in order to publish packages."
- **2FA is required to publish**, in one of two forms: "Publishing to npm requires either: Two-factor
  authentication (2FA) enabled on your account, OR a granular access token with bypass 2FA enabled."
  Default mode is auth-and-writes → `npm publish` prompts for an OTP (or pass `--otp`; CI uses
  granular/automation tokens). From August 2026, bypass-2FA tokens can't perform
  account-identity/governance actions. Optional CI alternative: OIDC trusted publishing +
  provenance ([Trusted publishing](https://docs.npmjs.com/trusted-publishers)).
- **`--access public`**: per the publish doc, `access` now "Default[s] to 'public' for new packages",
  and unscoped packages cannot be restricted anyway. The scope page's older guidance still says to
  pass `--access public` explicitly on the first publish of a scoped package — passing it explicitly
  remains the safe habit (it's a no-op for unscoped). Publishing to an org scope additionally
  requires creating that org first.
- **Name verification before publishing**: check availability with `npm view <name>` (E404 = free;
  this is how §1 was checked) and preview contents with `npm pack --dry-run` /
  `npm publish --dry-run`. Once a name+version is published it can never be reused, even after
  unpublish — so the first publish permanently claims the name.

## Bottom line for shipping the Ariadne skill CLI

1. `ariadne` is unavailable; pick a free variant (`ariadne-reasoning` etc.) or own-scope
   `@<you>/ariadne`. Don't count on ever getting the bare name.
2. Publish a pure static package: `bin` + `files` + `engines`, **no postinstall** — npm 12 / pnpm 10+
   / Yarn 4.14+ would silently skip it anyway.
3. First publish needs: verified email, 2FA (or bypass-2FA granular token), explicit
   `--access public` if scoped.
