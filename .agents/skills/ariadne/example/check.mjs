import assert from "node:assert/strict";
import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const skillDir = resolve(__dirname, "..");

// 1. Validate SKILL.md and frontmatter
const skillPath = join(skillDir, "SKILL.md");
assert.ok(existsSync(skillPath), "SKILL.md must exist");
const skillContent = readFileSync(skillPath, "utf-8");

assert.ok(skillContent.startsWith("---\n"), "SKILL.md must start with frontmatter delimiter ---");
const fmEnd = skillContent.indexOf("\n---\n", 4);
assert.ok(fmEnd !== -1, "SKILL.md must have closing frontmatter delimiter ---");
const frontmatter = skillContent.slice(4, fmEnd);

const nameMatch = frontmatter.match(/^name:\s*([^\r\n]+)$/m);
assert.ok(nameMatch, "Frontmatter must contain 'name'");
assert.equal(nameMatch[1].trim(), "ariadne", "Skill name must be 'ariadne'");

const descMatch = frontmatter.match(/^description:\s*([^\r\n]+)/m);
assert.ok(descMatch && descMatch[1].trim().length > 0, "Frontmatter must contain a non-empty 'description'");

// 2. Validate rules directory and files
const rulesDir = join(skillDir, "rules");
assert.ok(existsSync(rulesDir), "rules directory must exist");

const expectedRules = [
  "00-core.md",
  "05-uncertainty.md",
  "10-frame.md",
  "20-diagnose.md",
  "30-transform.md",
  "40-explore.md",
  "50-knowledge.md",
  "60-dependencies.md",
  "70-dynamics.md",
  "80-value.md",
  "90-validate.md",
  "agent-rules.md",
  "depth-modes.md",
  "evidence.md",
  "invalidation.md",
  "roles.md",
];

const foundRules = readdirSync(rulesDir).sort();
assert.deepEqual(foundRules, expectedRules.slice().sort(), "rules directory must contain exactly the expected rules");

for (const rule of expectedRules) {
  const rulePath = join(rulesDir, rule);
  const stat = lstatSync(rulePath);
  assert.ok(stat.isFile(), `Rule ${rule} must be a regular file`);
  assert.ok(!stat.isSymbolicLink(), `Rule ${rule} must not be a symlink`);
  const content = readFileSync(rulePath, "utf-8");
  assert.ok(content.trim().length > 0, `Rule ${rule} must not be empty`);
  assert.ok(skillContent.includes(`rules/${rule}`), `SKILL.md must reference rules/${rule}`);
}

// 3. Validate routing invariants in SKILL.md
for (let i = 0; i <= 9; i++) {
  assert.match(
    skillContent,
    new RegExp(`^${i}\\.\\s+`, "m"),
    `SKILL.md must define branch ${i} in routing table`,
  );
}

// 4. Verify no symlinks and no path escaping throughout skill directory
function walkAndValidate(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    assert.ok(!entry.isSymbolicLink(), `Symbolic links are forbidden: ${fullPath}`);
    if (entry.isDirectory()) {
      walkAndValidate(fullPath);
    } else if (entry.isFile()) {
      const content = readFileSync(fullPath, "utf-8");
      // Check for escaping relative references
      const parentRefs = content.match(/\.\.\/[^\s)'"]+/g) || [];
      for (const ref of parentRefs) {
        const target = resolve(dir, ref);
        const rel = relative(skillDir, target);
        assert.ok(
          !rel.startsWith("..") && !rel.startsWith("/"),
          `File ${fullPath} contains relative path escaping skill directory: ${ref}`,
        );
      }
    }
  }
}

walkAndValidate(skillDir);

console.log("All verification checks passed!");
process.exit(0);
