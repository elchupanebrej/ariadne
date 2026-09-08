import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");

const CANONICAL_SKILLS = [
  "ariadne",
  "codebase-design",
  "grilling",
  "domain-modeling",
] as const;

describe("Package Manifest & Canonical Skills (Ticket 11)", () => {
  const pkgPath = join(repoRoot, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));

  describe("package.json manifest requirements", () => {
    it("declares version 0.2.0", () => {
      expect(pkg.version).toBe("0.2.0");
    });

    it("locks engines to Node ^22.0.0 || ^24.0.0", () => {
      expect(pkg.engines?.node).toBe("^22.0.0 || ^24.0.0");
    });

    it("restricts bin to a single binary 'ariadne'", () => {
      expect(pkg.bin).toEqual({
        ariadne: "dist/cli/index.js",
      });
    });

    it("explicitly enumerates dist, the 4 canonical skills, README.md, and LICENSE in files", () => {
      expect(pkg.files).toEqual([
        "dist",
        ".agents/skills/ariadne",
        ".agents/skills/codebase-design",
        ".agents/skills/grilling",
        ".agents/skills/domain-modeling",
        "README.md",
        "LICENSE",
      ]);
    });
  });

  describe("Skill self-containment & isolation", () => {
    it("ensures .agents/skills/methodize-harness/ is completely absent", () => {
      const harnessPath = join(repoRoot, ".agents/skills/methodize-harness");
      expect(existsSync(harnessPath)).toBe(false);
    });

    for (const skill of CANONICAL_SKILLS) {
      it(`ensures ${skill} contains no symlinks or files escaping its directory`, () => {
        const skillDir = join(repoRoot, ".agents/skills", skill);
        expect(existsSync(skillDir)).toBe(true);

        const rootStat = lstatSync(skillDir);
        expect(rootStat.isSymbolicLink(), `${skill} skill directory must not be a symlink`).toBe(false);
        expect(rootStat.isDirectory(), `${skill} must be a directory`).toBe(true);

        function walk(dir: string): void {
          const entries = readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = join(dir, entry.name);
            expect(entry.isSymbolicLink(), `Symlink found: ${fullPath}`).toBe(false);

            if (entry.isDirectory()) {
              walk(fullPath);
            } else if (entry.isFile()) {
              const content = readFileSync(fullPath, "utf-8");
              const parentRefs = content.match(/\.\.\/[^\s)'"]+/g) || [];
              for (const ref of parentRefs) {
                const target = resolve(dir, ref);
                const rel = relative(skillDir, target);
                expect(
                  rel.startsWith(".."),
                  `File ${fullPath} contains relative path escaping skill directory: ${ref}`,
                ).toBe(false);
              }
            }
          }
        }

        walk(skillDir);
      });
    }
  });

  describe("Example check scripts", () => {
    for (const skill of CANONICAL_SKILLS) {
      it(`runs example/check.mjs for ${skill} successfully`, () => {
        const checkScript = join(repoRoot, ".agents/skills", skill, "example/check.mjs");
        expect(existsSync(checkScript), `${skill}/example/check.mjs must exist`).toBe(true);

        const stdout = execFileSync(process.execPath, [checkScript], {
          cwd: repoRoot,
          encoding: "utf-8",
          stdio: ["ignore", "pipe", "pipe"],
        });

        expect(stdout).toContain("All verification checks passed!");
      });
    }
  });
});
