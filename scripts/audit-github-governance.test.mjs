import { describe, expect, it, vi } from "vitest";

import {
	auditBranchProtection,
	auditRuleset,
	auditStableEnvironment,
	auditStableReleaseVariable,
	GovernanceAuditError,
	repositoryName,
} from "./audit-github-governance.mjs";

function branchProtection(context = "required") {
	return {
		required_status_checks: { strict: true, checks: [{ context, app_id: 15_368 }] },
		required_pull_request_reviews: {
			bypass_pull_request_allowances: { users: [], teams: [], apps: [] },
		},
		required_conversation_resolution: { enabled: true },
		enforce_admins: { enabled: true },
		allow_force_pushes: { enabled: false },
		allow_deletions: { enabled: false },
	};
}

function stableEnvironment(overrides = {}) {
	return {
		name: "npm-stable",
		can_admins_bypass: false,
		protection_rules: [
			{
				type: "required_reviewers",
				reviewers: [{ type: "User", reviewer: { login: "maintainer" } }],
			},
		],
		deployment_branch_policy: { protected_branches: true, custom_branch_policies: false },
		...overrides,
	};
}

describe("GitHub governance audit", () => {
	it("resolves GitHub repository URLs and rejects other hosts", () => {
		expect(repositoryName({ repository: { url: "git+https://github.com/example/project.git" } })).toBe(
			"example/project",
		);
		expect(() => repositoryName({ repository: { url: "https://example.com/project" } })).toThrow(
			GovernanceAuditError,
		);
	});

	it("requires the actual aggregate check-run name and GitHub App binding", () => {
		expect(() => auditBranchProtection(branchProtection())).not.toThrow();
		expect(() => auditBranchProtection(branchProtection("CI / required"))).toThrow(
			"required is a required status check",
		);
		expect(() =>
			auditBranchProtection({
				...branchProtection(),
				required_status_checks: { strict: true, checks: [{ context: "required", app_id: null }] },
			}),
		).toThrow("required is bound to its GitHub App");
	});

	it("accepts an active bypass-free equivalent ruleset", () => {
		const rules = [
			{ ruleset_id: 1, type: "pull_request" },
			{
				ruleset_id: 1,
				type: "required_status_checks",
				parameters: {
					strict_required_status_checks_policy: true,
					required_status_checks: [{ context: "required", integration_id: 15_368 }],
				},
			},
			{ ruleset_id: 1, type: "required_conversation_resolution" },
			{ ruleset_id: 1, type: "non_fast_forward" },
			{ ruleset_id: 1, type: "deletion" },
		];
		const api = vi.fn(() => ({ enforcement: "active", bypass_actors: [] }));
		expect(() => auditRuleset(rules, "example/project", api)).not.toThrow();
		expect(api).toHaveBeenCalledOnce();
	});

	it("requires a reviewer, blocks admins, and limits stable deployments to protected branches", () => {
		expect(() => auditStableEnvironment(stableEnvironment())).not.toThrow();
		expect(() => auditStableEnvironment(stableEnvironment({ can_admins_bypass: true }))).toThrow(
			"blocks administrator bypass",
		);
		expect(() => auditStableEnvironment(stableEnvironment({ protection_rules: [] }))).toThrow(
			"has a required reviewer",
		);
		expect(() => auditStableEnvironment(stableEnvironment({ deployment_branch_policy: null }))).toThrow(
			"accepts protected branches only",
		);
	});

	it("keeps stable publishing disabled except during an explicit release window", () => {
		expect(() => auditStableReleaseVariable({ variables: [] })).not.toThrow();
		expect(() =>
			auditStableReleaseVariable({
				variables: [{ name: "S11TNEXT_STABLE_RELEASE_ENABLED", value: "true" }],
			}),
		).toThrow("disabled outside a release window");
		expect(() =>
			auditStableReleaseVariable(
				{ variables: [{ name: "S11TNEXT_STABLE_RELEASE_ENABLED", value: "true" }] },
				true,
			),
		).not.toThrow();
	});
});
