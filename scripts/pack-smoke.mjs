// Pack smoke check (ticket 18): npm pack -> clean temporary consumer ->
// npm install <tarball> -> type-check the documented import -> run the
// packaged methodize-harness example checker.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function step(name, fn) {
  console.log(`pack-smoke: ${name}`);
  try {
    fn();
  } catch (err) {
    console.error(`pack-smoke: FAIL (${name})`);
    console.error(err.stdout?.toString() || "");
    console.error(err.stderr?.toString() || err.message);
    process.exit(1);
  }
}

function run(cmd, args, cwd) {
  return execFileSync(cmd, args, { cwd, stdio: "pipe", shell: false });
}

// 1. Pack the current worktree (prepack build runs automatically).
const tmpBase = mkdtempSync(join(tmpdir(), "pack-smoke-"));
const consumer = join(tmpBase, "consumer");
let tarball;
step("npm pack", () => {
  run("npm", ["pack", "--pack-destination", tmpBase], repoRoot);
  const tgz = join(tmpBase, "ariadne-reasoning-0.1.0.tgz");
  if (!existsSync(tgz)) throw new Error(`expected tarball not found: ${tgz}`);
  tarball = tgz;
});

try {
  // 2. Clean temporary consumer project.
  step("clean consumer project", () => {
    rmSync(consumer, { recursive: true, force: true });
    run("mkdir", ["-p", consumer]);
    writeFileSync(
      join(consumer, "package.json"),
      JSON.stringify({ name: "pack-smoke-consumer", private: true, type: "module" }, null, 2),
    );
    writeFileSync(
      join(consumer, "tsconfig.json"),
      JSON.stringify(
        {
          compilerOptions: {
            strict: true,
            noEmit: true,
            target: "es2022",
            module: "esnext",
            moduleResolution: "bundler",
            skipLibCheck: false,
          },
          include: ["index.ts"],
        },
        null,
        2,
      ),
    );
    writeFileSync(
      join(consumer, "index.ts"),
      [
        `import { runCli, createHarnessController, AriadneHarnessController } from "ariadne-reasoning";`,
        ``,
        `const controller: AriadneHarnessController = createHarnessController();`,
        `const cli: typeof runCli = runCli;`,
        `if (typeof cli !== "function" || typeof controller !== "object") {`,
        `  throw new Error("unexpected documented import surface");`,
        `}`,
        ``,
      ].join("\n"),
    );
  });

  // 3. Install the tarball (local file install; no network needed).
  step("npm install tarball", () => {
    run("npm", ["install", tarball, "--no-audit", "--no-fund", "--prefer-offline"], consumer);
    if (!existsSync(join(consumer, "node_modules", "ariadne-reasoning", "package.json"))) {
      throw new Error("ariadne-reasoning missing from consumer node_modules");
    }
  });

  // 4. Type-check the documented import using the repo's own tsc and
  // @types/node (no consumer-side network installs).
  step("type-check documented import", () => {
    const typesDir = join(consumer, "node_modules", "@types");
    mkdirSync(typesDir, { recursive: true });
    cpSync(join(repoRoot, "node_modules", "@types", "node"), join(typesDir, "node"), {
      recursive: true,
    });
    cpSync(join(repoRoot, "node_modules", "undici-types"), join(consumer, "node_modules", "undici-types"), {
      recursive: true,
    });
    run("node", [join(repoRoot, "node_modules", "typescript", "bin", "tsc"), "-p", consumer], consumer);
  });

  // 5. Run the packaged methodize-harness example checker.
  step("packaged methodize-harness checker", () => {
    const checker = join(
      consumer,
      "node_modules",
      "ariadne-reasoning",
      ".agents",
      "skills",
      "methodize-harness",
      "example",
      "check.mjs",
    );
    const out = run("node", [checker], consumer).toString();
    if (!out.includes("All verification checks passed!")) {
      throw new Error(`checker did not report success:\n${out}`);
    }
    console.log(out.trim().split("\n").slice(-1)[0]);
  });

  console.log("pack-smoke: PASS");
} finally {
  rmSync(tmpBase, { recursive: true, force: true });
}
