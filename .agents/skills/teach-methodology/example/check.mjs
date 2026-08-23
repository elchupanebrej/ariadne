import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// 1. Read solution guide-project.json
const projectPath = resolve(__dirname, "solution/guide-project.json");
const project = JSON.parse(readFileSync(projectPath, "utf-8"));

// 2. Validate format and contract pin
assert.equal(project.format, "methodological-guide-project/1");
assert.equal(project.contract_pin.profile, "evidence_focused");
assert.ok(project.contract_pin.version, "Contract version must be pinned");
assert.ok(project.contract_pin.digest, "Contract digest must be pinned");
assert.equal(project.guide_pin.href, "docs/designing_methodological_guides.md");

// 3. Validate A0 concise working map and expansion triggers
const a0 = project.artifacts.A0;
assert.ok(a0.user_and_situation, "A0 missing user_and_situation");
assert.ok(a0.action, "A0 missing action");
assert.ok(a0.learning_path, "A0 missing learning_path");
assert.ok(a0.verification, "A0 missing verification");
assert.ok(a0.rationale_and_unknowns, "A0 missing rationale_and_unknowns");
assert.ok(a0.next_step, "A0 missing next_step");
assert.equal(Object.keys(a0.expansion_signals).length, 7, "A0 must record signals for all 7 specialized artifacts");

// 4. Validate A1–A7 artifact completeness
const requiredArtifacts = ["A1", "A2", "A3", "A4", "A5", "A6", "A7"];
for (const art of requiredArtifacts) {
  assert.ok(project.artifacts[art], `Missing triggered artifact ${art}`);
}

