import { access, chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { detectGsd } from "../../adapters/gsd/detector.js";
import { MERGE_PROTOCOL_VERSION } from "../../merge/three-way.js";
import { hasHelp, type CliIO } from "../workspace.js";

const runFile = promisify(execFile);
const DRIVER_KEY = "merge.ariadne.driver";
const HOOKS_KEY = "core.hooksPath";
const HOOKS_PATH = ".githooks";
const HOOK_NAMES = ["pre-merge-commit", "pre-commit"] as const;
const HOOK_MARKER = "# ariadne-merge-hook-v1";
const HOOK_CONTENT = `#!/bin/sh
${HOOK_MARKER}
if command -v ariadne >/dev/null 2>&1; then
  ariadne merge-sync --stage-derived >&2 || true
fi
exit 0
`;

type Check = { passed: boolean; message: string };

type IntegrationReceipt = {
  passed: boolean;
  graph_path: string;
  protocol_version: number;
  checks: {
    committed_attributes: Check;
    local_driver: Check;
    executable: Check;
    protocol: Check;
    hooks: Check;
  };
  changes?: string[];
  diagnostics?: string[];
};

const SETUP_USAGE = "Usage: ariadne merge-setup [--json]\n";
const DOCTOR_USAGE = "Usage: ariadne merge-doctor [--json]\n";

const git = async (cwd: string, args: string[]): Promise<string> =>
  (await runFile("git", ["-C", cwd, ...args], { encoding: "utf8" })).stdout;

const tryGit = async (
  cwd: string,
  args: string[],
): Promise<string | undefined> => {
  try {
    return await git(cwd, args);
  } catch (error) {
    const code: string | number | undefined = (
      error as { code?: string | number }
    ).code;
    if (code === 1 || code === "1") return undefined;
    throw error;
  }
};

const exists = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

const repositoryRoot = async (cwd: string): Promise<string> =>
  (await git(cwd, ["rev-parse", "--show-toplevel"])).trim();

const graphPathFor = (root: string): string => {
  const storageRoot = detectGsd(root).storageRoot;
  const path = relative(root, join(storageRoot, "GRAPH.jsonl"));
  return path.replaceAll("\\", "/");
};

const shellQuote = (value: string): string =>
  `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;

const cliEntry = async (): Promise<string> => {
  const moduleEntry = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "index.js",
  );
  const sourceEntry = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../../../dist/cli/index.js",
  );
  if (await exists(moduleEntry)) return moduleEntry;
  if (await exists(sourceEntry)) return sourceEntry;
  return moduleEntry;
};

const expectedDriver = async (): Promise<string> =>
  `${shellQuote(process.execPath)} ${shellQuote(await cliEntry())} merge-driver --protocol-version ${MERGE_PROTOCOL_VERSION} %O %A %B`;

const tokenize = (value: string): string[] => {
  const tokens = value.match(/"(?:\\.|[^"])*"|\S+/gu) ?? [];
  return tokens.map((token) => {
    if (!token.startsWith('"') || !token.endsWith('"')) return token;
    return token.slice(1, -1).replaceAll("\\\\", "\\").replaceAll('\\"', '"');
  });
};

const driverShape = (value: string | undefined): Check => {
  if (!value)
    return { passed: false, message: "Local merge driver is missing" };
  const tokens = tokenize(value);
  const expectedTail = [
    "merge-driver",
    "--protocol-version",
    String(MERGE_PROTOCOL_VERSION),
    "%O",
    "%A",
    "%B",
  ];
  if (
    tokens.length !== expectedTail.length + 2 ||
    expectedTail.some((token, index) => tokens[index + 2] !== token)
  ) {
    return {
      passed: false,
      message: `Local merge driver must invoke merge-driver with protocol ${MERGE_PROTOCOL_VERSION} and %O %A %B placeholders`,
    };
  }
  return { passed: true, message: "Local merge driver command is compatible" };
};

const driverIdentity = async (value: string | undefined): Promise<Check> => {
  const shape = driverShape(value);
  if (!shape.passed || !value) return shape;
  const tokens = tokenize(value);
  const expectedEntry = await cliEntry();
  if (tokens[0] !== process.execPath || tokens[1] !== expectedEntry) {
    return {
      passed: false,
      message:
        "Local merge driver must invoke this Ariadne executable and CLI entry point",
    };
  }
  return shape;
};

const executableCheck = async (value: string | undefined): Promise<Check> => {
  const shape = await driverIdentity(value);
  if (!shape.passed || !value) return shape;
  const [command, script] = tokenize(value);
  try {
    if (command.includes("/") || command.includes("\\")) {
      await access(command, constants.X_OK);
    } else {
      await runFile(command, ["--version"], { encoding: "utf8" });
    }
    if (script && (script.includes("/") || script.includes("\\"))) {
      await access(script, constants.F_OK);
    }
    return {
      passed: true,
      message: "Merge driver executable and entry point are available",
    };
  } catch {
    return {
      passed: false,
      message: `Merge driver executable is unavailable: ${command}`,
    };
  }
};

const effectiveAttribute = (
  content: string,
  graphPath: string,
): string | undefined => {
  let result: string | undefined;
  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.replace(/\s+#.*$/u, "").trim();
    if (!line || line.startsWith("#")) continue;
    const [pattern, ...attributes] = line.split(/\s+/u);
    const wildcard =
      pattern.endsWith("/**") && graphPath.startsWith(pattern.slice(0, -2));
    if (
      pattern !== graphPath &&
      pattern !== "*.jsonl" &&
      pattern !== "*" &&
      !wildcard
    )
      continue;
    for (const attribute of attributes) {
      if (attribute.startsWith("merge="))
        result = attribute.slice("merge=".length);
      else if (attribute === "merge") result = "set";
      else if (attribute === "-merge") result = "unset";
    }
  }
  return result;
};

const workingAttribute = async (
  root: string,
  graphPath: string,
): Promise<string | undefined> => {
  const output = await git(root, ["check-attr", "merge", "--", graphPath]);
  const value = output.trim().split(":").at(-1)?.trim();
  return value === "unspecified" ? undefined : value;
};

const committedAttribute = async (
  root: string,
  graphPath: string,
): Promise<Check> => {
  const content = await tryGit(root, ["show", "HEAD:.gitattributes"]);
  if (!content) {
    return { passed: false, message: "Committed .gitattributes is missing" };
  }
  const value = effectiveAttribute(content, graphPath);
  if (value !== "ariadne") {
    return {
      passed: false,
      message: `Committed attributes select ${value ?? "no merge driver"} for ${graphPath}; commit ${graphPath} merge=ariadne before relying on Git integration`,
    };
  }
  const storagePath = relative(root, detectGsd(root).storageRoot).replaceAll(
    "\\",
    "/",
  );
  const generated = [
    { path: `${storagePath}/INDEX.md`, pattern: `${storagePath}/INDEX.md` },
    {
      path: `${storagePath}/cards/placeholder.md`,
      pattern: `${storagePath}/cards/**`,
    },
  ];
  const missing = generated.filter(
    ({ path: target, pattern }) =>
      effectiveAttribute(content, target) !== "ours",
  );
  return missing.length === 0
    ? {
        passed: true,
        message: `Committed attributes select Ariadne for ${graphPath} and generated projections`,
      }
    : {
        passed: false,
        message: `Committed attributes must select merge=ours for generated projections (${missing
          .map(({ pattern }) => pattern)
          .join(", ")})`,
      };
};

const gitDirectory = async (root: string): Promise<string> => {
  const value = (await git(root, ["rev-parse", "--git-dir"])).trim();
  return resolve(root, value);
};

const hookRoot = (root: string, hooksPath: string): string =>
  resolve(root, hooksPath);

const hookIsCompatible = (content: string | undefined): boolean =>
  content?.includes(HOOK_MARKER) ?? false;

const inspectHooks = async (
  root: string,
  hooksPath: string | undefined,
): Promise<Check> => {
  if (hooksPath !== HOOKS_PATH) {
    return {
      passed: false,
      message: `Local ${HOOKS_KEY} must be ${HOOKS_PATH}; existing hook policy was not overwritten`,
    };
  }
  const directory = hookRoot(root, hooksPath);
  for (const name of HOOK_NAMES) {
    const path = join(directory, name);
    try {
      await access(path, constants.X_OK);
      if (!hookIsCompatible(await readFile(path, "utf8"))) {
        return {
          passed: false,
          message: `Existing hook ${hooksPath}/${name} is incompatible`,
        };
      }
    } catch {
      return {
        passed: false,
        message: `Required hook ${hooksPath}/${name} is missing or not executable`,
      };
    }
  }
  return { passed: true, message: `Local ${HOOKS_PATH} hooks are installed` };
};

const committedHooks = async (root: string): Promise<Check> => {
  for (const name of HOOK_NAMES) {
    const content = await tryGit(root, ["show", `HEAD:${HOOKS_PATH}/${name}`]);
    if (!hookIsCompatible(content)) {
      return {
        passed: false,
        message: `Committed ${HOOKS_PATH}/${name} is missing or incompatible`,
      };
    }
  }
  return {
    passed: true,
    message: `Committed ${HOOKS_PATH} hooks are available`,
  };
};

type HookPlan = {
  missing: readonly string[];
  needsPath: boolean;
  changes: string[];
  conflict?: string;
};

const prepareHooks = async (
  root: string,
  existingHooksPath: string | undefined,
): Promise<HookPlan> => {
  if (existingHooksPath && existingHooksPath !== HOOKS_PATH) {
    return {
      missing: [],
      needsPath: false,
      changes: [],
      conflict: `Existing ${HOOKS_KEY} is ${existingHooksPath}. Manual integration: review it and configure ${HOOKS_PATH} only if that preserves the repository's hook policy.`,
    };
  }
  if (!existingHooksPath) {
    const defaultDirectory = await gitDirectory(root);
    for (const name of HOOK_NAMES) {
      if (await exists(join(defaultDirectory, name))) {
        return {
          missing: [],
          needsPath: false,
          changes: [],
          conflict: `Existing .git/hooks/${name} would be bypassed. Manual integration: merge the Ariadne hook into that file or choose an explicit compatible ${HOOKS_KEY}.`,
        };
      }
    }
  }
  const directory = hookRoot(root, HOOKS_PATH);
  const missing: string[] = [];
  for (const name of HOOK_NAMES) {
    const path = join(directory, name);
    if (await exists(path)) {
      if (!hookIsCompatible(await readFile(path, "utf8"))) {
        return {
          missing: [],
          needsPath: false,
          changes: [],
          conflict: `Existing ${HOOKS_PATH}/${name} is incompatible. Manual integration: merge the Ariadne hook into that file without replacing existing policy.`,
        };
      }
      continue;
    }
    missing.push(name);
  }
  return {
    missing,
    needsPath: !existingHooksPath,
    changes: [
      ...missing.map((name) => `${HOOKS_PATH}/${name}`),
      ...(!existingHooksPath ? [HOOKS_KEY] : []),
    ],
  };
};

const applyHooks = async (root: string, plan: HookPlan): Promise<void> => {
  if (plan.missing.length > 0) {
    const directory = hookRoot(root, HOOKS_PATH);
    await mkdir(directory, { recursive: true });
    for (const name of plan.missing) {
      const path = join(directory, name);
      await writeFile(path, HOOK_CONTENT, "utf8");
      await chmod(path, 0o755);
    }
  }
  if (plan.needsPath)
    await git(root, ["config", "--local", HOOKS_KEY, HOOKS_PATH]);
};

const setupAttributes = async (
  root: string,
  graphPath: string,
): Promise<{ changed: boolean; conflict?: string }> => {
  const path = join(root, ".gitattributes");
  const content = (await exists(path)) ? await readFile(path, "utf8") : "";
  const storagePath = relative(root, detectGsd(root).storageRoot).replaceAll(
    "\\",
    "/",
  );
  const entries = [
    { path: graphPath, pattern: graphPath, merge: "ariadne" },
    {
      path: `${storagePath}/INDEX.md`,
      pattern: `${storagePath}/INDEX.md`,
      merge: "ours",
    },
    {
      path: `${storagePath}/cards/placeholder.md`,
      pattern: `${storagePath}/cards/**`,
      merge: "ours",
    },
  ];
  const conflicts = entries
    .map(({ path: target, merge }) => ({
      target,
      merge,
      value: effectiveAttribute(content, target),
    }))
    .filter(({ merge, value }) => value !== undefined && value !== merge);
  if (conflicts.length > 0) {
    return {
      changed: false,
      conflict: `Existing attributes conflict with Ariadne generated-file policy: ${conflicts
        .map(({ target, value }) => `${target}=merge=${value}`)
        .join(
          ", ",
        )}. Manual integration: preserve repository policy or explicitly select Ariadne for the canonical graph and merge=ours for generated projections.`,
    };
  }
  const missing = entries.filter(
    ({ path: target, merge }) => effectiveAttribute(content, target) !== merge,
  );
  if (missing.length === 0) return { changed: false };
  const addition = `${missing.map(({ pattern, merge }) => `${pattern} merge=${merge}`).join("\n")}\n`;
  await writeFile(
    path,
    content.length === 0
      ? addition
      : content.endsWith("\n")
        ? `${content}${addition}`
        : `${content}\n${addition}`,
    "utf8",
  );
  return { changed: true };
};

const summary = (name: string, receipt: IntegrationReceipt): string => {
  const failed = Object.values(receipt.checks)
    .filter(({ passed }) => !passed)
    .map(({ message }) => message);
  const diagnostics = receipt.diagnostics ?? [];
  return `Ariadne ${name} ${receipt.passed ? "passed" : "failed"} for ${receipt.graph_path}; ${[...failed, ...diagnostics].join("; ") || "all checks passed"}\n`;
};

const parseJsonFlag = (args: readonly string[], usage: string): boolean => {
  if (args.some((arg) => arg !== "--json")) throw new Error(usage.trim());
  return args.includes("--json");
};

export async function runMergeSetup(
  args: readonly string[],
  io: CliIO,
): Promise<number> {
  if (hasHelp(args)) {
    io.stdout.write(SETUP_USAGE);
    return 0;
  }
  const json = parseJsonFlag(args, SETUP_USAGE);
  const root = await repositoryRoot(io.cwd);
  const graphPath = graphPathFor(root);
  const currentDriver = await tryGit(root, [
    "config",
    "--local",
    "--get",
    DRIVER_KEY,
  ]);
  const currentHooksPath = (
    await tryGit(root, ["config", "--local", "--get", HOOKS_KEY])
  )?.trim();
  const attributeValue = await workingAttribute(root, graphPath);
  const driver = await driverIdentity(currentDriver);
  const conflicts: string[] = [];
  if (attributeValue && attributeValue !== "ariadne") {
    conflicts.push(
      `Existing attributes select merge=${attributeValue} for ${graphPath}. Manual integration: change that policy to '${graphPath} merge=ariadne' only after reviewing repository policy.`,
    );
  }
  if (currentDriver && !driver.passed) {
    conflicts.push(
      `${driver.message}. Manual integration: update ${DRIVER_KEY} after reviewing the existing command.`,
    );
  }
  const hookPlan = await prepareHooks(root, currentHooksPath);
  if (hookPlan.conflict) conflicts.push(hookPlan.conflict);
  let attributes: { changed: boolean; conflict?: string } = { changed: false };
  if (conflicts.length === 0) {
    attributes = await setupAttributes(root, graphPath);
    if (attributes.conflict) conflicts.push(attributes.conflict);
  }
  const changes: string[] = [];
  if (conflicts.length === 0) {
    if (attributes.changed) changes.push(".gitattributes");
    if (!currentDriver) {
      await git(root, [
        "config",
        "--local",
        DRIVER_KEY,
        await expectedDriver(),
      ]);
      changes.push(DRIVER_KEY);
    }
    await applyHooks(root, hookPlan);
    changes.push(...hookPlan.changes);
  }
  const receipt: IntegrationReceipt = {
    passed: conflicts.length === 0,
    graph_path: graphPath,
    protocol_version: MERGE_PROTOCOL_VERSION,
    checks: {
      committed_attributes: {
        passed: !attributeValue || attributeValue === "ariadne",
        message: attributeValue ?? "missing",
      },
      local_driver: currentDriver
        ? driver
        : { passed: true, message: "Local merge driver will be installed" },
      executable: {
        passed: true,
        message: "Executable check is provided by merge-doctor",
      },
      protocol: {
        passed: true,
        message: `Setup pins protocol ${MERGE_PROTOCOL_VERSION}`,
      },
      hooks: {
        passed: conflicts.length === 0,
        message:
          hookPlan.conflict ?? "Repository-local hooks will be installed",
      },
    },
    changes,
    ...(conflicts.length > 0 ? { diagnostics: conflicts } : {}),
  };
  if (json) io.stdout.write(`${JSON.stringify(receipt)}\n`);
  io.stderr.write(summary("merge setup", receipt));
  return receipt.passed ? 0 : 1;
}

export async function runMergeDoctor(
  args: readonly string[],
  io: CliIO,
): Promise<number> {
  if (hasHelp(args)) {
    io.stdout.write(DOCTOR_USAGE);
    return 0;
  }
  const json = parseJsonFlag(args, DOCTOR_USAGE);
  const root = await repositoryRoot(io.cwd);
  const graphPath = graphPathFor(root);
  const driver = await tryGit(root, ["config", "--local", "--get", DRIVER_KEY]);
  const hooksPath = (
    await tryGit(root, ["config", "--local", "--get", HOOKS_KEY])
  )?.trim();
  const committed = await committedAttribute(root, graphPath);
  const local = driverShape(driver);
  const executable = await executableCheck(driver);
  const hooks = await inspectHooks(root, hooksPath);
  const committedHookCheck = await committedHooks(root);
  const protocol: Check = driver?.includes(
    `--protocol-version ${MERGE_PROTOCOL_VERSION}`,
  )
    ? {
        passed: true,
        message: `Merge protocol ${MERGE_PROTOCOL_VERSION} is pinned independently of package version`,
      }
    : {
        passed: false,
        message: `Merge driver does not pin protocol ${MERGE_PROTOCOL_VERSION}`,
      };
  const receipt: IntegrationReceipt = {
    passed:
      committed.passed &&
      local.passed &&
      executable.passed &&
      protocol.passed &&
      hooks.passed &&
      committedHookCheck.passed,
    graph_path: graphPath,
    protocol_version: MERGE_PROTOCOL_VERSION,
    checks: {
      committed_attributes: committed,
      local_driver: local,
      executable,
      protocol,
      hooks: {
        passed: hooks.passed && committedHookCheck.passed,
        message: `${hooks.message}; ${committedHookCheck.message}`,
      },
    },
  };
  if (json) io.stdout.write(`${JSON.stringify(receipt)}\n`);
  io.stderr.write(summary("merge doctor", receipt));
  return receipt.passed ? 0 : 1;
}

export { DOCTOR_USAGE, SETUP_USAGE };
