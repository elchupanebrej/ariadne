import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publicConsumerFixture = join(repoRoot, "tests/fixtures/public-api-consumer");
const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
const packageName = packageJson.name;
const packageVersion = packageJson.version;

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";
const tarCmd = process.platform === "win32" ? "tar.exe" : "tar";
const buildConfig = join(repoRoot, "tsconfig.build.json");
const typeScriptCompiler = join(repoRoot, "node_modules", "typescript", "bin", "tsc");

function step(name, fn) {
  console.log(`pack-smoke: ${name}`);
  try {
    fn();
  } catch (err) {
    console.error(`pack-smoke: FAIL (${name})`);
    console.error(err.message || err);
    process.exit(1);
  }
}

function run(cmd, args, cwd) {
  try {
    return execFileSync(cmd, args, {
      cwd,
      stdio: "pipe",
      shell: false,
      env: process.env,
    });
  } catch (err) {
    const stdout = err.stdout?.toString() || "";
    const stderr = err.stderr?.toString() || "";
    const details = [stdout, stderr, err.message].filter(Boolean).join("\n");
    throw new Error(`Command failed: ${cmd} ${args.join(" ")}\n${details}`);
  }
}

function getPmRunner(name) {
  const bin = process.platform === "win32" ? `${name}.cmd` : name;
  try {
    execFileSync(bin, ["--version"], { stdio: "ignore" });
    return { cmd: bin, prefixArgs: [] };
  } catch {
    return { cmd: npxCmd, prefixArgs: ["--yes", name] };
  }
}

const REQUIRED_FILES = [
  "package/package.json",
  "package/README.md",
  "package/LICENSE",
  "package/dist/index.js",
  "package/dist/index.d.ts",
  "package/dist/cli/index.js",
  "package/.agents/skills/ariadne/SKILL.md",
  "package/.agents/skills/ariadne/example/check.mjs",
  "package/.agents/skills/codebase-design/SKILL.md",
  "package/.agents/skills/codebase-design/example/check.mjs",
  "package/.agents/skills/grilling/SKILL.md",
  "package/.agents/skills/grilling/example/check.mjs",
  "package/.agents/skills/domain-modeling/SKILL.md",
  "package/.agents/skills/domain-modeling/example/check.mjs",
];

const DISALLOWED_PATTERNS = [
  { pattern: /^package\/src(\/|$)/, label: "package/src/**" },
  { pattern: /^package\/tests?(\/|$)/, label: "package/tests/** or package/test/**" },
  { pattern: /^package\/tsconfig.*\.json$/, label: "package/tsconfig*.json" },
  { pattern: /^package\/vitest\.config\.ts$/, label: "package/vitest.config.ts" },
  { pattern: /^package\/\.github(\/|$)/, label: "package/.github/**" },
  { pattern: /^package\/\.scratch(\/|$)/, label: "package/.scratch/**" },
  { pattern: /^package\/\.planning(\/|$)/, label: "package/.planning/**" },
  { pattern: /^package\/scripts(\/|$)/, label: "package/scripts/**" },
  { pattern: /^package\/\.agents\/skills\/methodize-harness(\/|$)/, label: "package/.agents/skills/methodize-harness/**" },
];

const ALLOWED_PATTERNS = [
  /^package\/package\.json$/,
  /^package\/README\.md$/,
  /^package\/LICENSE$/,
  /^package\/dist\//,
  /^package\/\.agents\/skills\/ariadne\//,
  /^package\/\.agents\/skills\/codebase-design\//,
  /^package\/\.agents\/skills\/grilling\//,
  /^package\/\.agents\/skills\/domain-modeling\//,
];

const tmpBase = mkdtempSync(join(tmpdir(), "ariadne-pack-smoke-"));
let tarball = "";

