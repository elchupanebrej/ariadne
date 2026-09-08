import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import net from "node:net";
import { execSync } from "node:child_process";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  canonicalizePath,
  isContainedPath,
  assertContainedPath,
  assertRegularFileOrDirectory,
  isSafeForceTarget,
  assertSafeForceTarget,
  assertContainedStorageTarget,
} from "../../src/core/containment.js";
import {
  executeCommand,
  redactSecrets,
  DEFAULT_TIMEOUT_MS,
  MAX_OUTPUT_BYTES,
  TRUNCATION_WARNING_BANNER,
} from "../../src/core/exec.js";
import { AriadneError } from "../../src/core/errors.js";
import {
  stageAndSwapProjection,
  appendCanonicalRecord,
  createFrame,
  getAttemptLedgerPath,
} from "../../src/graph/journal.js";

describe("Scenario Suite 3: Security & Containment", () => {
  let tempDir: string;
  let storageRoot: string;
  let outsideDir: string;

  beforeEach(() => {
    tempDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "ariadne-security-scenario-")));
    storageRoot = path.join(tempDir, "workspace", ".ariadne");
    outsideDir = path.join(tempDir, "outside");

    fs.mkdirSync(storageRoot, { recursive: true });
    fs.mkdirSync(outsideDir, { recursive: true });
    fs.mkdirSync(path.join(storageRoot, "cards"), { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("Storage Containment Boundary & Traversal Defense", () => {
    it("rejects path traversal escapes using ../ with AriadneError(PATH_ESCAPE)", () => {
      const escapingPaths = [
        path.join(storageRoot, "..", "outside-file.txt"),
        path.join(storageRoot, "cards", "..", "..", "outside-file.txt"),
        path.join(storageRoot, "..", "..", "..", "etc", "passwd"),
        path.join(storageRoot, "cards", "..", "..", "..", "root-secret.json"),
      ];

      for (const targetPath of escapingPaths) {
        expect(isContainedPath(storageRoot, targetPath)).toBe(false);

        expect(() => assertContainedPath(storageRoot, targetPath)).toThrow(AriadneError);
        try {
          assertContainedPath(storageRoot, targetPath);
        } catch (err) {
          expect(err).toBeInstanceOf(AriadneError);
          const aError = err as AriadneError;
          expect(aError.code).toBe("PATH_ESCAPE");
          expect(aError.repair).toBe("Ensure all paths and symlinks reside within the designated storage root.");
        }
      }
    });

    it("rejects sibling directory sharing name prefix with storage root", () => {
      const siblingDir = `${storageRoot}-evil`;
      fs.mkdirSync(siblingDir, { recursive: true });
      const target = path.join(siblingDir, "stolen-data.json");

      expect(isContainedPath(storageRoot, target)).toBe(false);
      expect(() => assertContainedPath(storageRoot, target)).toThrow(AriadneError);

      try {
        assertContainedPath(storageRoot, target);
      } catch (err) {
        expect((err as AriadneError).code).toBe("PATH_ESCAPE");
      }
    });

    it("fails closed with PATH_ESCAPE when storage APIs attempt path escape", async () => {
      const escapingTarget = path.join(storageRoot, "..", "escaped-stage.yaml");

      // Attempting stageAndSwapProjection outside storage root
      await expect(
        stageAndSwapProjection(storageRoot, escapingTarget, "escaped: true"),
      ).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(AriadneError);
        expect((err as AriadneError).code).toBe("PATH_ESCAPE");
        return true;
      });

      // Attempting getAttemptLedgerPath traversal
      expect(() => getAttemptLedgerPath(storageRoot, "../malicious-attempt")).toThrow(AriadneError);
      try {
        getAttemptLedgerPath(storageRoot, "../malicious-attempt");
      } catch (err) {
        expect((err as AriadneError).code).toBe("INVALID_INPUT");
      }
    });

    it("allows relative and ../ traversals that resolve strictly inside storage root", () => {
      const safeRelative = path.join(storageRoot, "cards", "..", "STATE.yaml");
      expect(isContainedPath(storageRoot, safeRelative)).toBe(true);

      const canonical = assertContainedPath(storageRoot, safeRelative);
      expect(canonical).toBe(path.join(storageRoot, "STATE.yaml"));
    });
  });

  describe("External Symlink Rejection & Cycle Defense", () => {
    it("rejects symlink pointing to external directory with AriadneError(PATH_ESCAPE)", () => {
      const externalTargetDir = path.join(outsideDir, "external-folder");
      fs.mkdirSync(externalTargetDir, { recursive: true });

      const symlinkInStorage = path.join(storageRoot, "sym-external-dir");
      fs.symlinkSync(externalTargetDir, symlinkInStorage);

      const leakTarget = path.join(symlinkInStorage, "secret.txt");

      expect(isContainedPath(storageRoot, leakTarget)).toBe(false);
      expect(() => assertContainedPath(storageRoot, leakTarget)).toThrow(AriadneError);

      try {
        assertContainedPath(storageRoot, leakTarget);
      } catch (err) {
        expect(err).toBeInstanceOf(AriadneError);
        const aError = err as AriadneError;
        expect(aError.code).toBe("PATH_ESCAPE");
        expect(aError.detail).toBeDefined();
        expect(aError.detail?.storageRoot).toBe(storageRoot);
      }
    });

    it("rejects symlink pointing to external file with AriadneError(PATH_ESCAPE)", () => {
      const externalFile = path.join(outsideDir, "external-secret.env");
      fs.writeFileSync(externalFile, "SECRET_KEY=12345\n", "utf8");

      const symlinkFile = path.join(storageRoot, "sym-secret.env");
      fs.symlinkSync(externalFile, symlinkFile);

      expect(isContainedPath(storageRoot, symlinkFile)).toBe(false);
      expect(() => assertContainedPath(storageRoot, symlinkFile)).toThrow(AriadneError);

      try {
        assertContainedPath(storageRoot, symlinkFile);
      } catch (err) {
        expect((err as AriadneError).code).toBe("PATH_ESCAPE");
      }
    });

    it("allows internal symlinks that resolve strictly inside the storage root", () => {
      const internalCard = path.join(storageRoot, "cards", "HYP-001.md");
      fs.writeFileSync(internalCard, "# HYP-001\n", "utf8");

      const internalLink = path.join(storageRoot, "active-hypothesis.md");
      fs.symlinkSync(internalCard, internalLink);

      expect(isContainedPath(storageRoot, internalLink)).toBe(true);
      const canonical = assertContainedPath(storageRoot, internalLink);
      expect(canonical).toBe(fs.realpathSync(internalCard));
    });

    it("detects and rejects symlink loops with AriadneError(PATH_ESCAPE)", () => {
      const loopA = path.join(storageRoot, "loop-a");
      const loopB = path.join(storageRoot, "loop-b");

      try {
        fs.symlinkSync(loopB, loopA);
        fs.symlinkSync(loopA, loopB);
      } catch {
        return; // skip if filesystem disallows loop creation
      }

      expect(() => canonicalizePath(loopA)).toThrow(AriadneError);
      try {
        canonicalizePath(loopA);
      } catch (err) {
        expect((err as AriadneError).code).toBe("PATH_ESCAPE");
      }
    });
  });

  describe("Non-Regular File Rejection (FIFOs, Sockets, Devices)", () => {
    it("accepts regular files and directories", () => {
      const regularFile = path.join(storageRoot, "regular.json");
      fs.writeFileSync(regularFile, "{}", "utf8");
      expect(() => assertRegularFileOrDirectory(regularFile)).not.toThrow();

      const regularDir = path.join(storageRoot, "regular-dir");
      fs.mkdirSync(regularDir);
      expect(() => assertRegularFileOrDirectory(regularDir)).not.toThrow();

      const nonExistentPath = path.join(storageRoot, "new-file.json");
      expect(() => assertRegularFileOrDirectory(nonExistentPath)).not.toThrow();
    });

    if (process.platform !== "win32") {
      it("rejects FIFO (named pipe) targets with AriadneError(INVALID_INPUT)", () => {
        const fifoPath = path.join(storageRoot, "test.fifo");
        try {
          execSync(`mkfifo "${fifoPath}"`);
        } catch {
          return; // skip if mkfifo not permitted in environment
        }

        expect(() => assertRegularFileOrDirectory(fifoPath)).toThrow(AriadneError);

        try {
          assertRegularFileOrDirectory(fifoPath);
        } catch (err) {
          expect(err).toBeInstanceOf(AriadneError);
          const aError = err as AriadneError;
          expect(aError.code).toBe("INVALID_INPUT");
          expect(aError.message).toContain("Special files (FIFOs, sockets, character/block devices) are not supported");
          expect(aError.repair).toBe("Ensure storage targets are regular files or directories.");
          expect(aError.detail?.isFIFO).toBe(true);
        }

        expect(() => assertContainedStorageTarget(storageRoot, fifoPath)).toThrow(AriadneError);
      });

      it("rejects UNIX domain sockets with AriadneError(INVALID_INPUT)", async () => {
        const sockPath = path.join(storageRoot, "test.sock");
        const server = net.createServer();

        await new Promise<void>((resolve, reject) => {
          server.listen(sockPath, () => resolve());
          server.on("error", reject);
        });

        try {
          expect(() => assertRegularFileOrDirectory(sockPath)).toThrow(AriadneError);

          try {
            assertRegularFileOrDirectory(sockPath);
          } catch (err) {
            expect(err).toBeInstanceOf(AriadneError);
            const aError = err as AriadneError;
            expect(aError.code).toBe("INVALID_INPUT");
            expect(aError.detail?.isSocket).toBe(true);
          }
        } finally {
          await new Promise<void>((resolve) => server.close(() => resolve()));
        }
      });

      it("rejects character devices like /dev/null with AriadneError(INVALID_INPUT)", () => {
        if (fs.existsSync("/dev/null")) {
          expect(() => assertRegularFileOrDirectory("/dev/null")).toThrow(AriadneError);

          try {
            assertRegularFileOrDirectory("/dev/null");
          } catch (err) {
            expect((err as AriadneError).code).toBe("INVALID_INPUT");
            expect((err as AriadneError).detail?.isCharacterDevice).toBe(true);
          }
        }
      });
    }
  });

  describe("Safe --force Target Restrictions", () => {
    it("permits --force on managed projection files (STATE.yaml, INDEX.md, cards/*.md)", () => {
      const allowedTargets = [
        path.join(storageRoot, "STATE.yaml"),
        "STATE.yaml",
        path.join(storageRoot, "INDEX.md"),
        "INDEX.md",
        path.join(storageRoot, "cards", "HYP-001.md"),
        "cards/DEC-042.md",
        path.join(storageRoot, "cards", "UNK-999.md"),
      ];

      for (const target of allowedTargets) {
        expect(isSafeForceTarget(storageRoot, target)).toBe(true);
        expect(() => assertSafeForceTarget(storageRoot, target)).not.toThrow();
      }
    });

    it("rejects --force on canonical authorities (GRAPH.jsonl, NOTICES.jsonl) with INVALID_INPUT", () => {
      const forbiddenAuthorities = [
        path.join(storageRoot, "GRAPH.jsonl"),
        "GRAPH.jsonl",
        path.join(storageRoot, "NOTICES.jsonl"),
        "NOTICES.jsonl",
      ];

      for (const target of forbiddenAuthorities) {
        expect(isSafeForceTarget(storageRoot, target)).toBe(false);
        expect(() => assertSafeForceTarget(storageRoot, target)).toThrow(AriadneError);

        try {
          assertSafeForceTarget(storageRoot, target);
        } catch (err) {
          expect(err).toBeInstanceOf(AriadneError);
          const aError = err as AriadneError;
          expect(aError.code).toBe("INVALID_INPUT");
          expect(aError.message).toContain(
            "The --force flag is restricted to managed Ariadne projection files (STATE.yaml, INDEX.md, cards)",
          );
          expect(aError.repair).toBe("Do not use --force on unmanaged files or source code.");
        }
      }
    });

    it("rejects --force on external source files and unmanaged code with INVALID_INPUT", () => {
      const unmanagedTargets = [
        path.join(tempDir, "package.json"),
        path.join(tempDir, "src", "index.ts"),
        path.join(storageRoot, "cards", "evil.txt"), // non-md in cards
        path.join(storageRoot, "cards"), // directory itself
        path.join(outsideDir, "secret.md"),
        path.join(storageRoot, "..", "cards", "fake.md"),
      ];

      for (const target of unmanagedTargets) {
        expect(isSafeForceTarget(storageRoot, target)).toBe(false);
        expect(() => assertSafeForceTarget(storageRoot, target)).toThrow(AriadneError);
      }
    });
  });

  describe("Process Execution Guardrails: Direct Argv, Timeout & Output Truncation", () => {
    it("spawns processes directly with shell: false and treats metacharacters as literal arguments", async () => {
      const injectedArg = "hello; echo INJECTED && rm -rf / | foo `whoami` $TEST";

      const result = await executeCommand({
        command: process.execPath,
        args: [
          "-e",
          "process.stdout.write(JSON.stringify(process.argv.slice(1)));",
          injectedArg,
        ],
      });

      expect(result.exitCode).toBe(0);
      const parsedArgs = JSON.parse(result.stdout);
      expect(parsedArgs[0]).toBe(injectedArg);
      expect(parsedArgs[0]).toContain("; echo INJECTED &&");
      expect(parsedArgs[0]).toContain("$TEST");
      expect(result.truncated).toBe(false);
    });

    it("terminates stalled processes via timeout and throws AriadneError(TIMEOUT)", async () => {
      const shortTimeoutMs = 150;

      await expect(
        executeCommand({
          command: process.execPath,
          args: ["-e", "setTimeout(() => {}, 60000);"],
          timeoutMs: shortTimeoutMs,
          killGraceMs: 100,
        }),
      ).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(AriadneError);
        const aError = err as AriadneError;
        expect(aError.code).toBe("TIMEOUT");
        expect(aError.message).toContain(`timed out after ${shortTimeoutMs}ms`);
        expect(aError.repair).toBe("Check command performance or increase the timeout limit.");
        expect(aError.detail).toMatchObject({
          command: process.execPath,
          timeoutMs: shortTimeoutMs,
        });
        return true;
      });
    });

    it("terminates stubborn processes that trap SIGTERM by escalating to SIGKILL", async () => {
      const shortTimeoutMs = 150;

      await expect(
        executeCommand({
          command: process.execPath,
          args: [
            "-e",
            'process.on("SIGTERM", () => {}); setInterval(() => {}, 1000);',
          ],
          timeoutMs: shortTimeoutMs,
          killGraceMs: 100,
        }),
      ).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(AriadneError);
        expect((err as AriadneError).code).toBe("TIMEOUT");
        return true;
      });
    });

    it("bounds output capture at 1 MB (MAX_OUTPUT_BYTES) and appends warning banner", async () => {
      // Emit ~1.4 MB of output
      const result = await executeCommand({
        command: process.execPath,
        args: [
          "-e",
          'process.stdout.write("B".repeat(1.4 * 1024 * 1024));',
        ],
      });

      expect(result.exitCode).toBe(0);
      expect(result.truncated).toBe(true);
      expect(result.stdout).toContain(TRUNCATION_WARNING_BANNER);
      expect(result.combinedOutput).toContain(TRUNCATION_WARNING_BANNER);

      // Raw capture before banner must be strictly bounded at 1 MB
      const rawCapture = result.stdout.slice(
        0,
        result.stdout.length - TRUNCATION_WARNING_BANNER.length,
      );
      expect(Buffer.byteLength(rawCapture, "utf8")).toBe(MAX_OUTPUT_BYTES);
    });

    it("bounds combined stdout and stderr capture strictly at 1 MB", async () => {
      const result = await executeCommand({
        command: process.execPath,
        args: [
          "-e",
          'process.stdout.write("X".repeat(700 * 1024)); process.stderr.write("Y".repeat(700 * 1024));',
        ],
      });

      expect(result.exitCode).toBe(0);
      expect(result.truncated).toBe(true);
      expect(result.combinedOutput).toContain(TRUNCATION_WARNING_BANNER);

      const rawCombined = result.combinedOutput.slice(
        0,
        result.combinedOutput.length - TRUNCATION_WARNING_BANNER.length,
      );
      expect(Buffer.byteLength(rawCombined, "utf8")).toBe(MAX_OUTPUT_BYTES);
    });
  });

  describe("Secret Redaction & Diagnostic Scrubbing", () => {
    it("scrubs Bearer, JWT, SSH keys, AWS, and GitHub tokens from strings", () => {
      // 1. Bearer
      expect(redactSecrets("Authorization: Bearer ya29.secret_token_12345")).toBe(
        "Authorization: Bearer [REDACTED]",
      );

      // 2. JWT
      const sampleJwt =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP8p_hP_E";
      expect(redactSecrets(`Got token: ${sampleJwt}`)).toBe("Got token: [REDACTED JWT]");

      // 3. SSH Private Keys
      const sshKey = [
        "-----BEGIN OPENSSH PRIVATE KEY-----",
        "b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW",
        "-----END OPENSSH PRIVATE KEY-----",
      ].join("\n");
      expect(redactSecrets(sshKey)).toBe("[REDACTED PRIVATE KEY]");

      // 4. AWS Keys
      expect(redactSecrets("Credentials: AKIAIOSFODNN7EXAMPLE and ASIAIOSFODNN7EXAMPLE")).toBe(
        "Credentials: [REDACTED AWS KEY] and [REDACTED AWS KEY]",
      );
      expect(
        redactSecrets("aws_secret_access_key=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"),
      ).toBe("aws_secret_access_key=[REDACTED AWS KEY]");

      // 5. GitHub Tokens
      expect(redactSecrets("ghp_1234567890abcdefghijklmnopqrstuvwxyz")).toBe(
        "[REDACTED GITHUB TOKEN]",
      );
      expect(redactSecrets("github_pat_11AAAAAAA0123456789_abcdefghijklmnopqrstuvwxyz")).toBe(
        "[REDACTED GITHUB TOKEN]",
      );

      // 6. Generic password / secret assignments
      expect(redactSecrets("db_password=supersecretpassword123")).toBe("db_password=[REDACTED]");
      expect(redactSecrets("api_key='special-api-key-value'")).toBe("api_key=[REDACTED]");
    });

    it("preserves non-sensitive strings and 40-character git commit hashes", () => {
      const harmless = "Operational status: OK. All 42 nodes validated.";
      expect(redactSecrets(harmless)).toBe(harmless);

      const commitSha = "c3ab8ff13720e8ad9047dd39466b3c8974e592c2";
      expect(redactSecrets(`commit ${commitSha} verified`)).toBe(`commit ${commitSha} verified`);
    });

    it("scrubs secrets in command output before detail inclusion in AriadneError(COMMAND_FAILED)", async () => {
      const secretBearer = "Bearer secret_api_token_value_9876";
      const secretAws = "AKIAIOSFODNN7EXAMPLE";
      const secretPassword = "password=unredacted_password_123";

      await expect(
        executeCommand({
          command: process.execPath,
          args: [
            "-e",
            `process.stdout.write("Connecting with ${secretAws} and ${secretPassword}\\n"); process.stderr.write("Unauthorized with ${secretBearer}\\n"); process.exit(1);`,
          ],
        }),
      ).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(AriadneError);
        const aError = err as AriadneError;
        expect(aError.code).toBe("COMMAND_FAILED");

        const detail = aError.detail as Record<string, unknown>;
        const stdout = String(detail.stdout);
        const stderr = String(detail.stderr);

        // Ensure raw secrets were completely scrubbed
        expect(stdout).not.toContain("AKIAIOSFODNN7EXAMPLE");
        expect(stdout).not.toContain("unredacted_password_123");
        expect(stderr).not.toContain("secret_api_token_value_9876");

        // Ensure redaction tags are present
        expect(stdout).toContain("[REDACTED AWS KEY]");
        expect(stdout).toContain("password=[REDACTED]");
        expect(stderr).toContain("Bearer [REDACTED]");

        return true;
      });
    });
  });
});