// 5. Validate A2 rationale claims and live anchor references
const claims = project.artifacts.A2.claims;
assert.ok(claims.length >= 3, "A2 must declare at least 3 claims");
for (const c of claims) {
  assert.ok(c.id, "Claim missing ID");
  assert.ok(c.rationale_to_recommendation.length > 20, "Claim rationale inference must be substantive");
  assert.match(c.rationale_ref, /^docs\/designing_methodological_guides\.md#/, "rationale_ref must point to live guide anchor");
}

// 6. Validate A3 user roles and non-synthesized authority
const roles = project.artifacts.A3.roles;
assert.ok(roles.novice_reviewer, "A3 missing novice_reviewer role");
assert.ok(roles.security_owner, "A3 missing security_owner role");
assert.ok(roles.legal_owner, "A3 missing legal_owner role");
assert.ok(!roles.novice_reviewer.authority.includes("waive_policy"), "Novice reviewer must not have policy waiver authority");

// 7. Validate A4 executable rules
const rules = project.artifacts.A4.rules;
assert.ok(rules.length >= 3, "A4 must declare at least 3 rules");
const reviewRule = rules.find(r => r.id === "RULE-review-dependency-change");
assert.ok(reviewRule, "A4 missing RULE-review-dependency-change");
assert.ok(reviewRule.branches.length >= 4, "Review rule must define all 4 branches");
assert.ok(reviewRule.recovery, "Review rule must define recovery");
assert.ok(reviewRule.escalation, "Review rule must define escalation");

// 8. Validate Traceability rows
assert.ok(project.traceability.length >= 3, "Traceability matrix must have at least 3 rows");
for (const t of project.traceability) {
  assert.ok(t.rule_id, "Traceability row missing rule_id");
  assert.ok(t.claim_id, "Traceability row missing claim_id");
  assert.ok(t.learning_id, "Traceability row missing learning_id");
  assert.ok(t.verification_id, "Traceability row missing verification_id");
  assert.ok(t.lifecycle_version, "Traceability row missing lifecycle_version");
}

// 9. Validate External receipts
const receiptsPath = resolve(__dirname, "receipts/external-verification.json");
const receiptsData = JSON.parse(readFileSync(receiptsPath, "utf-8"));
assert.equal(receiptsData.receipt_class, "external-verification");
assert.ok(receiptsData.receipts.length >= 3, "Must contain expert, novice, and pilot receipts");

// 10. Validate Invalid Paths Rejection (Fail-closed assertions)
function validateProject(p, receipts) {
  if (!p.contract_pin?.digest || p.contract_pin.digest === "none") {
    throw new Error("Rejected: unpinned contract digest");
  }
  for (const c of p.artifacts?.A2?.claims || []) {
    if (!c.rationale_ref || !c.rationale_ref.includes("#")) {
      throw new Error("Rejected: unresolved rationale link");
    }
  }
  if (p.artifacts?.A3?.roles?.novice_reviewer?.authority?.includes("waive_policy")) {
    throw new Error("Rejected: synthesized policy waiver authority");
  }
  if (receipts?.receipt_class === "self-consistency" && p.contract_pin?.profile === "evidence_focused") {
    throw new Error("Rejected: circular self-consistency proof substituted for external verification");
  }
  return true;
}

// Baseline valid project passes
assert.equal(validateProject(project, receiptsData), true);

// Invalid path 1: unpinned contract
assert.throws(() => {
  const invalid = JSON.parse(JSON.stringify(project));
  invalid.contract_pin.digest = "none";
  validateProject(invalid, receiptsData);
}, /unpinned contract digest/);

// Invalid path 2: broken rationale link
assert.throws(() => {
  const invalid = JSON.parse(JSON.stringify(project));
  invalid.artifacts.A2.claims[0].rationale_ref = "unresolved-anchor";
  validateProject(invalid, receiptsData);
}, /unresolved rationale link/);

// Invalid path 3: synthesized policy waiver
assert.throws(() => {
  const invalid = JSON.parse(JSON.stringify(project));
  invalid.artifacts.A3.roles.novice_reviewer.authority.push("waive_policy");
  validateProject(invalid, receiptsData);
}, /synthesized policy waiver authority/);

// Invalid path 4: circular proof
assert.throws(() => {
  const invalidReceipts = { receipt_class: "self-consistency" };
  validateProject(project, invalidReceipts);
}, /circular self-consistency proof/);

// 11. Validate Metamethodology & Acyclicity Rules
function validateMetamethodologyProject(p, receipts) {
  if (p.contract_pin?.profile !== "metamethodological") {
    throw new Error("Rejected: expected metamethodological profile");
  }
  if (p.acyclicity_metadata?.self_invocation === true) {
    throw new Error("Rejected: self_invocation attempted");
  }
  if (p.acyclicity_metadata?.active_rewriting === true) {
    throw new Error("Rejected: active_rewriting attempted");
  }
  if (!receipts?.self_consistency) {
    throw new Error("Rejected: missing self_consistency receipts for metamethodological profile");
  }
  return true;
}

const metaProject = {
  format: "methodological-guide-project/1",
  id: "metamethodology-authoring-guide",
  contract_pin: {
    id: "methodological-guide-authoring",
    version: "1.0.0-draft",
    digest: "sha256:methodological-guide-authoring-v1",
    profile: "metamethodological",
  },
  guide_pin: {
    href: "docs/designing_methodological_guides.md",
  },
  acyclicity_metadata: {
    immutable_round: "round-1",
    build_time_input: true,
    self_invocation: false,
    active_rewriting: false,
  },
  receipts: {
    self_consistency: {
      assessor_a: "passed",
      assessor_b: "passed",
      fixed_point: "passed",
    },
  },
};

assert.equal(validateMetamethodologyProject(metaProject, metaProject.receipts), true);

// Invalid path 5: metamethodological self-invocation
assert.throws(() => {
  const invalid = JSON.parse(JSON.stringify(metaProject));
  invalid.acyclicity_metadata.self_invocation = true;
  validateMetamethodologyProject(invalid, invalid.receipts);
}, /self_invocation attempted/);

// Invalid path 6: active rewriting
assert.throws(() => {
  const invalid = JSON.parse(JSON.stringify(metaProject));
  invalid.acyclicity_metadata.active_rewriting = true;
  validateMetamethodologyProject(invalid, invalid.receipts);
}, /active_rewriting attempted/);

console.log("All Methodology Authoring guide project checks, transfer assertions, and invalid path rejections passed successfully.");
