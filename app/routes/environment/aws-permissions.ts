// AWS permissions catalogue for the AWS Role credential.
//
// Reuses the OAuth scope-picker machinery (ServiceScope / ScopeSelection /
// ScopeServiceRow) but the "scopes" here are IAM actions, and the selection is
// collapsed into an IAM permissions-policy JSON rather than an OAuth scope
// string. Unlike OAuth scopes, this selection is NOT sent to any provider — the
// permissions live on the customer's role and are enforced by AWS. It is purely
// a least-privilege policy generator: the user picks per-service access levels
// and copies the resulting policy into their role.
//
// Each level lists its COMPLETE action set (levels are not additive at collapse
// time — the picker takes the selected level's actions as-is). Add a new service
// here as each AWS action category ships (RDS, VPC, ASG, ELB, …).

import type { ServiceScope, ScopeSelection } from "./scope-catalogue";

export const awsPermissionCatalogue: ServiceScope[] = [
    {
        id: "ec2",
        name: "EC2 (Compute)",
        icon: "server",
        description: "Read-only lists instances/volumes/AMIs; Manage adds launch/start/stop and security-group edits; Full adds terminate & delete.",
        levels: [
            { value: "none", label: "None", scopes: [] },
            { value: "read", label: "Read-only", scopes: ["ec2:Describe*"] },
            {
                value: "manage", label: "Manage", scopes: [
                    "ec2:Describe*", "ec2:RunInstances", "ec2:StartInstances", "ec2:StopInstances",
                    "ec2:RebootInstances", "ec2:CreateTags", "ec2:CreateSnapshot",
                    "ec2:CreateSecurityGroup", "ec2:AuthorizeSecurityGroupIngress", "ec2:RevokeSecurityGroupIngress",
                ],
            },
            {
                value: "full", label: "Full", scopes: [
                    "ec2:Describe*", "ec2:RunInstances", "ec2:StartInstances", "ec2:StopInstances",
                    "ec2:RebootInstances", "ec2:CreateTags", "ec2:CreateSnapshot",
                    "ec2:CreateSecurityGroup", "ec2:AuthorizeSecurityGroupIngress", "ec2:RevokeSecurityGroupIngress",
                    "ec2:TerminateInstances", "ec2:DeleteSecurityGroup",
                ],
            },
        ],
    },
    {
        id: "s3",
        name: "S3 (Storage)",
        icon: "box-archive",
        description: "Read gets and lists objects; Write adds put & delete.",
        levels: [
            { value: "none", label: "None", scopes: [] },
            { value: "read", label: "Read", scopes: ["s3:GetObject", "s3:ListBucket"] },
            { value: "write", label: "Read/Write", scopes: ["s3:GetObject", "s3:ListBucket", "s3:PutObject", "s3:DeleteObject"] },
        ],
    },
];

// defaultAwsSelection seeds every service to its first level (None).
export function defaultAwsSelection(): ScopeSelection {
    const selection: ScopeSelection = new Map();
    for (const svc of awsPermissionCatalogue) {
        selection.set(svc.id, { level: svc.levels?.[0]?.value, toggles: new Set() });
    }
    return selection;
}

// awsSelectedActions collapses the selection to a sorted, de-duplicated list of
// IAM actions across all non-None levels.
export function awsSelectedActions(selection: ScopeSelection): string[] {
    const actions = new Set<string>();
    for (const svc of awsPermissionCatalogue) {
        const sel = selection.get(svc.id);
        const level = svc.levels?.find(l => l.value === sel?.level);
        if (level && level.value !== "none") {
            level.scopes.forEach(a => actions.add(a));
        }
        // Orthogonal toggles (none defined yet, but honoured for future services).
        for (const toggle of svc.toggles ?? []) {
            if (sel?.toggles.has(toggle.id)) toggle.scopes.forEach(a => actions.add(a));
        }
    }
    return Array.from(actions).sort();
}

// awsSelectionToPolicy renders the IAM permissions policy for the selected
// actions, or "" when nothing is selected.
export function awsSelectionToPolicy(selection: ScopeSelection): string {
    const actions = awsSelectedActions(selection);
    if (actions.length === 0) return "";
    return JSON.stringify({
        Version: "2012-10-17",
        Statement: [{ Effect: "Allow", Action: actions, Resource: "*" }],
    }, null, 2);
}
