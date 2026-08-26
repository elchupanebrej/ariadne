# npm delivery

Type: research
Status: resolved

## Question

Facts about publishing an npm package with a global CLI:

1. Is the name `ariadne` free on the npm registry? If taken — which close variants are free (`ariadne-reasoning`, `@scope/ariadne`, etc.)?
2. npm restrictions on install scripts: what may postinstall scripts of a globally installed package do (writing outside node_modules forbidden/frowned upon?), and what do pnpm/yarn do differently.
3. How established CLIs with an installer subcommand structure their publication (bin, files, engines) — 2–3 real examples.
4. What an account needs for a first publish: 2FA, `--access public`, name verification.

Answer with facts linked to docs.npmjs.com.

## Answer

The npm name `ariadne` is taken by an abandoned 2014 package and unrecoverable; install scripts are blocked by default across modern package managers. Full findings: [docs/research/npm-delivery.md](../../../docs/research/npm-delivery.md) (branch `research/npm-delivery`).

1. **Name**: `ariadne` = dkorolev, v0.1.1, 2014, a Thrift wrapper; transfers only via trademark claims. Free (checked live): `ariadne-reasoning`, `ariadne-cli`, `ariadne-ai`, `ariadnejs`, `ariadne-skills`, `ariadne-agent`, `ariadne-lab`.
2. **Scripts**: npm 12 blocks dependency install scripts by default (`allowScripts`); global installs require `--allow-scripts=`; pnpm ≥10 and Yarn ≥4.14 behave the same. Conclusion: the CLI must work without postinstall.
3. **Practice** (eslint/wrangler/netlify-cli): thin `bin` launcher into a prebuilt `dist`, whitelist in `files`, Node floor in `engines`.
4. **First publish**: verified email + 2FA (or a granular bypass token); pass `--access public` explicitly for scoped packages; published name+version pairs burn forever — verify via `npm view` + `--dry-run`.
