import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const rootPackage = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const repositoryUrl = rootPackage.repository?.url;
const match =
	typeof repositoryUrl === "string"
		? repositoryUrl.match(/github\.com[/:]([^/]+)\/([^/.]+)(?:\.git)?$/u)
		: null;

if (!match) {
  fail("Cannot resolve the GitHub owner and repository from package.json.");
}

const repository = `${match[1]}/${match[2]}`;

const protection = ghApi(`repos/${repository}/branches/main/protection`, true);
let protectionKind;
if (protection) {
	auditBranchProtection(protection);
	protectionKind = "branch protection";
} else {
	const rules = ghApi(`repos/${repository}/rules/branches/main`, true);
	if (!rules) {
		fail(
			`Cannot read protection for ${repository}. Authenticate GitHub CLI with repository ` +
				"administration read access, then configure the rules in " +
				"docs/release/github-governance.md.",
		);
	}
	auditRuleset(rules, repository);
	protectionKind = "active repository rules";
}

const vulnerabilityReporting = ghApi(`repos/${repository}/private-vulnerability-reporting`);
requireRule(
	vulnerabilityReporting.enabled === true,
	"private vulnerability reporting is enabled",
);
console.log(
	`GitHub governance audit passed for ${repository} using ${protectionKind}; ` +
		"private vulnerability reporting is enabled.",
);

function ghApi(endpoint, allowFailure = false) {
  const result = spawnSync("gh", ["api", endpoint], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error) {
    fail(`GitHub CLI is required: ${result.error.message}`);
  }
  if (result.status !== 0) {
    if (allowFailure) return null;
    fail(result.stderr.trim() || `gh api ${endpoint} failed.`);
  }
  try {
    return JSON.parse(result.stdout);
  } catch {
    fail(`GitHub returned invalid JSON for ${endpoint}.`);
  }
}

function auditBranchProtection(value) {
	const checks = value.required_status_checks?.checks ?? [];
	const requiredCheck = checks.find((check) => check.context === "CI / required");
	const bypass = value.required_pull_request_reviews?.bypass_pull_request_allowances;
	requireRule(value.required_pull_request_reviews, "pull requests are required");
	requireRule(requiredCheck, "CI / required is a required status check");
	requireRule(
		Number.isInteger(requiredCheck?.app_id) && requiredCheck.app_id > 0,
		"CI / required is bound to its GitHub App",
	);
	requireRule(value.required_status_checks?.strict === true, "required branches must be up to date");
	requireRule(value.required_conversation_resolution?.enabled === true, "conversations must be resolved");
	requireRule(value.enforce_admins?.enabled === true, "rules apply to administrators");
	requireRule(
		[...(bypass?.users ?? []), ...(bypass?.teams ?? []), ...(bypass?.apps ?? [])].length === 0,
		"pull-request bypass allowances are empty",
	);
	requireRule(value.allow_force_pushes?.enabled === false, "force pushes are blocked");
	requireRule(value.allow_deletions?.enabled === false, "branch deletion is blocked");
}

function auditRuleset(value, repositoryName) {
	if (!Array.isArray(value)) fail("GitHub returned an unexpected repository-rules response.");
	const detailsById = new Map();
	for (const rule of value) {
		if (!Number.isInteger(rule.ruleset_id)) {
			fail("GitHub returned a rule without a ruleset identifier.");
		}
		if (!detailsById.has(rule.ruleset_id)) {
			const details = ghApi(
				`repos/${repositoryName}/rulesets/${rule.ruleset_id}?includes_parents=true`,
			);
			requireRule(details.enforcement === "active", `ruleset ${rule.ruleset_id} is active`);
			requireRule(
				Array.isArray(details.bypass_actors),
				`ruleset ${rule.ruleset_id} exposes bypass actors for audit`,
			);
			detailsById.set(rule.ruleset_id, details);
		}
	}
	const safeRules = value.filter(
		(rule) => detailsById.get(rule.ruleset_id).bypass_actors.length === 0,
	);
	const byType = new Map(safeRules.map((rule) => [rule.type, rule]));
	const status = byType.get("required_status_checks")?.parameters;
	const requiredCheck = (status?.required_status_checks ?? []).find(
		(check) => check.context === "CI / required",
	);
	requireRule(byType.has("pull_request"), "pull requests are required");
	requireRule(requiredCheck, "CI / required is a required status check");
	requireRule(
		Number.isInteger(requiredCheck?.integration_id) && requiredCheck.integration_id > 0,
		"CI / required is bound to its GitHub App",
	);
  requireRule(
    status?.strict_required_status_checks_policy === true,
    "required branches must be up to date",
  );
  requireRule(byType.has("required_conversation_resolution"), "conversations must be resolved");
  requireRule(byType.has("non_fast_forward"), "force pushes are blocked");
  requireRule(byType.has("deletion"), "branch deletion is blocked");
}

function requireRule(condition, description) {
  if (!condition) fail(`GitHub governance audit failed: ${description}.`);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
