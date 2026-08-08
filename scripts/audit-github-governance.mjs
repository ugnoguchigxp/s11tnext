import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const REQUIRED_CHECK = "required";
export const STABLE_ENVIRONMENT = "npm-stable";
export const STABLE_RELEASE_VARIABLE = "S11TNEXT_STABLE_RELEASE_ENABLED";

export class GovernanceAuditError extends Error {
	constructor(message) {
		super(message);
		this.name = "GovernanceAuditError";
	}
}

export function repositoryName(packageValue) {
	const repositoryUrl = packageValue.repository?.url;
	const match =
		typeof repositoryUrl === "string"
			? repositoryUrl.match(/github\.com[/:]([^/]+)\/([^/.]+)(?:\.git)?$/u)
			: null;
	if (!match)
		throw new GovernanceAuditError("Cannot resolve the GitHub owner and repository from package.json.");
	return `${match[1]}/${match[2]}`;
}

export function auditBranchProtection(value) {
	const checks = value.required_status_checks?.checks ?? [];
	const requiredCheck = checks.find((check) => check.context === REQUIRED_CHECK);
	const bypass = value.required_pull_request_reviews?.bypass_pull_request_allowances;
	requireRule(value.required_pull_request_reviews, "pull requests are required");
	requireRule(requiredCheck, `${REQUIRED_CHECK} is a required status check`);
	requireRule(
		Number.isInteger(requiredCheck?.app_id) && requiredCheck.app_id > 0,
		`${REQUIRED_CHECK} is bound to its GitHub App`,
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

export function auditRuleset(value, repository, api) {
	if (!Array.isArray(value))
		throw new GovernanceAuditError("GitHub returned an unexpected repository-rules response.");
	const detailsById = new Map();
	for (const rule of value) {
		if (!Number.isInteger(rule.ruleset_id)) {
			throw new GovernanceAuditError("GitHub returned a rule without a ruleset identifier.");
		}
		if (!detailsById.has(rule.ruleset_id)) {
			const details = api(`repos/${repository}/rulesets/${rule.ruleset_id}?includes_parents=true`);
			requireRule(details.enforcement === "active", `ruleset ${rule.ruleset_id} is active`);
			requireRule(
				Array.isArray(details.bypass_actors),
				`ruleset ${rule.ruleset_id} exposes bypass actors for audit`,
			);
			detailsById.set(rule.ruleset_id, details);
		}
	}
	const safeRules = value.filter((rule) => detailsById.get(rule.ruleset_id).bypass_actors.length === 0);
	const byType = new Map(safeRules.map((rule) => [rule.type, rule]));
	const status = byType.get("required_status_checks")?.parameters;
	const requiredCheck = (status?.required_status_checks ?? []).find(
		(check) => check.context === REQUIRED_CHECK,
	);
	requireRule(byType.has("pull_request"), "pull requests are required");
	requireRule(requiredCheck, `${REQUIRED_CHECK} is a required status check`);
	requireRule(
		Number.isInteger(requiredCheck?.integration_id) && requiredCheck.integration_id > 0,
		`${REQUIRED_CHECK} is bound to its GitHub App`,
	);
	requireRule(status?.strict_required_status_checks_policy === true, "required branches must be up to date");
	requireRule(byType.has("required_conversation_resolution"), "conversations must be resolved");
	requireRule(byType.has("non_fast_forward"), "force pushes are blocked");
	requireRule(byType.has("deletion"), "branch deletion is blocked");
}

export function auditStableEnvironment(value) {
	requireRule(value.name === STABLE_ENVIRONMENT, `${STABLE_ENVIRONMENT} exists`);
	requireRule(value.can_admins_bypass === false, `${STABLE_ENVIRONMENT} blocks administrator bypass`);
	const rules = value.protection_rules;
	requireRule(Array.isArray(rules), `${STABLE_ENVIRONMENT} exposes protection rules for audit`);
	const reviewerRule = rules.find((rule) => rule.type === "required_reviewers");
	requireRule(
		Array.isArray(reviewerRule?.reviewers) && reviewerRule.reviewers.length > 0,
		`${STABLE_ENVIRONMENT} has a required reviewer`,
	);
	requireRule(
		value.deployment_branch_policy?.protected_branches === true &&
			value.deployment_branch_policy?.custom_branch_policies === false,
		`${STABLE_ENVIRONMENT} accepts protected branches only`,
	);
}

export function auditStableReleaseVariable(value, releaseReady = false) {
	const variables = Array.isArray(value.variables) ? value.variables : [];
	const gate = variables.find((variable) => variable.name === STABLE_RELEASE_VARIABLE)?.value;
	if (releaseReady) {
		requireRule(gate === "true", `${STABLE_RELEASE_VARIABLE} is true for the approved release window`);
		return;
	}
	requireRule(gate !== "true", `${STABLE_RELEASE_VARIABLE} is disabled outside a release window`);
}

export function ghApi(endpoint, allowFailure = false) {
	const result = spawnSync("gh", ["api", endpoint], {
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	});
	if (result.error) throw new GovernanceAuditError(`GitHub CLI is required: ${result.error.message}`);
	if (result.status !== 0) {
		if (allowFailure) return null;
		throw new GovernanceAuditError(result.stderr.trim() || `gh api ${endpoint} failed.`);
	}
	try {
		return JSON.parse(result.stdout);
	} catch {
		throw new GovernanceAuditError(`GitHub returned invalid JSON for ${endpoint}.`);
	}
}

export function auditRepository(options = {}) {
	const args = options.args ?? [];
	const api = options.api ?? ghApi;
	const output = options.output ?? console.log;
	const stable = args.includes("--stable");
	const releaseReady = args.includes("--release-ready");
	const unknown = args.filter((argument) => argument !== "--stable" && argument !== "--release-ready");
	if (unknown.length > 0) throw new GovernanceAuditError(`Unknown argument: ${unknown[0]}`);
	if (releaseReady && !stable) {
		throw new GovernanceAuditError("--release-ready requires --stable.");
	}
	const rootPackage = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
	const repository = repositoryName(rootPackage);
	const protection = api(`repos/${repository}/branches/main/protection`, true);
	let protectionKind;
	if (protection) {
		auditBranchProtection(protection);
		protectionKind = "branch protection";
	} else {
		const rules = api(`repos/${repository}/rules/branches/main`, true);
		if (!rules) {
			throw new GovernanceAuditError(
				`Cannot read protection for ${repository}. Authenticate GitHub CLI with repository ` +
					"administration read access, then configure docs/release/github-governance.md.",
			);
		}
		auditRuleset(rules, repository, api);
		protectionKind = "active repository rules";
	}
	const vulnerabilityReporting = api(`repos/${repository}/private-vulnerability-reporting`);
	requireRule(vulnerabilityReporting.enabled === true, "private vulnerability reporting is enabled");
	if (stable) {
		auditStableEnvironment(api(`repos/${repository}/environments/${STABLE_ENVIRONMENT}`));
		auditStableReleaseVariable(api(`repos/${repository}/actions/variables?per_page=100`), releaseReady);
	}
	output(
		`GitHub governance audit passed for ${repository} using ${protectionKind}; ` +
			`private vulnerability reporting is enabled${stable ? `; ${STABLE_ENVIRONMENT} is protected and the stable gate is ${releaseReady ? "enabled" : "disabled"}` : ""}.`,
	);
}

function requireRule(condition, description) {
	if (!condition) throw new GovernanceAuditError(`GitHub governance audit failed: ${description}.`);
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	try {
		auditRepository({ args: process.argv.slice(2) });
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	}
}
