import { describe, expect, it } from "vitest";
import {
  DEFAULT_KILL_GRACE_MS,
  DEFAULT_TIMEOUT_MS,
  MAX_OUTPUT_BYTES,
  TRUNCATION_WARNING_BANNER,
  executeCommand,
  redactSecrets,
} from "../../src/core/exec.js";
import { AriadneError, isAriadneError } from "../../src/core/errors.js";

describe("Direct Command Execution and Secret Redaction (src/core/exec.ts)", () => {
  describe("Constants", () => {
    it("exports standard configuration constants", () => {
      expect(DEFAULT_TIMEOUT_MS).toBe(30_000);
      expect(DEFAULT_KILL_GRACE_MS).toBe(500);
      expect(MAX_OUTPUT_BYTES).toBe(1024 * 1024);
      expect(TRUNCATION_WARNING_BANNER).toBe(
        "\n[WARNING: Command output exceeded 1 MB limit and was truncated]",
      );
    });
  });

  describe("Direct Argv Spawning without Shell (shell: false)", () => {
    it("treats shell metacharacters as literal arguments", async () => {
      const literalArg = "foo; echo INJECTED && bar | baz `whoami` $PATH";
      const result = await executeCommand({
        command: process.execPath,
        args: [
          "-e",
          "process.stdout.write(JSON.stringify(process.argv.slice(1)))",
          literalArg,
        ],
      });

      expect(result.exitCode).toBe(0);
      const parsedArgs = JSON.parse(result.stdout);
      expect(parsedArgs).toEqual([literalArg]);
      expect(parsedArgs[0]).toContain("$PATH");
      expect(parsedArgs[0]).toContain("`whoami`");
      expect(parsedArgs[0]).toContain("; echo INJECTED &&");
      expect(result.combinedOutput).toContain(literalArg);
      expect(result.truncated).toBe(false);
    });

    it("does not perform shell glob expansion", async () => {
      const globArg = "*.ts";
      const result = await executeCommand({
        command: process.execPath,
        args: [
          "-e",
          "process.stdout.write(process.argv[1])",
          globArg,
        ],
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("*.ts");
    });
  });

  describe("Successful Command Execution", () => {
    it("captures stdout, stderr, and combined output cleanly", async () => {
      const result = await executeCommand({
        command: process.execPath,
        args: [
          "-e",
          'process.stdout.write("hello stdout\\n"); process.stderr.write("hello stderr\\n");',
        ],
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("hello stdout\n");
      expect(result.stderr).toBe("hello stderr\n");
      expect(result.combinedOutput).toContain("hello stdout\n");
      expect(result.combinedOutput).toContain("hello stderr\n");
      expect(result.truncated).toBe(false);
    });

    it("supports passing input to child process stdin", async () => {
      const result = await executeCommand({
        command: process.execPath,
        args: [
          "-e",
          `let data = ""; process.stdin.on("data", (c) => data += c); process.stdin.on("end", () => process.stdout.write(data.toUpperCase()));`,
        ],
        input: "piped input payload",
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("PIPED INPUT PAYLOAD");
    });

    it("respects custom working directory and environment variables", async () => {
      const result = await executeCommand({
        command: process.execPath,
        args: [
          "-e",
          'process.stdout.write(JSON.stringify({ cwd: process.cwd(), custom: process.env.ARIADNE_CUSTOM_VAR }));',
        ],
        cwd: process.cwd(),
        env: {
          ...process.env,
          ARIADNE_CUSTOM_VAR: "custom_value_42",
        },
      });

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.cwd).toBe(process.cwd());
      expect(parsed.custom).toBe("custom_value_42");
    });
  });

  describe("1 MB Output Capping and Truncation Warning Banner", () => {
    it("bounds output at MAX_OUTPUT_BYTES and appends warning banner", async () => {
      // Generate ~1.5 MB of stdout output
      const result = await executeCommand({
        command: process.execPath,
        args: [
          "-e",
          'process.stdout.write("A".repeat(1.5 * 1024 * 1024));',
        ],
      });

      expect(result.exitCode).toBe(0);
      expect(result.truncated).toBe(true);
      expect(result.stdout).toContain(TRUNCATION_WARNING_BANNER);
      expect(result.combinedOutput).toContain(TRUNCATION_WARNING_BANNER);

      // Verify captured data before banner does not exceed 1 MB
      const stdoutWithoutBanner = result.stdout.slice(
        0,
        result.stdout.length - TRUNCATION_WARNING_BANNER.length,
      );
      expect(Buffer.byteLength(stdoutWithoutBanner, "utf-8")).toBe(MAX_OUTPUT_BYTES);
    });

    it("bounds output when distributed across stdout and stderr", async () => {
      // 800 KB to stdout, 800 KB to stderr -> combined exceeds 1 MB
      const result = await executeCommand({
        command: process.execPath,
        args: [
          "-e",
          'process.stdout.write("X".repeat(800 * 1024)); process.stderr.write("Y".repeat(800 * 1024));',
        ],
      });

      expect(result.exitCode).toBe(0);
      expect(result.truncated).toBe(true);
      expect(result.combinedOutput).toContain(TRUNCATION_WARNING_BANNER);

      // Combined capture before banner must be strictly bounded to 1 MB
      const combinedWithoutBanner = result.combinedOutput.slice(
        0,
        result.combinedOutput.length - TRUNCATION_WARNING_BANNER.length,
      );
      expect(Buffer.byteLength(combinedWithoutBanner, "utf-8")).toBe(MAX_OUTPUT_BYTES);
    });

    it("respects custom maxOutputBytes configuration", async () => {
      const customMaxBytes = 256;
      const result = await executeCommand({
        command: process.execPath,
        args: [
          "-e",
          'process.stdout.write("Z".repeat(1000));',
        ],
        maxOutputBytes: customMaxBytes,
      });

      expect(result.exitCode).toBe(0);
      expect(result.truncated).toBe(true);
      expect(result.stdout).toContain(TRUNCATION_WARNING_BANNER);
      const rawCapture = result.stdout.slice(
        0,
        result.stdout.length - TRUNCATION_WARNING_BANNER.length,
      );
      expect(rawCapture.length).toBe(customMaxBytes);
    });
  });

  describe("Timeout Enforcement and Staged Process Termination", () => {
    it("terminates stalled processes via SIGTERM and throws AriadneError(TIMEOUT)", async () => {
      const shortTimeoutMs = 150;

      await expect(
        executeCommand({
          command: process.execPath,
          args: ["-e", "setTimeout(() => {}, 60000);"],
          timeoutMs: shortTimeoutMs,
          killGraceMs: 100,
        }),
      ).rejects.toSatisfy((err: unknown) => {
        expect(isAriadneError(err)).toBe(true);
        const ariadneErr = err as AriadneError;
        expect(ariadneErr.code).toBe("TIMEOUT");
        expect(ariadneErr.message).toContain(
          `timed out after ${shortTimeoutMs}ms`,
        );
        expect(ariadneErr.repair).toBe(
          "Check command performance or increase the timeout limit.",
        );
        expect(ariadneErr.detail).toMatchObject({
          command: process.execPath,
          timeoutMs: shortTimeoutMs,
        });
        return true;
      });
    });

    it("terminates processes that ignore SIGTERM by escalating to SIGKILL", async () => {
      const shortTimeoutMs = 150;
      const shortGraceMs = 100;

      await expect(
        executeCommand({
          command: process.execPath,
          args: [
            "-e",
            'process.on("SIGTERM", () => { /* ignore SIGTERM */ }); setInterval(() => {}, 1000);',
          ],
          timeoutMs: shortTimeoutMs,
          killGraceMs: shortGraceMs,
        }),
      ).rejects.toSatisfy((err: unknown) => {
        expect(isAriadneError(err)).toBe(true);
        const ariadneErr = err as AriadneError;
        expect(ariadneErr.code).toBe("TIMEOUT");
        return true;
      });
    });
  });

  describe("Nonzero Exit Code Handling", () => {
    it("throws AriadneError(COMMAND_FAILED) by default on failure", async () => {
      await expect(
        executeCommand({
          command: process.execPath,
          args: [
            "-e",
            'process.stderr.write("Fatal compilation failure\\n"); process.exit(42);',
          ],
        }),
      ).rejects.toSatisfy((err: unknown) => {
        expect(isAriadneError(err)).toBe(true);
        const ariadneErr = err as AriadneError;
        expect(ariadneErr.code).toBe("COMMAND_FAILED");
        expect(ariadneErr.message).toContain("failed with exit code 42");
        expect(ariadneErr.detail).toMatchObject({
          command: process.execPath,
          exitCode: 42,
          stderr: "Fatal compilation failure\n",
        });
        return true;
      });
    });

    it("returns CommandResult without throwing when rejectOnError is false", async () => {
      const result = await executeCommand({
        command: process.execPath,
        args: [
          "-e",
          'process.stdout.write("standard info\\n"); process.stderr.write("warning diagnostic\\n"); process.exit(7);',
        ],
        rejectOnError: false,
      });

      expect(result.exitCode).toBe(7);
      expect(result.stdout).toBe("standard info\n");
      expect(result.stderr).toBe("warning diagnostic\n");
      expect(result.truncated).toBe(false);
    });

    it("fails closed with AriadneError(COMMAND_FAILED) when executable does not exist", async () => {
      await expect(
        executeCommand({
          command: "non_existent_executable_12345_xyz",
          args: ["--version"],
        }),
      ).rejects.toSatisfy((err: unknown) => {
        expect(isAriadneError(err)).toBe(true);
        const ariadneErr = err as AriadneError;
        expect(ariadneErr.code).toBe("COMMAND_FAILED");
        return true;
      });
    });
  });

  describe("Input Validation", () => {
    it("rejects empty or whitespace command names with INVALID_INPUT", async () => {
      await expect(
        executeCommand({ command: "" }),
      ).rejects.toSatisfy((err: unknown) => {
        expect(isAriadneError(err)).toBe(true);
        expect((err as AriadneError).code).toBe("INVALID_INPUT");
        return true;
      });

      await expect(
        executeCommand({ command: "   " }),
      ).rejects.toSatisfy((err: unknown) => {
        expect(isAriadneError(err)).toBe(true);
        expect((err as AriadneError).code).toBe("INVALID_INPUT");
        return true;
      });
    });

    it("rejects non-array or non-string args with INVALID_INPUT", async () => {
      await expect(
        executeCommand({
          command: "node",
          args: [123 as unknown as string],
        }),
      ).rejects.toSatisfy((err: unknown) => {
        expect(isAriadneError(err)).toBe(true);
        expect((err as AriadneError).code).toBe("INVALID_INPUT");
        return true;
      });
    });

    it("rejects invalid timeoutMs and maxOutputBytes with INVALID_INPUT", async () => {
      await expect(
        executeCommand({
          command: "node",
          timeoutMs: -50,
        }),
      ).rejects.toSatisfy((err: unknown) => {
        expect(isAriadneError(err)).toBe(true);
        expect((err as AriadneError).code).toBe("INVALID_INPUT");
        return true;
      });

      await expect(
        executeCommand({
          command: "node",
          maxOutputBytes: 0,
        }),
      ).rejects.toSatisfy((err: unknown) => {
        expect(isAriadneError(err)).toBe(true);
        expect((err as AriadneError).code).toBe("INVALID_INPUT");
        return true;
      });
    });
  });

  describe("Secret Redaction (redactSecrets)", () => {
    it("redacts Bearer tokens", () => {
      expect(
        redactSecrets("Authorization: Bearer ya29.a0AfH6SMB_1234567890"),
      ).toBe("Authorization: Bearer [REDACTED]");

      expect(
        redactSecrets("bearer secret-token-xyz=="),
      ).toBe("bearer [REDACTED]");

      expect(
        redactSecrets("Bearer A1b2C3d4E5f6G7h8=="),
      ).toBe("Bearer [REDACTED]");
    });

    it("redacts JWT tokens", () => {
      const jwt =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
      expect(redactSecrets(jwt)).toBe("[REDACTED JWT]");
      expect(redactSecrets(`Token received: ${jwt}`)).toBe(
        "Token received: [REDACTED JWT]",
      );

      const mockJwt =
        "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyMSJ9.c2lnbmF0dXJlMTIzNDU";
      expect(redactSecrets(mockJwt)).toBe("[REDACTED JWT]");
    });

    it("redacts SSH private keys (RSA, OpenSSH, EC, generic)", () => {
      const rsaKey = [
        "-----BEGIN RSA PRIVATE KEY-----",
        "MIIEowIBAAKCAQEA0mN+...randomBase64...",
        "-----END RSA PRIVATE KEY-----",
      ].join("\n");
      expect(redactSecrets(rsaKey)).toBe("[REDACTED PRIVATE KEY]");

      const openSshKey = [
        "-----BEGIN OPENSSH PRIVATE KEY-----",
        "b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAA...",
        "-----END OPENSSH PRIVATE KEY-----",
      ].join("\n");
      expect(redactSecrets(openSshKey)).toBe("[REDACTED PRIVATE KEY]");

      const ecKey = [
        "-----BEGIN EC PRIVATE KEY-----",
        "MHQCAQEEIBmJ3vGq9h2...==",
        "-----END EC PRIVATE KEY-----",
      ].join("\n");
      expect(redactSecrets(ecKey)).toBe("[REDACTED PRIVATE KEY]");

      const genericKey = [
        "-----BEGIN PRIVATE KEY-----",
        "MIIEvgIBADANBgkqhkiG9w0BAQEFAASC...",
        "-----END PRIVATE KEY-----",
      ].join("\n");
      expect(redactSecrets(genericKey)).toBe("[REDACTED PRIVATE KEY]");
    });

    it("redacts GitHub tokens (classic, fine-grained, OAuth, etc.)", () => {
      expect(
        redactSecrets("ghp_1234567890abcdefghijklmnopqrstuvwxyz"),
      ).toBe("[REDACTED GITHUB TOKEN]");

      expect(
        redactSecrets("gho_1234567890abcdefghijklmnopqrstuvwxyz"),
      ).toBe("[REDACTED GITHUB TOKEN]");

      expect(
        redactSecrets("ghu_1234567890abcdefghijklmnopqrstuvwxyz"),
      ).toBe("[REDACTED GITHUB TOKEN]");

      expect(
        redactSecrets("ghs_1234567890abcdefghijklmnopqrstuvwxyz"),
      ).toBe("[REDACTED GITHUB TOKEN]");

      expect(
        redactSecrets("ghr_1234567890abcdefghijklmnopqrstuvwxyz"),
      ).toBe("[REDACTED GITHUB TOKEN]");

      expect(
        redactSecrets(
          "github_pat_11AAAAAAA0123456789_abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOP",
        ),
      ).toBe("[REDACTED GITHUB TOKEN]");
    });

    it("redacts AWS Access Key IDs and Secret Keys", () => {
      expect(redactSecrets("AKIAIOSFODNN7EXAMPLE")).toBe(
        "[REDACTED AWS KEY]",
      );
      expect(redactSecrets("ASIAIOSFODNN7EXAMPLE")).toBe(
        "[REDACTED AWS KEY]",
      );
      expect(
        redactSecrets(
          "aws_secret_access_key=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        ),
      ).toBe("aws_secret_access_key=[REDACTED AWS KEY]");
      expect(
        redactSecrets(
          'AWS_SECRET_KEY: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"',
        ),
      ).toBe("AWS_SECRET_KEY: [REDACTED AWS KEY]");
    });

    it("redacts generic password, secret, api_key, and token assignments", () => {
      expect(redactSecrets("password=supersecret123")).toBe(
        "password=[REDACTED]",
      );
      expect(redactSecrets("secret=ultra-confidential")).toBe(
        "secret=[REDACTED]",
      );
      expect(redactSecrets("api_key=AIzaSyD-1234567890abcdef")).toBe(
        "api_key=[REDACTED]",
      );
      expect(redactSecrets("token=session_token_xyz_999")).toBe(
        "token=[REDACTED]",
      );

      // Quoted values in config
      expect(redactSecrets('password: "my secret pass"')).toBe(
        "password: [REDACTED]",
      );
      expect(redactSecrets("api-key='special-secret-key'")).toBe(
        "api-key=[REDACTED]",
      );

      // Query strings
      expect(
        redactSecrets(
          "https://example.com/api?user=bob&password=pass123&api_key=key456&token=tok789&debug=true",
        ),
      ).toBe(
        "https://example.com/api?user=bob&password=[REDACTED]&api_key=[REDACTED]&token=[REDACTED]&debug=true",
      );
    });

    it("preserves non-sensitive strings and git commit hashes", () => {
      expect(redactSecrets("")).toBe("");
      expect(redactSecrets("Hello world! Everything is operational.")).toBe(
        "Hello world! Everything is operational.",
      );

      // 40-character git commit SHA-1 hashes must not be redacted
      const gitCommitSha = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4";
      expect(redactSecrets(`commit ${gitCommitSha}`)).toBe(
        `commit ${gitCommitSha}`,
      );
    });

    it("redacts multiple diverse secrets within a single message", () => {
      const mixedText = [
        "Diagnostics report:",
        "Auth header: Bearer ya29.abcdef123",
        "GitHub token: ghp_1234567890abcdefghijklmnopqrstuvwxyz",
        "AWS credentials: aws_access_key_id=AKIAIOSFODNN7EXAMPLE and aws_secret_access_key=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        "Database: db_password=mySuperSecretPass",
      ].join("\n");

      const redacted = redactSecrets(mixedText);
      expect(redacted).not.toContain("ya29.abcdef123");
      expect(redacted).not.toContain("ghp_1234567890abcdefghijklmnopqrstuvwxyz");
      expect(redacted).not.toContain("AKIAIOSFODNN7EXAMPLE");
      expect(redacted).not.toContain("wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY");
      expect(redacted).not.toContain("mySuperSecretPass");

      expect(redacted).toContain("Bearer [REDACTED]");
      expect(redacted).toContain("[REDACTED GITHUB TOKEN]");
      expect(redacted).toContain("aws_access_key_id=[REDACTED AWS KEY]");
      expect(redacted).toContain("aws_secret_access_key=[REDACTED AWS KEY]");
      expect(redacted).toContain("db_password=[REDACTED]");
    });

    it("idempotently handles already redacted tokens without mangling", () => {
      const alreadyRedacted =
        "Authorization: Bearer [REDACTED], token=[REDACTED], [REDACTED JWT], [REDACTED PRIVATE KEY]";
      expect(redactSecrets(alreadyRedacted)).toBe(alreadyRedacted);
    });
  });

  describe("Error Detail Redaction Integration", () => {
    it("scrubs secrets from stdout and stderr in AriadneError(COMMAND_FAILED) detail", async () => {
      const secretBearer = "Bearer super_secret_credential_xyz_123";
      const secretPassword = "password=unredacted_password_value";

      await expect(
        executeCommand({
          command: process.execPath,
          args: [
            "-e",
            `process.stdout.write("${secretPassword}\\n"); process.stderr.write("Failed authorization: ${secretBearer}\\n"); process.exit(1);`,
          ],
        }),
      ).rejects.toSatisfy((err: unknown) => {
        expect(isAriadneError(err)).toBe(true);
        const ariadneErr = err as AriadneError;
        expect(ariadneErr.code).toBe("COMMAND_FAILED");

        const detail = ariadneErr.detail as Record<string, unknown>;
        const stdout = String(detail.stdout);
        const stderr = String(detail.stderr);

        expect(stdout).not.toContain("unredacted_password_value");
        expect(stdout).toContain("password=[REDACTED]");

        expect(stderr).not.toContain("super_secret_credential_xyz_123");
        expect(stderr).toContain("Bearer [REDACTED]");

        return true;
      });
    });
  });
});
