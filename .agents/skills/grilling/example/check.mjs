import assert from "node:assert/strict";
import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const skillDir = resolve(__dirname, "..");

// 1. Validate SKILL.md and frontmatter
const skillPath = join(skillDir, "SKILL.md");
assert.ok(existsSync(skillPath), "SKILL.md must exist");
const stat = lstatSync(skillPath);
assert.ok(stat.isFile(), "SKILL.md must be a regular file");
assert.ok(!stat.isSymbolicLink(), "SKILL.md must not be a symlink");

const skillContent = readFileSync(skillPath, "utf-8");
assert.ok(skillContent.startsWith("---\n"), "SKILL.md must start with frontmatter delimiter ---");
const fmEnd = skillContent.indexOf("\n---\n", 4);
assert.ok(fmEnd !== -1, "SKILL.md must have closing frontmatter delimiter ---");
const frontmatter = skillContent.slice(4, fmEnd);

const nameMatch = frontmatter.match(/^name:\s*([^\r\n]+)$/m);
assert.ok(nameMatch, "Frontmatter must contain 'name'");
assert.equal(nameMatch[1].trim(), "grilling", "Skill name must be 'grilling'");

const descMatch = frontmatter.match(/^description:\s*([^\r\n]+)/m);
assert.ok(descMatch && descMatch[1].trim().length > 0, "Frontmatter must contain a non-empty 'description'");

// 2. Validate core concepts and invariants in SKILL.md
const requiredConcepts = [
  "design tree",
  "rounds",
  "frontier",
  "❓ **Q",
  "➡️",
];

for (const concept of requiredConcepts) {
  assert.ok(
    skillContent.includes(concept),
    `SKILL.md must contain core concept: ${concept}`,
  );
}

assert.match(
  skillContent,
  /frontier is empty/i,
  "SKILL.md must define termination condition (frontier is empty)",
);

// Helper to strip fenced code blocks
function stripCodeBlocks(md) {
  return md.replace(/```[\s\S]*?```/g, "");
}

// 3. Verify all local markdown links resolve within the skill
const proseOnly = stripCodeBlocks(skillContent);
const linkMatches = proseOnly.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g);
for (const match of linkMatches) {
  const linkTarget = match[2];
  if (linkTarget.startsWith("http://") || linkTarget.startsWith("https://") || linkTarget.startsWith("#")) {
    continue;
  }
  const resolved = resolve(skillDir, linkTarget);
  const rel = relative(skillDir, resolved);
  assert.ok(
    !rel.startsWith("..") && !rel.startsWith("/"),
    `SKILL.md contains relative link escaping skill directory: ${linkTarget}`,
  );
  assert.ok(existsSync(resolved), `SKILL.md contains link to non-existent target: ${linkTarget}`);
}

// 4. Verify no symlinks anywhere in skill directory
function walkAndValidate(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    assert.ok(!entry.isSymbolicLink(), `Symbolic links are forbidden: ${fullPath}`);
    if (entry.isDirectory()) {
      walkAndValidate(fullPath);
    }
  }
}

walkAndValidate(skillDir);

console.log("All verification checks passed!");
process.exit(0);
