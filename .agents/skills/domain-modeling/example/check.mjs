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
assert.equal(nameMatch[1].trim(), "domain-modeling", "Skill name must be 'domain-modeling'");

const descMatch = frontmatter.match(/^description:\s*([^\r\n]+)/m);
assert.ok(descMatch && descMatch[1].trim().length > 0, "Frontmatter must contain a non-empty 'description'");

// 2. Validate required documents
const requiredDocs = ["SKILL.md", "ADR-FORMAT.md", "CONTEXT-FORMAT.md"];
for (const doc of requiredDocs) {
  const docPath = join(skillDir, doc);
  assert.ok(existsSync(docPath), `Required document ${doc} must exist`);
  const stat = lstatSync(docPath);
  assert.ok(stat.isFile(), `${doc} must be a regular file`);
  assert.ok(!stat.isSymbolicLink(), `${doc} must not be a symlink`);
  const content = readFileSync(docPath, "utf-8");
  assert.ok(content.trim().length > 0, `${doc} must not be empty`);
}

// 3. Validate ADR 3-criteria invariant in SKILL.md
const adrCriteria = [
  "Hard to reverse",
  "Surprising without context",
  "The result of a real trade-off",
];
for (const criterion of adrCriteria) {
  assert.ok(
    skillContent.includes(criterion),
    `SKILL.md must specify ADR criterion: ${criterion}`,
  );
}

// 4. Validate ADR-FORMAT.md structure
const adrFormatContent = readFileSync(join(skillDir, "ADR-FORMAT.md"), "utf-8");
assert.ok(
  adrFormatContent.includes("# {Short title of the decision}"),
  "ADR-FORMAT.md must contain decision title placeholder template",
);

// 5. Validate CONTEXT-FORMAT.md structure
const contextFormatContent = readFileSync(join(skillDir, "CONTEXT-FORMAT.md"), "utf-8");
assert.ok(
  contextFormatContent.includes("# {Context Name}"),
  "CONTEXT-FORMAT.md must contain context name template",
);
assert.ok(
  contextFormatContent.includes("_Avoid_:"),
  "CONTEXT-FORMAT.md must specify _Avoid_: conventions",
);

// Helper to strip fenced code blocks so code examples are not checked as real links
function stripCodeBlocks(md) {
  return md.replace(/```[\s\S]*?```/g, "");
}

// 6. Verify all local markdown links outside code blocks resolve within the skill
for (const doc of requiredDocs) {
  const content = readFileSync(join(skillDir, doc), "utf-8");
  const proseOnly = stripCodeBlocks(content);
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
      `${doc} contains relative link escaping skill directory: ${linkTarget}`,
    );
    assert.ok(existsSync(resolved), `${doc} contains link to non-existent target: ${linkTarget}`);
  }
}

// 7. Verify no symlinks anywhere in skill directory
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