try {
  // 1. Pack the project
  step("npm pack", () => {
    // Build through the current Node executable, then skip npm's lifecycle
    // hooks so a broken parent-directory `node` shim cannot change the pack
    // result or hide the actual packaging verification.
    run(process.execPath, [typeScriptCompiler, "-p", buildConfig], repoRoot);
    run(npmCmd, ["pack", "--ignore-scripts", "--pack-destination", tmpBase], repoRoot);
    const tgz = join(tmpBase, `${packageName.replace("/", "-")}-${packageVersion}.tgz`);
    if (!existsSync(tgz)) {
      throw new Error(`expected tarball not found: ${tgz}`);
    }
    tarball = tgz;
  });

  // 2. Tarball Allowlist & Zero-Leakage Validator
  step("tarball allowlist and zero-leakage validator", () => {
    const rawOutput = run(tarCmd, ["-tzf", tarball], repoRoot).toString();
    const entries = rawOutput
      .split("\n")
      .map((line) => line.trim().replace(/^\.\//, ""))
      .filter(Boolean);

    // Required files check
    for (const req of REQUIRED_FILES) {
      if (!entries.includes(req)) {
        throw new Error(`Tarball missing required file: ${req}`);
      }
    }

    // Zero-leakage check
    for (const entry of entries) {
      for (const { pattern, label } of DISALLOWED_PATTERNS) {
        if (pattern.test(entry)) {
          throw new Error(`Tarball zero-leakage violation: found disallowed file matching "${label}": ${entry}`);
        }
      }

      // Strict allowlist check
      const isAllowed = ALLOWED_PATTERNS.some((pat) => pat.test(entry));
      if (!isAllowed) {
        throw new Error(`Tarball allowlist violation: file not permitted by strict allowlist: ${entry}`);
      }
    }

    console.log(`  Tarball verified cleanly (${entries.length} entries matching allowlist)`);
  });

  // 3. Clean Consumer Installation Smoke (npm)
  step("clean consumer smoke (npm)", () => {
    const consumerNpm = join(tmpBase, "consumer-npm");
    mkdirSync(consumerNpm, { recursive: true });
    writeFileSync(
      join(consumerNpm, "package.json"),
      JSON.stringify({ name: "clean-consumer-npm", type: "module" }, null, 2),
    );

    // Install tarball
    run(npmCmd, ["install", tarball, "--no-audit", "--no-fund", "--prefer-offline"], consumerNpm);

    // CLI binary test
    const cliOutput = run(npxCmd, ["ariadne", "--version"], consumerNpm).toString().trim();
    if (cliOutput !== packageVersion) {
      throw new Error(`npx ariadne --version returned "${cliOutput}", expected "${packageVersion}"`);
    }

    // Runtime Node import test
    const testImportScript = join(consumerNpm, "test-import.mjs");
    writeFileSync(testImportScript, readFileSync(join(publicConsumerFixture, "index.mjs")));
    run(process.execPath, [testImportScript], consumerNpm);

    // 4 canonical skills test
    const canonicalSkills = ["ariadne", "codebase-design", "grilling", "domain-modeling"];
    for (const skill of canonicalSkills) {
      const checker = join(
        consumerNpm,
        "node_modules",
        ...packageName.split("/"),
        ".agents",
        "skills",
        skill,
        "example",
        "check.mjs",
      );
      if (!existsSync(checker)) {
        throw new Error(`Missing canonical skill checker: ${checker}`);
      }
      const out = run(process.execPath, [checker], consumerNpm).toString();
      if (!out.includes("All verification checks passed!")) {
        throw new Error(`Skill ${skill} check failed:\n${out}`);
      }
    }

    // Typecheck using tsc --noEmit
    writeFileSync(
      join(consumerNpm, "index.ts"),
      readFileSync(join(publicConsumerFixture, "index.ts")),
    );

    writeFileSync(
      join(consumerNpm, "tsconfig.json"),
      JSON.stringify(
        {
          compilerOptions: {
            strict: true,
            noEmit: true,
            target: "es2022",
            module: "nodenext",
            moduleResolution: "nodenext",
            skipLibCheck: false,
          },
          include: ["index.ts"],
        },
        null,
        2,
      ),
    );

    const typesDir = join(consumerNpm, "node_modules", "@types");
    mkdirSync(typesDir, { recursive: true });
    cpSync(join(repoRoot, "node_modules", "@types", "node"), join(typesDir, "node"), { recursive: true });
    if (existsSync(join(repoRoot, "node_modules", "undici-types"))) {
      cpSync(join(repoRoot, "node_modules", "undici-types"), join(consumerNpm, "node_modules", "undici-types"), { recursive: true });
    }

    const tscBin = join(repoRoot, "node_modules", "typescript", "bin", "tsc");
    run(process.execPath, [tscBin, "--noEmit", "-p", consumerNpm], consumerNpm);
  });

  // 4. Multi-Package-Manager Smoke (pnpm)
  step("clean consumer smoke (pnpm)", () => {
    const consumerPnpm = join(tmpBase, "consumer-pnpm");
    mkdirSync(consumerPnpm, { recursive: true });
    writeFileSync(
      join(consumerPnpm, "package.json"),
      JSON.stringify({ name: "clean-consumer-pnpm", type: "module" }, null, 2),
    );

    const pnpmRunner = getPmRunner("pnpm");
    run(pnpmRunner.cmd, [...pnpmRunner.prefixArgs, "add", tarball], consumerPnpm);

    const pnpmCliOutput = run(npxCmd, ["ariadne", "--version"], consumerPnpm).toString().trim();
    if (pnpmCliOutput !== packageVersion) {
      throw new Error(`pnpm: npx ariadne --version returned "${pnpmCliOutput}", expected "${packageVersion}"`);
    }
  });

  // 5. Multi-Package-Manager Smoke (yarn)
  step("clean consumer smoke (yarn)", () => {
    const consumerYarn = join(tmpBase, "consumer-yarn");
    mkdirSync(consumerYarn, { recursive: true });
    writeFileSync(
      join(consumerYarn, "package.json"),
      JSON.stringify({ name: "clean-consumer-yarn", type: "module" }, null, 2),
    );
    writeFileSync(join(consumerYarn, ".yarnrc.yml"), "nodeLinker: node-modules\n");
    writeFileSync(join(consumerYarn, ".yarnrc"), "--install.ignore-engines true\n");

    const yarnRunner = getPmRunner("yarn");
    run(yarnRunner.cmd, [...yarnRunner.prefixArgs, "add", tarball, "--ignore-engines"], consumerYarn);

    const yarnCliOutput = run(npxCmd, ["ariadne", "--version"], consumerYarn).toString().trim();
    if (yarnCliOutput !== packageVersion) {
      throw new Error(`yarn: npx ariadne --version returned "${yarnCliOutput}", expected "${packageVersion}"`);
    }
  });

  console.log("pack-smoke: ALL SMOKE TESTS PASSED");
} finally {
  rmSync(tmpBase, { recursive: true, force: true });
}
