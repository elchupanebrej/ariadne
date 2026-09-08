import { execSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  canonicalizePath,
  isContainedPath,
  assertContainedPath,
  assertRegularFileOrDirectory,
  isSafeForceTarget,
  assertSafeForceTarget,
  assertContainedStorageTarget,
  MANAGED_PROJECTION_FILES,
  MANAGED_CARDS_DIR,
} from "../../src/core/containment.js";
import { AriadneError } from "../../src/core/errors.js";

describe("Path Containment and Security (src/core/containment.ts)", () => {
  let testDir: string;
  let storageRoot: string;
  let outsideDir: string;

  beforeEach(() => {
    // Create an isolated temporary test directory
    const tempPrefix = path.join(os.tmpdir(), "ariadne-containment-");
    testDir = fs.realpathSync(fs.mkdtempSync(tempPrefix));
    storageRoot = path.join(testDir, "workspace", ".ariadne");
    outsideDir = path.join(testDir, "outside");

    fs.mkdirSync(storageRoot, { recursive: true });
    fs.mkdirSync(outsideDir, { recursive: true });
    fs.mkdirSync(path.join(storageRoot, "cards"), { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("Constants", () => {
    it("exports managed projection file constants", () => {
      expect(MANAGED_PROJECTION_FILES).toEqual(["STATE.yaml", "INDEX.md"]);
      expect(MANAGED_CARDS_DIR).toBe("cards");
    });
  });

  describe("canonicalizePath", () => {
    it("resolves existing paths to their realpath", () => {
      const canonical = canonicalizePath(storageRoot);
      expect(canonical).toBe(fs.realpathSync(storageRoot));
    });

    it("resolves non-existent leaf files by combining ancestor realpath with leaf segment", () => {
      const nonExistentFile = path.join(storageRoot, "cards", "TASK-001.md");
      const canonical = canonicalizePath(nonExistentFile);
      expect(canonical).toBe(path.join(fs.realpathSync(path.join(storageRoot, "cards")), "TASK-001.md"));
    });

    it("resolves non-existent multi-level subdirectories", () => {
      const nonExistentSub = path.join(storageRoot, "a", "b", "c", "file.json");
      const canonical = canonicalizePath(nonExistentSub);
      expect(canonical).toBe(path.join(fs.realpathSync(storageRoot), "a", "b", "c", "file.json"));
    });

    it("dereferences symlinks to existing directories", () => {
      const targetDir = path.join(storageRoot, "actual-dir");
      fs.mkdirSync(targetDir);
      const linkPath = path.join(storageRoot, "sym-dir");
      fs.symlinkSync(targetDir, linkPath);

      const canonical = canonicalizePath(path.join(linkPath, "file.txt"));
      expect(canonical).toBe(path.join(fs.realpathSync(targetDir), "file.txt"));
    });

    it("dereferences symlinks to non-existent targets", () => {
      const nonExistentTarget = path.join(outsideDir, "ghost");
      const linkPath = path.join(storageRoot, "broken-link");
      fs.symlinkSync(nonExistentTarget, linkPath);

      const canonical = canonicalizePath(path.join(linkPath, "subfile.txt"));
      expect(canonical).toBe(path.join(fs.realpathSync(outsideDir), "ghost", "subfile.txt"));
    });

    it("detects symlink loops and aborts with PATH_ESCAPE", () => {
      const linkA = path.join(storageRoot, "loop-a");
      const linkB = path.join(storageRoot, "loop-b");

      try {
        fs.symlinkSync(linkB, linkA);
        fs.symlinkSync(linkA, linkB);
      } catch {
        // Some systems restrict creating broken loop symlinks
        return;
      }

      expect(() => canonicalizePath(linkA)).toThrow(AriadneError);
      try {
        canonicalizePath(linkA);
      } catch (err: any) {
        expect(err.code).toBe("PATH_ESCAPE");
      }
    });
  });

  describe("assertContainedPath & isContainedPath", () => {
    it("allows the canonical storage root itself", () => {
      const result = assertContainedPath(storageRoot, storageRoot);
      expect(result).toBe(fs.realpathSync(storageRoot));
      expect(isContainedPath(storageRoot, storageRoot)).toBe(true);
    });

    it("allows existing and non-existent files directly within storage root", () => {
      const stateFile = path.join(storageRoot, "STATE.yaml");
      fs.writeFileSync(stateFile, "version: 1\n");

      expect(assertContainedPath(storageRoot, stateFile)).toBe(fs.realpathSync(stateFile));
      expect(isContainedPath(storageRoot, stateFile)).toBe(true);

      const nonExistent = path.join(storageRoot, "INDEX.md");
      expect(assertContainedPath(storageRoot, nonExistent)).toBe(path.join(fs.realpathSync(storageRoot), "INDEX.md"));
      expect(isContainedPath(storageRoot, nonExistent)).toBe(true);
    });

    it("allows nested files inside subdirectories of storage root", () => {
      const cardFile = path.join(storageRoot, "cards", "TASK-001.md");
      fs.writeFileSync(cardFile, "# TASK-001\n");

      expect(assertContainedPath(storageRoot, cardFile)).toBe(fs.realpathSync(cardFile));
      expect(isContainedPath(storageRoot, cardFile)).toBe(true);
    });

    it("allows relative paths specified with respect to storage root", () => {
      const relCard = "cards/TASK-002.md";
      const resolved = assertContainedPath(storageRoot, relCard);
      expect(resolved).toBe(path.join(fs.realpathSync(storageRoot), "cards", "TASK-002.md"));
      expect(isContainedPath(storageRoot, relCard)).toBe(true);
    });

    it("allows symlinks that resolve strictly inside storage root", () => {
      const internalTarget = path.join(storageRoot, "cards", "TASK-001.md");
      fs.writeFileSync(internalTarget, "# TASK-001\n");

      const internalSymlink = path.join(storageRoot, "active-card.md");
      fs.symlinkSync(internalTarget, internalSymlink);

      const resolved = assertContainedPath(storageRoot, internalSymlink);
      expect(resolved).toBe(fs.realpathSync(internalTarget));
      expect(isContainedPath(storageRoot, internalSymlink)).toBe(true);
    });

    it("allows symlink directories that resolve strictly inside storage root", () => {
      const internalDir = path.join(storageRoot, "cards");
      const symlinkDir = path.join(storageRoot, "card-alias");
      fs.symlinkSync(internalDir, symlinkDir);

      const targetPath = path.join(symlinkDir, "TASK-NEW.md");
      const resolved = assertContainedPath(storageRoot, targetPath);
      expect(resolved).toBe(path.join(fs.realpathSync(internalDir), "TASK-NEW.md"));
      expect(isContainedPath(storageRoot, targetPath)).toBe(true);
    });

    it("rejects symlink escaping storage root to existing external directory with PATH_ESCAPE", () => {
      const externalDir = path.join(outsideDir, "leaked");
      fs.mkdirSync(externalDir);
      const escapeSymlink = path.join(storageRoot, "external-link");
      fs.symlinkSync(externalDir, escapeSymlink);

      const escapeTarget = path.join(escapeSymlink, "secret.txt");

      expect(isContainedPath(storageRoot, escapeTarget)).toBe(false);
      expect(() => assertContainedPath(storageRoot, escapeTarget)).toThrow(AriadneError);

      try {
        assertContainedPath(storageRoot, escapeTarget);
      } catch (err: any) {
        expect(err.code).toBe("PATH_ESCAPE");
        expect(err.repair).toBe("Ensure all paths and symlinks reside within the designated storage root.");
        expect(err.detail).toBeDefined();
        expect(err.detail.storageRoot).toBe(storageRoot);
      }
    });

    it("rejects symlink escaping storage root to external file with PATH_ESCAPE", () => {
      const externalFile = path.join(outsideDir, "secret.txt");
      fs.writeFileSync(externalFile, "super secret\n");
      const escapeSymlink = path.join(storageRoot, "secret-link.txt");
      fs.symlinkSync(externalFile, escapeSymlink);

      expect(isContainedPath(storageRoot, escapeSymlink)).toBe(false);
      expect(() => assertContainedPath(storageRoot, escapeSymlink)).toThrow(AriadneError);

      try {
        assertContainedPath(storageRoot, escapeSymlink);
      } catch (err: any) {
        expect(err.code).toBe("PATH_ESCAPE");
      }
    });

    it("rejects symlink escaping storage root to uncreated external path with PATH_ESCAPE", () => {
      const uncreatedExternal = path.join(outsideDir, "not-yet-created.txt");
      const escapeSymlink = path.join(storageRoot, "ghost-link.txt");
      fs.symlinkSync(uncreatedExternal, escapeSymlink);

      expect(isContainedPath(storageRoot, escapeSymlink)).toBe(false);
      expect(() => assertContainedPath(storageRoot, escapeSymlink)).toThrow(AriadneError);

      try {
        assertContainedPath(storageRoot, escapeSymlink);
      } catch (err: any) {
        expect(err.code).toBe("PATH_ESCAPE");
      }
    });

    it("rejects relative path traversal escaping storage root with ../", () => {
      const escapingPath = path.join(storageRoot, "..", "outside-file.txt");

      expect(isContainedPath(storageRoot, escapingPath)).toBe(false);
      expect(() => assertContainedPath(storageRoot, escapingPath)).toThrow(AriadneError);

      try {
        assertContainedPath(storageRoot, escapingPath);
      } catch (err: any) {
        expect(err.code).toBe("PATH_ESCAPE");
        expect(err.repair).toBe("Ensure all paths and symlinks reside within the designated storage root.");
      }
    });

    it("rejects multi-hop ../ traversal escaping storage root", () => {
      const escapingPath = path.join(storageRoot, "cards", "..", "..", "..", "etc", "passwd");

      expect(isContainedPath(storageRoot, escapingPath)).toBe(false);
      expect(() => assertContainedPath(storageRoot, escapingPath)).toThrow(AriadneError);

      try {
        assertContainedPath(storageRoot, escapingPath);
      } catch (err: any) {
        expect(err.code).toBe("PATH_ESCAPE");
      }
    });

    it("allows ../ traversal that stays strictly inside storage root", () => {
      const safeTraversal = path.join(storageRoot, "cards", "..", "STATE.yaml");

      expect(isContainedPath(storageRoot, safeTraversal)).toBe(true);
      const canonical = assertContainedPath(storageRoot, safeTraversal);
      expect(canonical).toBe(path.join(fs.realpathSync(storageRoot), "STATE.yaml"));
    });

    it("rejects sibling directory sharing name prefix with storage root", () => {
      const siblingDir = `${storageRoot}-other`;
      fs.mkdirSync(siblingDir, { recursive: true });
      const target = path.join(siblingDir, "file.txt");

      expect(isContainedPath(storageRoot, target)).toBe(false);
      expect(() => assertContainedPath(storageRoot, target)).toThrow(AriadneError);

      try {
        assertContainedPath(storageRoot, target);
      } catch (err: any) {
        expect(err.code).toBe("PATH_ESCAPE");
      }
    });

    it("rejects absolute paths outside storage root", () => {
      const external = path.join(outsideDir, "file.txt");

      expect(isContainedPath(storageRoot, external)).toBe(false);
      expect(() => assertContainedPath(storageRoot, external)).toThrow(AriadneError);

      try {
        assertContainedPath(storageRoot, external);
      } catch (err: any) {
        expect(err.code).toBe("PATH_ESCAPE");
      }
    });
  });

  describe("assertRegularFileOrDirectory", () => {
    it("accepts regular files", () => {
      const file = path.join(storageRoot, "regular.txt");
      fs.writeFileSync(file, "content");
      expect(() => assertRegularFileOrDirectory(file)).not.toThrow();
    });

    it("accepts directories", () => {
      const dir = path.join(storageRoot, "regular-dir");
      fs.mkdirSync(dir);
      expect(() => assertRegularFileOrDirectory(dir)).not.toThrow();
    });

    it("accepts non-existent paths (so new files can be created)", () => {
      const nonExistent = path.join(storageRoot, "non-existent.txt");
      expect(() => assertRegularFileOrDirectory(nonExistent)).not.toThrow();
    });

    it("accepts symlinks pointing to regular files", () => {
      const target = path.join(storageRoot, "target.txt");
      fs.writeFileSync(target, "content");
      const symlink = path.join(storageRoot, "sym-target.txt");
      fs.symlinkSync(target, symlink);

      expect(() => assertRegularFileOrDirectory(symlink)).not.toThrow();
    });

    if (process.platform !== "win32") {
      it("rejects FIFO (named pipe) with INVALID_INPUT", () => {
        const fifoPath = path.join(storageRoot, "test.fifo");
        try {
          execSync(`mkfifo "${fifoPath}"`);
        } catch {
          // If mkfifo is not supported in runner, skip
          return;
        }

        expect(() => assertRegularFileOrDirectory(fifoPath)).toThrow(AriadneError);

        try {
          assertRegularFileOrDirectory(fifoPath);
        } catch (err: any) {
          expect(err.code).toBe("INVALID_INPUT");
          expect(err.message).toBe("Special files (FIFOs, sockets, character/block devices) are not supported");
          expect(err.repair).toBe("Ensure storage targets are regular files or directories.");
          expect(err.detail).toBeDefined();
          expect(err.detail.isFIFO).toBe(true);
        }
      });

      it("rejects UNIX domain sockets with INVALID_INPUT", async () => {
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
          } catch (err: any) {
            expect(err.code).toBe("INVALID_INPUT");
            expect(err.message).toBe("Special files (FIFOs, sockets, character/block devices) are not supported");
            expect(err.repair).toBe("Ensure storage targets are regular files or directories.");
            expect(err.detail.isSocket).toBe(true);
          }
        } finally {
          await new Promise<void>((resolve) => server.close(() => resolve()));
        }
      });

      it("rejects character devices like /dev/null with INVALID_INPUT", () => {
        if (fs.existsSync("/dev/null")) {
          expect(() => assertRegularFileOrDirectory("/dev/null")).toThrow(AriadneError);

          try {
            assertRegularFileOrDirectory("/dev/null");
          } catch (err: any) {
            expect(err.code).toBe("INVALID_INPUT");
            expect(err.message).toBe("Special files (FIFOs, sockets, character/block devices) are not supported");
            expect(err.detail.isCharacterDevice).toBe(true);
          }
        }
      });
    }
  });

  describe("assertSafeForceTarget & isSafeForceTarget", () => {
    it("allows STATE.yaml (relative and absolute)", () => {
      const absPath = path.join(storageRoot, "STATE.yaml");
      expect(isSafeForceTarget(storageRoot, absPath)).toBe(true);
      expect(() => assertSafeForceTarget(storageRoot, absPath)).not.toThrow();

      expect(isSafeForceTarget(storageRoot, "STATE.yaml")).toBe(true);
      expect(() => assertSafeForceTarget(storageRoot, "STATE.yaml")).not.toThrow();
    });

    it("allows INDEX.md (relative and absolute)", () => {
      const absPath = path.join(storageRoot, "INDEX.md");
      expect(isSafeForceTarget(storageRoot, absPath)).toBe(true);
      expect(() => assertSafeForceTarget(storageRoot, absPath)).not.toThrow();

      expect(isSafeForceTarget(storageRoot, "INDEX.md")).toBe(true);
      expect(() => assertSafeForceTarget(storageRoot, "INDEX.md")).not.toThrow();
    });

    it("allows cards under cards/ ending in .md", () => {
      const absCard = path.join(storageRoot, "cards", "TASK-001.md");
      expect(isSafeForceTarget(storageRoot, absCard)).toBe(true);
      expect(() => assertSafeForceTarget(storageRoot, absCard)).not.toThrow();

      const relCard = "cards/DEC-042.md";
      expect(isSafeForceTarget(storageRoot, relCard)).toBe(true);
      expect(() => assertSafeForceTarget(storageRoot, relCard)).not.toThrow();
    });

    it("rejects unmanaged files within storage root like GRAPH.jsonl with INVALID_INPUT", () => {
      const graph = path.join(storageRoot, "GRAPH.jsonl");
      expect(isSafeForceTarget(storageRoot, graph)).toBe(false);
      expect(() => assertSafeForceTarget(storageRoot, graph)).toThrow(AriadneError);

      try {
        assertSafeForceTarget(storageRoot, graph);
      } catch (err: any) {
        expect(err.code).toBe("INVALID_INPUT");
        expect(err.message).toBe("The --force flag is restricted to managed Ariadne projection files (STATE.yaml, INDEX.md, cards)");
        expect(err.repair).toBe("Do not use --force on unmanaged files or source code.");
      }
    });

    it("rejects unmanaged files within storage root like NOTICES.jsonl with INVALID_INPUT", () => {
      const notices = path.join(storageRoot, "NOTICES.jsonl");
      expect(isSafeForceTarget(storageRoot, notices)).toBe(false);
      expect(() => assertSafeForceTarget(storageRoot, notices)).toThrow(AriadneError);
    });

    it("rejects non-markdown files inside cards directory", () => {
      const nonMd = path.join(storageRoot, "cards", "foo.txt");
      expect(isSafeForceTarget(storageRoot, nonMd)).toBe(false);
      expect(() => assertSafeForceTarget(storageRoot, nonMd)).toThrow(AriadneError);
    });

    it("rejects directory targets like cards itself", () => {
      const cardsDir = path.join(storageRoot, "cards");
      expect(isSafeForceTarget(storageRoot, cardsDir)).toBe(false);
      expect(() => assertSafeForceTarget(storageRoot, cardsDir)).toThrow(AriadneError);
    });

    it("rejects unmanaged external files like package.json with INVALID_INPUT", () => {
      const pkgJson = path.join(testDir, "package.json");
      fs.writeFileSync(pkgJson, "{}");

      expect(isSafeForceTarget(storageRoot, pkgJson)).toBe(false);
      expect(() => assertSafeForceTarget(storageRoot, pkgJson)).toThrow(AriadneError);

      try {
        assertSafeForceTarget(storageRoot, pkgJson);
      } catch (err: any) {
        expect(err.code).toBe("INVALID_INPUT");
        expect(err.message).toBe("The --force flag is restricted to managed Ariadne projection files (STATE.yaml, INDEX.md, cards)");
        expect(err.repair).toBe("Do not use --force on unmanaged files or source code.");
      }
    });

    it("rejects source code files like src/index.ts with INVALID_INPUT", () => {
      const srcFile = path.join(testDir, "src", "index.ts");
      fs.mkdirSync(path.dirname(srcFile), { recursive: true });
      fs.writeFileSync(srcFile, "export {};");

      expect(isSafeForceTarget(storageRoot, srcFile)).toBe(false);
      expect(() => assertSafeForceTarget(storageRoot, srcFile)).toThrow(AriadneError);
    });

    it("rejects arbitrary paths outside storage root with INVALID_INPUT", () => {
      const arbitrary = path.join(outsideDir, "external.md");
      expect(isSafeForceTarget(storageRoot, arbitrary)).toBe(false);
      expect(() => assertSafeForceTarget(storageRoot, arbitrary)).toThrow(AriadneError);
    });

    it("rejects ../ traversal attempts in force targets", () => {
      const traversal = path.join(storageRoot, "..", "cards", "fake.md");
      expect(isSafeForceTarget(storageRoot, traversal)).toBe(false);
      expect(() => assertSafeForceTarget(storageRoot, traversal)).toThrow(AriadneError);
    });
  });

  describe("assertContainedStorageTarget (composite helper)", () => {
    it("passes for valid regular files inside storage root", () => {
      const card = path.join(storageRoot, "cards", "HYP-001.md");
      fs.writeFileSync(card, "# HYP-001\n");

      const result = assertContainedStorageTarget(storageRoot, card);
      expect(result).toBe(fs.realpathSync(card));
    });

    it("fails with PATH_ESCAPE when escaping storage root", () => {
      const outside = path.join(outsideDir, "file.txt");
      expect(() => assertContainedStorageTarget(storageRoot, outside)).toThrow(AriadneError);
      try {
        assertContainedStorageTarget(storageRoot, outside);
      } catch (err: any) {
        expect(err.code).toBe("PATH_ESCAPE");
      }
    });

    if (process.platform !== "win32") {
      it("fails with INVALID_INPUT when targeting a FIFO inside storage root", () => {
        const fifo = path.join(storageRoot, "queue.fifo");
        try {
          execSync(`mkfifo "${fifo}"`);
        } catch {
          return;
        }

        expect(() => assertContainedStorageTarget(storageRoot, fifo)).toThrow(AriadneError);
        try {
          assertContainedStorageTarget(storageRoot, fifo);
        } catch (err: any) {
          expect(err.code).toBe("INVALID_INPUT");
        }
      });
    }
  });
});
