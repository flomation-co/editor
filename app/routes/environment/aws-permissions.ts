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
// time — the picker takes the selected level's actions as-is). Keep this in step
// with the shipped aws/* action categories in the executor.
//
// NOTE: "VPC" uses the ec2: IAM prefix (VPC ops live in the EC2 API), so it
// overlaps EC2's actions. That's fine: the selection is persisted as a structured
// {service: level} map (see selectionToLevels), not a parsed action list, and the
// collapsed policy de-dupes.

import type { ServiceScope, ScopeSelection } from "./scope-catalogue";

export const awsPermissionCatalogue: ServiceScope[] = [
    {
        id: "ec2",
        name: "EC2 (Compute)",
        icon: "server",
        description: "Read lists instances/volumes/AMIs; Manage adds launch/start/stop, tags, snapshots, security-group & key-pair edits; Full adds terminate & delete.",
        levels: [
            { value: "none", label: "None", scopes: [] },
            { value: "read", label: "Read-only", scopes: ["ec2:Describe*"] },
            {
                value: "manage", label: "Manage", scopes: [
                    "ec2:Describe*", "ec2:RunInstances", "ec2:StartInstances", "ec2:StopInstances", "ec2:RebootInstances",
                    "ec2:CreateTags", "ec2:DeleteTags", "ec2:CreateSnapshot", "ec2:CreateImage",
                    "ec2:CreateSecurityGroup", "ec2:AuthorizeSecurityGroupIngress", "ec2:RevokeSecurityGroupIngress",
                    "ec2:AuthorizeSecurityGroupEgress", "ec2:RevokeSecurityGroupEgress",
                    "ec2:CreateVolume", "ec2:AttachVolume", "ec2:DetachVolume",
                    "ec2:AllocateAddress", "ec2:AssociateAddress", "ec2:CreateKeyPair", "ec2:ImportKeyPair",
                ],
            },
            {
                value: "full", label: "Full", scopes: [
                    "ec2:Describe*", "ec2:RunInstances", "ec2:StartInstances", "ec2:StopInstances", "ec2:RebootInstances",
                    "ec2:CreateTags", "ec2:DeleteTags", "ec2:CreateSnapshot", "ec2:CreateImage",
                    "ec2:CreateSecurityGroup", "ec2:AuthorizeSecurityGroupIngress", "ec2:RevokeSecurityGroupIngress",
                    "ec2:AuthorizeSecurityGroupEgress", "ec2:RevokeSecurityGroupEgress",
                    "ec2:CreateVolume", "ec2:AttachVolume", "ec2:DetachVolume",
                    "ec2:AllocateAddress", "ec2:AssociateAddress", "ec2:CreateKeyPair", "ec2:ImportKeyPair",
                    "ec2:TerminateInstances", "ec2:DeleteSecurityGroup", "ec2:DeleteVolume", "ec2:DeleteSnapshot",
                    "ec2:DeregisterImage", "ec2:ReleaseAddress", "ec2:DeleteKeyPair",
                ],
            },
        ],
    },
    {
        id: "s3",
        name: "S3 (Storage)",
        icon: "box-archive",
        description: "Read gets & lists objects; Read/Write adds put & delete; Full adds bucket create/delete & policy management.",
        levels: [
            { value: "none", label: "None", scopes: [] },
            { value: "read", label: "Read", scopes: ["s3:GetObject", "s3:ListBucket", "s3:GetBucketLocation", "s3:ListAllMyBuckets"] },
            {
                value: "write", label: "Read/Write", scopes: [
                    "s3:GetObject", "s3:ListBucket", "s3:GetBucketLocation", "s3:ListAllMyBuckets",
                    "s3:PutObject", "s3:DeleteObject",
                ],
            },
            {
                value: "full", label: "Full", scopes: [
                    "s3:GetObject", "s3:ListBucket", "s3:GetBucketLocation", "s3:ListAllMyBuckets",
                    "s3:PutObject", "s3:DeleteObject",
                    "s3:CreateBucket", "s3:DeleteBucket", "s3:PutBucketPolicy", "s3:GetBucketPolicy",
                    "s3:PutBucketTagging", "s3:PutLifecycleConfiguration", "s3:PutBucketVersioning",
                ],
            },
        ],
    },
    {
        id: "rds",
        name: "RDS / Aurora (Databases)",
        icon: "database",
        description: "Read describes instances & clusters; Manage adds create/modify/snapshot/start/stop; Full adds delete.",
        levels: [
            { value: "none", label: "None", scopes: [] },
            { value: "read", label: "Read-only", scopes: ["rds:Describe*", "rds:ListTagsForResource"] },
            {
                value: "manage", label: "Manage", scopes: [
                    "rds:Describe*", "rds:ListTagsForResource", "rds:CreateDBInstance", "rds:ModifyDBInstance",
                    "rds:CreateDBSnapshot", "rds:RebootDBInstance", "rds:StartDBInstance", "rds:StopDBInstance",
                    "rds:CreateDBCluster", "rds:ModifyDBCluster", "rds:AddTagsToResource",
                ],
            },
            {
                value: "full", label: "Full", scopes: [
                    "rds:Describe*", "rds:ListTagsForResource", "rds:CreateDBInstance", "rds:ModifyDBInstance",
                    "rds:CreateDBSnapshot", "rds:RebootDBInstance", "rds:StartDBInstance", "rds:StopDBInstance",
                    "rds:CreateDBCluster", "rds:ModifyDBCluster", "rds:AddTagsToResource",
                    "rds:DeleteDBInstance", "rds:DeleteDBSnapshot", "rds:DeleteDBCluster",
                ],
            },
        ],
    },
    {
        id: "vpc",
        name: "VPC (Networking)",
        icon: "network-wired",
        description: "Read describes the network fabric; Manage adds create VPCs/subnets/route tables/gateways/peering; Full adds delete. (Uses the ec2: IAM namespace.)",
        levels: [
            { value: "none", label: "None", scopes: [] },
            { value: "read", label: "Read-only", scopes: ["ec2:Describe*"] },
            {
                value: "manage", label: "Manage", scopes: [
                    "ec2:Describe*", "ec2:CreateVpc", "ec2:ModifyVpcAttribute", "ec2:CreateSubnet", "ec2:ModifySubnetAttribute",
                    "ec2:CreateRouteTable", "ec2:CreateRoute", "ec2:AssociateRouteTable",
                    "ec2:CreateInternetGateway", "ec2:AttachInternetGateway", "ec2:CreateNatGateway",
                    "ec2:CreateVpcPeeringConnection", "ec2:AcceptVpcPeeringConnection",
                    "ec2:CreateNetworkAcl", "ec2:CreateFlowLogs", "ec2:CreateVpcEndpoint",
                    "ec2:AllocateAddress", "ec2:CreateTags",
                ],
            },
            {
                value: "full", label: "Full", scopes: [
                    "ec2:Describe*", "ec2:CreateVpc", "ec2:ModifyVpcAttribute", "ec2:CreateSubnet", "ec2:ModifySubnetAttribute",
                    "ec2:CreateRouteTable", "ec2:CreateRoute", "ec2:AssociateRouteTable",
                    "ec2:CreateInternetGateway", "ec2:AttachInternetGateway", "ec2:CreateNatGateway",
                    "ec2:CreateVpcPeeringConnection", "ec2:AcceptVpcPeeringConnection",
                    "ec2:CreateNetworkAcl", "ec2:CreateFlowLogs", "ec2:CreateVpcEndpoint",
                    "ec2:AllocateAddress", "ec2:CreateTags",
                    "ec2:DeleteVpc", "ec2:DeleteSubnet", "ec2:DeleteRouteTable", "ec2:DeleteRoute",
                    "ec2:DetachInternetGateway", "ec2:DeleteInternetGateway", "ec2:DeleteNatGateway",
                    "ec2:DeleteVpcPeeringConnection", "ec2:DeleteNetworkAcl", "ec2:DeleteFlowLogs",
                    "ec2:DeleteVpcEndpoints", "ec2:ReleaseAddress",
                ],
            },
        ],
    },
    {
        id: "dynamodb",
        name: "DynamoDB (NoSQL)",
        icon: "layer-group",
        description: "Read gets/queries/scans items; Read/Write adds put/update/delete; Full adds table create/delete.",
        levels: [
            { value: "none", label: "None", scopes: [] },
            {
                value: "read", label: "Read", scopes: [
                    "dynamodb:GetItem", "dynamodb:BatchGetItem", "dynamodb:Query", "dynamodb:Scan",
                    "dynamodb:DescribeTable", "dynamodb:ListTables",
                ],
            },
            {
                value: "write", label: "Read/Write", scopes: [
                    "dynamodb:GetItem", "dynamodb:BatchGetItem", "dynamodb:Query", "dynamodb:Scan",
                    "dynamodb:DescribeTable", "dynamodb:ListTables",
                    "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem", "dynamodb:BatchWriteItem",
                ],
            },
            {
                value: "full", label: "Full", scopes: [
                    "dynamodb:GetItem", "dynamodb:BatchGetItem", "dynamodb:Query", "dynamodb:Scan",
                    "dynamodb:DescribeTable", "dynamodb:ListTables",
                    "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem", "dynamodb:BatchWriteItem",
                    "dynamodb:CreateTable", "dynamodb:UpdateTable", "dynamodb:DeleteTable", "dynamodb:TagResource",
                ],
            },
        ],
    },
    {
        id: "elbv2",
        name: "Elastic Load Balancing",
        icon: "arrow-right-arrow-left",
        description: "Read describes load balancers/target groups/listeners; Manage adds create & register targets; Full adds delete.",
        levels: [
            { value: "none", label: "None", scopes: [] },
            { value: "read", label: "Read-only", scopes: ["elasticloadbalancing:Describe*"] },
            {
                value: "manage", label: "Manage", scopes: [
                    "elasticloadbalancing:Describe*", "elasticloadbalancing:CreateLoadBalancer",
                    "elasticloadbalancing:CreateTargetGroup", "elasticloadbalancing:CreateListener",
                    "elasticloadbalancing:CreateRule", "elasticloadbalancing:RegisterTargets",
                    "elasticloadbalancing:DeregisterTargets", "elasticloadbalancing:ModifyListener",
                    "elasticloadbalancing:ModifyTargetGroup", "elasticloadbalancing:AddTags",
                ],
            },
            {
                value: "full", label: "Full", scopes: [
                    "elasticloadbalancing:Describe*", "elasticloadbalancing:CreateLoadBalancer",
                    "elasticloadbalancing:CreateTargetGroup", "elasticloadbalancing:CreateListener",
                    "elasticloadbalancing:CreateRule", "elasticloadbalancing:RegisterTargets",
                    "elasticloadbalancing:DeregisterTargets", "elasticloadbalancing:ModifyListener",
                    "elasticloadbalancing:ModifyTargetGroup", "elasticloadbalancing:AddTags",
                    "elasticloadbalancing:DeleteLoadBalancer", "elasticloadbalancing:DeleteTargetGroup",
                    "elasticloadbalancing:DeleteListener", "elasticloadbalancing:DeleteRule",
                ],
            },
        ],
    },
    {
        id: "autoscaling",
        name: "Auto Scaling",
        icon: "gauge",
        description: "Read describes groups; Manage adds create/update, set capacity, attach/detach; Full adds delete.",
        levels: [
            { value: "none", label: "None", scopes: [] },
            { value: "read", label: "Read-only", scopes: ["autoscaling:Describe*"] },
            {
                value: "manage", label: "Manage", scopes: [
                    "autoscaling:Describe*", "autoscaling:CreateAutoScalingGroup", "autoscaling:UpdateAutoScalingGroup",
                    "autoscaling:SetDesiredCapacity", "autoscaling:CreateLaunchConfiguration",
                    "autoscaling:AttachInstances", "autoscaling:DetachInstances", "autoscaling:CreateOrUpdateTags",
                ],
            },
            {
                value: "full", label: "Full", scopes: [
                    "autoscaling:Describe*", "autoscaling:CreateAutoScalingGroup", "autoscaling:UpdateAutoScalingGroup",
                    "autoscaling:SetDesiredCapacity", "autoscaling:CreateLaunchConfiguration",
                    "autoscaling:AttachInstances", "autoscaling:DetachInstances", "autoscaling:CreateOrUpdateTags",
                    "autoscaling:DeleteAutoScalingGroup", "autoscaling:DeleteLaunchConfiguration",
                ],
            },
        ],
    },
    {
        id: "route53",
        name: "Route 53 (DNS)",
        icon: "globe",
        description: "Read lists zones & records; Manage adds change records, create zones & health checks; Full adds delete.",
        levels: [
            { value: "none", label: "None", scopes: [] },
            { value: "read", label: "Read-only", scopes: ["route53:Get*", "route53:List*"] },
            {
                value: "manage", label: "Manage", scopes: [
                    "route53:Get*", "route53:List*", "route53:ChangeResourceRecordSets", "route53:CreateHostedZone",
                    "route53:ChangeTagsForResource", "route53:CreateHealthCheck", "route53:UpdateHealthCheck",
                ],
            },
            {
                value: "full", label: "Full", scopes: [
                    "route53:Get*", "route53:List*", "route53:ChangeResourceRecordSets", "route53:CreateHostedZone",
                    "route53:ChangeTagsForResource", "route53:CreateHealthCheck", "route53:UpdateHealthCheck",
                    "route53:DeleteHostedZone", "route53:DeleteHealthCheck",
                ],
            },
        ],
    },
    {
        id: "route53domains",
        name: "Route 53 Domains (Registrar)",
        icon: "tag",
        description: "Read checks availability & lists domains; Manage adds register, renew, transfer & contact/nameserver updates.",
        levels: [
            { value: "none", label: "None", scopes: [] },
            { value: "read", label: "Read-only", scopes: ["route53domains:List*", "route53domains:Get*", "route53domains:CheckDomainAvailability", "route53domains:CheckDomainTransferability"] },
            {
                value: "manage", label: "Manage", scopes: [
                    "route53domains:List*", "route53domains:Get*", "route53domains:CheckDomainAvailability", "route53domains:CheckDomainTransferability",
                    "route53domains:RegisterDomain", "route53domains:RenewDomain", "route53domains:TransferDomain",
                    "route53domains:UpdateDomainContact", "route53domains:UpdateDomainNameservers",
                ],
            },
        ],
    },
    {
        id: "cloudwatch",
        name: "CloudWatch (Metrics & Alarms)",
        icon: "chart-line",
        description: "Read gets metrics, alarms & dashboards; Manage adds put metric data, alarms & dashboards; Full adds delete.",
        levels: [
            { value: "none", label: "None", scopes: [] },
            { value: "read", label: "Read-only", scopes: ["cloudwatch:Describe*", "cloudwatch:Get*", "cloudwatch:List*"] },
            {
                value: "manage", label: "Manage", scopes: [
                    "cloudwatch:Describe*", "cloudwatch:Get*", "cloudwatch:List*", "cloudwatch:PutMetricData",
                    "cloudwatch:PutMetricAlarm", "cloudwatch:PutDashboard", "cloudwatch:PutAnomalyDetector",
                    "cloudwatch:SetAlarmState", "cloudwatch:TagResource",
                ],
            },
            {
                value: "full", label: "Full", scopes: [
                    "cloudwatch:Describe*", "cloudwatch:Get*", "cloudwatch:List*", "cloudwatch:PutMetricData",
                    "cloudwatch:PutMetricAlarm", "cloudwatch:PutDashboard", "cloudwatch:PutAnomalyDetector",
                    "cloudwatch:SetAlarmState", "cloudwatch:TagResource",
                    "cloudwatch:DeleteAlarms", "cloudwatch:DeleteDashboards", "cloudwatch:DeleteAnomalyDetector",
                ],
            },
        ],
    },
    {
        id: "logs",
        name: "CloudWatch Logs",
        icon: "file-lines",
        description: "Read filters & queries log events; Manage adds create groups/streams, put events & retention; Full adds delete.",
        levels: [
            { value: "none", label: "None", scopes: [] },
            { value: "read", label: "Read-only", scopes: ["logs:Describe*", "logs:Get*", "logs:FilterLogEvents", "logs:StartQuery", "logs:GetQueryResults"] },
            {
                value: "manage", label: "Manage", scopes: [
                    "logs:Describe*", "logs:Get*", "logs:FilterLogEvents", "logs:StartQuery", "logs:GetQueryResults",
                    "logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents", "logs:PutRetentionPolicy", "logs:TagLogGroup",
                ],
            },
            {
                value: "full", label: "Full", scopes: [
                    "logs:Describe*", "logs:Get*", "logs:FilterLogEvents", "logs:StartQuery", "logs:GetQueryResults",
                    "logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents", "logs:PutRetentionPolicy", "logs:TagLogGroup",
                    "logs:DeleteLogGroup", "logs:DeleteLogStream", "logs:DeleteRetentionPolicy",
                ],
            },
        ],
    },
    {
        id: "events",
        name: "EventBridge",
        icon: "bell",
        description: "Read lists rules & buses; Manage adds put rules/targets/events, buses, API destinations & connections; Full adds delete.",
        levels: [
            { value: "none", label: "None", scopes: [] },
            { value: "read", label: "Read-only", scopes: ["events:Describe*", "events:List*"] },
            {
                value: "manage", label: "Manage", scopes: [
                    "events:Describe*", "events:List*", "events:PutRule", "events:PutTargets", "events:PutEvents",
                    "events:EnableRule", "events:DisableRule", "events:CreateEventBus", "events:CreateApiDestination",
                    "events:CreateConnection", "events:TagResource",
                ],
            },
            {
                value: "full", label: "Full", scopes: [
                    "events:Describe*", "events:List*", "events:PutRule", "events:PutTargets", "events:PutEvents",
                    "events:EnableRule", "events:DisableRule", "events:CreateEventBus", "events:CreateApiDestination",
                    "events:CreateConnection", "events:TagResource",
                    "events:DeleteRule", "events:RemoveTargets", "events:DeleteEventBus",
                    "events:DeleteApiDestination", "events:DeleteConnection",
                ],
            },
        ],
    },
    {
        id: "iam",
        name: "IAM (Identity)",
        icon: "shield-halved",
        sensitive: true,
        description: "Read describes & simulates policies; Manage adds create users/roles/policies & attach; Full adds delete. Grant deliberately — IAM controls access itself.",
        levels: [
            { value: "none", label: "None", scopes: [] },
            { value: "read", label: "Read-only", scopes: ["iam:Get*", "iam:List*", "iam:SimulatePrincipalPolicy", "iam:SimulateCustomPolicy"] },
            {
                value: "manage", label: "Manage", scopes: [
                    "iam:Get*", "iam:List*", "iam:SimulatePrincipalPolicy", "iam:SimulateCustomPolicy",
                    "iam:CreateUser", "iam:CreateGroup", "iam:CreateRole", "iam:CreatePolicy", "iam:CreatePolicyVersion",
                    "iam:AttachUserPolicy", "iam:AttachRolePolicy", "iam:PutUserPolicy", "iam:PutRolePolicy",
                    "iam:CreateAccessKey", "iam:AddUserToGroup", "iam:UpdateAssumeRolePolicy", "iam:TagUser", "iam:TagRole",
                ],
            },
            {
                value: "full", label: "Full", scopes: [
                    "iam:Get*", "iam:List*", "iam:SimulatePrincipalPolicy", "iam:SimulateCustomPolicy",
                    "iam:CreateUser", "iam:CreateGroup", "iam:CreateRole", "iam:CreatePolicy", "iam:CreatePolicyVersion",
                    "iam:AttachUserPolicy", "iam:AttachRolePolicy", "iam:PutUserPolicy", "iam:PutRolePolicy",
                    "iam:CreateAccessKey", "iam:AddUserToGroup", "iam:UpdateAssumeRolePolicy", "iam:TagUser", "iam:TagRole",
                    "iam:DeleteUser", "iam:DeleteGroup", "iam:DeleteRole", "iam:DeletePolicy",
                    "iam:DetachUserPolicy", "iam:DetachRolePolicy", "iam:DeleteAccessKey", "iam:RemoveUserFromGroup",
                ],
            },
        ],
    },
    {
        id: "kms",
        name: "KMS (Encryption Keys)",
        icon: "key",
        sensitive: true,
        description: "Read describes keys; Manage adds encrypt/decrypt/sign, data keys, create keys/aliases/grants; Full adds schedule deletion & disable. Grant deliberately.",
        levels: [
            { value: "none", label: "None", scopes: [] },
            { value: "read", label: "Read-only", scopes: ["kms:Describe*", "kms:List*", "kms:GetKeyPolicy", "kms:GetKeyRotationStatus", "kms:GetPublicKey"] },
            {
                value: "manage", label: "Manage", scopes: [
                    "kms:Describe*", "kms:List*", "kms:GetKeyPolicy", "kms:GetKeyRotationStatus", "kms:GetPublicKey",
                    "kms:Encrypt", "kms:Decrypt", "kms:ReEncrypt*", "kms:GenerateDataKey*", "kms:GenerateMac", "kms:VerifyMac",
                    "kms:Sign", "kms:Verify", "kms:CreateKey", "kms:CreateAlias", "kms:CreateGrant",
                    "kms:EnableKeyRotation", "kms:TagResource",
                ],
            },
            {
                value: "full", label: "Full", scopes: [
                    "kms:Describe*", "kms:List*", "kms:GetKeyPolicy", "kms:GetKeyRotationStatus", "kms:GetPublicKey",
                    "kms:Encrypt", "kms:Decrypt", "kms:ReEncrypt*", "kms:GenerateDataKey*", "kms:GenerateMac", "kms:VerifyMac",
                    "kms:Sign", "kms:Verify", "kms:CreateKey", "kms:CreateAlias", "kms:CreateGrant",
                    "kms:EnableKeyRotation", "kms:TagResource",
                    "kms:ScheduleKeyDeletion", "kms:DisableKey", "kms:DeleteAlias", "kms:RevokeGrant",
                ],
            },
        ],
    },
    {
        id: "secretsmanager",
        name: "Secrets Manager",
        icon: "lock",
        sensitive: true,
        description: "Read gets & describes secrets; Manage adds create/put/rotate & resource policies; Full adds delete & stop replication. Grant deliberately.",
        levels: [
            { value: "none", label: "None", scopes: [] },
            {
                value: "read", label: "Read", scopes: [
                    "secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret", "secretsmanager:ListSecrets",
                    "secretsmanager:ListSecretVersionIds", "secretsmanager:GetResourcePolicy",
                ],
            },
            {
                value: "manage", label: "Manage", scopes: [
                    "secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret", "secretsmanager:ListSecrets",
                    "secretsmanager:ListSecretVersionIds", "secretsmanager:GetResourcePolicy",
                    "secretsmanager:CreateSecret", "secretsmanager:PutSecretValue", "secretsmanager:UpdateSecret",
                    "secretsmanager:RotateSecret", "secretsmanager:TagResource", "secretsmanager:PutResourcePolicy",
                    "secretsmanager:ReplicateSecretToRegions",
                ],
            },
            {
                value: "full", label: "Full", scopes: [
                    "secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret", "secretsmanager:ListSecrets",
                    "secretsmanager:ListSecretVersionIds", "secretsmanager:GetResourcePolicy",
                    "secretsmanager:CreateSecret", "secretsmanager:PutSecretValue", "secretsmanager:UpdateSecret",
                    "secretsmanager:RotateSecret", "secretsmanager:TagResource", "secretsmanager:PutResourcePolicy",
                    "secretsmanager:ReplicateSecretToRegions",
                    "secretsmanager:DeleteSecret", "secretsmanager:CancelRotateSecret",
                    "secretsmanager:RemoveRegionsFromReplication", "secretsmanager:DeleteResourcePolicy",
                ],
            },
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

// selectionToLevels collapses the picker to the compact {serviceId: level} map
// that is PERSISTED on the credential (metadata), skipping None. This — not the
// flattened action list — is the source of truth for pre-filling an edit, because
// actions can't be reverse-partitioned by service (VPC shares EC2's ec2: prefix).
export function selectionToLevels(selection: ScopeSelection): Record<string, string> {
    const levels: Record<string, string> = {};
    for (const svc of awsPermissionCatalogue) {
        const level = selection.get(svc.id)?.level;
        if (level && level !== "none") levels[svc.id] = level;
    }
    return levels;
}

// levelsToSelection inflates a persisted {serviceId: level} map back into a full
// ScopeSelection for the picker. Services absent from the map (or with an
// unrecognised level) default to their None level.
export function levelsToSelection(levels: Record<string, string> | null | undefined): ScopeSelection {
    const map = levels ?? {};
    const selection: ScopeSelection = new Map();
    for (const svc of awsPermissionCatalogue) {
        const wanted = map[svc.id];
        const valid = svc.levels?.some(l => l.value === wanted && l.value !== "none");
        selection.set(svc.id, {
            level: valid ? wanted : svc.levels?.[0]?.value,
            toggles: new Set(),
        });
    }
    return selection;
}
