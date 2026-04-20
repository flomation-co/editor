import type {ExecutionStateValue} from "~/components/executionState";
import {CompletionStateValue} from "~/components/executionState";

export type NodeStatus = {
    id: string;
    action: string;
    label: string;
    status: 'pending' | 'running' | 'success' | 'failed';
    inputs?: Record<string, any>;
    outputs?: Record<string, any>;
    error?: string;
    duration_ms?: number;
};

export type NavItem = {
    icon?: string,
    value: string,
    name: string
};

export type Revision = {
    id: string,
    floId: string,
    createdAt?: string,
    data?: object
}

export type Trigger = {
    id: string,
    name: string,
    owner_id?: string,
    organisation_id?: string,
    created_at?: string,
    type: string,
    type_name?: string,
    data?: object,
    flo_id?: string,
}

export type Execution = {
    id: string,
    flo_id: string,
    name: string,
    owner_id: string,
    organisation_id?: string,
    created_at: string,
    updated_at?: string,
    completed_at?: string,
    triggered_by?: string,
    execution_status: ExecutionStateValue,
    completion_status: CompletionStateValue,
    sequence: number,
    data?: object,
    result?: object,
    runner_id?: string,
    duration?: number,
    billing_duration?: number,
    trigger_type?: string,
    parent_execution_id?: string,
    agent_id?: string,
}

export type Flo = {
    id: string,
    name: string,
    organisationID?: string,
    authorID?: string,
    createdAt?: string
    revision?: Revision,
    scale?: number,
    x?: number,
    y?: number,
    triggers?: Trigger[],
    execution_count: number,
    last_run: string,
    duration?: number,
    duration_additional?: number,
    last_execution?: Execution
    environment_id?: string,
    environment_name?: string,
    has_validation_errors?: boolean,
    recent_executions?: ExecutionStatusDot[],
    notify_on_success?: boolean,
    notify_on_failure?: boolean,
    notification_emails?: string,
}

export type ExecutionStatusDot = {
    id: string,
    execution_status: string,
    completion_status: string,
}

export type ParameterOption = {
    name: string,
    value: string
}

export type ParameterDefinition = {
    id?: string,
    name: string,
    type: string,
    placeholder?: string,
    value: string,
    label?: string,
    required?: boolean,
    options?: ParameterOption[]
}

export type Runner = {
    id: string,
    name?: string,
    registration_code?: string,
    enrolled_at?: string,
    last_contact_at?: string,
    ip_address?: string,
    state?: string,
    version? : string
    executor_version? : string
    verified? : boolean
}

export type NodeDefinition = {
    id: string,
    inputs: ParameterDefinition[],
    running?: boolean,
    config?: {
        name: string;
        type: number;
        label: string;
        inputs: ParameterDefinition[];
        outputs: ParameterDefinition[];
        icon: string;
    }
}

export enum NodeCategoryType {
    Unknown,
    Trigger,
    Processing,
    Output,
    Conditional,
    Loop,
    Switch
}

export type PluginCategory = {
    key: string,
    name: string,
    icon: string,
    description: string,
    sub_key?: string,
    sub_name?: string,
    sub_icon?: string,
    sub_description?: string
}

export type PluginDefinition = {
    id: string,
    name: string,
    label: string,
    description: string,
    type: NodeCategoryType,
    icon: string[],
    inputs?: ParameterDefinition[],
    outputs?: ParameterDefinition[],
    category?: PluginCategory
}

export type Environment = {
    id: string,
    name: string,
    owner_id: string,
    organisation_id?: string,
    created_at: string,
}

export type Property = {
    id: string,
    environment_id: string,
    name: string,
    value: string
}

export type Secret = {
    id: string,
    environment_id: string,
    name: string,
    provider: string,
    expires_at?: string
}

export const useDebounce = (fn, interval) => {
    let timer;

    const debouncedFn = (...args) => {
        const now = new Date();

        if (!timer) {
            timer = new Date();
        }

        if (now - timer > interval) {
            fn(args);
            timer = new Date();
        }
    }

    return debouncedFn;
}

export type AuthUser = {
    id: string,
    name?: string,
    email_address?: string
    created_at?: string
    marketing_opt_in?: boolean
}

export type JWTPayload = {
    aud: string,
    exp: number,
    guest: boolean,
    id: string,
    iss: string,
    nbf: string,
    roles: string[],
    sub: string,
    verified: boolean
}

export type Queue = {
    id: string,
    organisation_id?: string,
    parent_id?: string,
    name: string,
    registration_code: string,
    created_at?: string,
    location_code?: string
}

export type UserDashboard = {
    usage: number,
    allowance: number
}

export type Organisation = {
    id: string,
    name: string,
    icon?: string,
    role: string,
    allow_public_runners: boolean,
    created_at?: string
}

export type OrganisationMember = {
    user_id: string,
    name: string,
    email_address?: string,
    role: string,
    joined_at?: string
}

export type OrganisationInvite = {
    id: string,
    organisation_id: string,
    email?: string,
    invite_code: string,
    role: string,
    created_by: string,
    created_at: string,
    accepted_at?: string,
    accepted_by?: string,
    expires_at: string
}

export type Group = {
    id: string,
    organisation_id: string,
    name: string,
    description?: string,
    is_default: boolean,
    created_at: string,
    permissions?: string[],
    member_count?: number
}

export type GroupMember = {
    user_id: string,
    name: string,
    added_at?: string
}

export type UserPermissions = {
    role: string,
    permissions: string[],
    is_admin: boolean
}

export type FlomationExportMetadata = {
    version: number,
    exported_at: string,
    source_flow_id: string,
    source_flow_name: string,
    author_email: string,
    environment_name?: string,
    hash: string
}

export type FlomationExport = {
    flomation_export: FlomationExportMetadata,
    flow_data: {
        name: string,
        scale: number,
        x: number,
        y: number,
        revision: object | null,
    }
}

// Agent types

export type Agent = {
    id: string,
    name: string,
    description?: string,
    owner_id: string,
    organisation_id?: string,
    environment_id?: string,
    queue_id?: string,
    system_prompt?: string,
    orchestrator_flow_id?: string,
    max_concurrent_executions: number,
    idle_timeout_seconds: number,
    channels: AgentChannel[],
    allowed_flow_ids?: string[],
    requires_approval: boolean,
    max_executions_per_hour: number,
    status: 'stopped' | 'running' | 'paused' | 'error',
    started_at?: string,
    stopped_at?: string,
    created_at: string,
    updated_at: string,
    archived_at?: string,
    active_session_id?: string,
    message_count: number,
    execution_count: number,
    last_active_at?: string,
    orchestrator_flow_name?: string,
    environment_name?: string,
}

export type AgentChannel = {
    type: 'telegram' | 'slack' | 'email' | 'webhook',
    config: Record<string, any>
}

export type AgentSchedule = {
    id: string,
    agent_id: string,
    agent_user_id?: string,
    conversation_id?: string,
    name: string,
    description: string,
    schedule_mode: 'interval' | 'daily' | 'weekly',
    interval_val?: string,
    unit?: 'minutes' | 'hours' | 'days',
    time_of_day?: string,
    days_of_week?: string,
    timezone: string,
    enabled: boolean,
    last_fired_at?: string,
    created_at: string,
    updated_at: string,
}

export type AgentSession = {
    id: string,
    agent_id: string,
    started_at: string,
    ended_at?: string,
    status: 'active' | 'ended' | 'crashed',
    heartbeat_at: string,
    summary?: Record<string, any>,
    error_message?: string,
    message_count: number,
    execution_count: number,
}

export type AgentMessage = {
    id: string,
    agent_id: string,
    session_id?: string,
    direction: 'inbound' | 'outbound' | 'system',
    channel_type: string,
    sender?: string,
    content: string,
    metadata?: Record<string, any>,
    execution_id?: string,
    created_at: string,
}

export type AgentState = {
    agent_id: string,
    state_key: string,
    state_value: any,
    updated_at: string,
}

export type AgentMemory = {
    id: string;
    agent_id: string;
    agent_user_id?: string;
    scope: string;
    memory_type: string;
    title: string;
    body: string;
    confidence: number;
    pinned: boolean;
    created_at: string;
    last_used_at?: string;
    expires_at?: string;
    valid_until?: string;
}

export type AgentIdentity = {
    id: string;
    agent_user_id: string;
    channel_type: string;
    channel_external_id: string;
    channel_scope?: string;
    verified: boolean;
    linked_at?: string;
    created_at: string;
}

export type AgentAuditLog = {
    id: string;
    agent_id: string;
    agent_user_id?: string;
    actor_type: string;
    actor_id?: string;
    event_type: string;
    resource_type: string;
    resource_id?: string;
    detail: Record<string, any>;
    created_at: string;
}

export type AgentUser = {
    id: string;
    agent_id: string;
    display_name: string;
    created_at: string;
}

export const PERMISSIONS = {
    FLOW_CREATE: "flow.create",
    FLOW_EDIT: "flow.edit",
    FLOW_DELETE: "flow.delete",
    FLOW_EXECUTE: "flow.execute",
    RUNNER_MANAGE: "runner.manage",
    RUNNER_VIEW: "runner.view",
    ORGANISATION_MANAGE: "organisation.manage",
    ORGANISATION_VIEW: "organisation.view",
    ENVIRONMENT_MANAGE: "environment.manage",
    ENVIRONMENT_VIEW: "environment.view",
    BILLING_MANAGE: "billing.manage",
    BILLING_VIEW: "billing.view",
    AGENT_VIEW: "agent.view",
    AGENT_CREATE: "agent.create",
    AGENT_EDIT: "agent.edit",
    AGENT_DELETE: "agent.delete",
    AGENT_START_STOP: "agent.start_stop",
} as const;

export const PERMISSION_CATEGORIES = [
    {
        name: "Flows",
        permissions: [
            { key: PERMISSIONS.FLOW_CREATE, label: "Create Flows" },
            { key: PERMISSIONS.FLOW_EDIT, label: "Edit Flows" },
            { key: PERMISSIONS.FLOW_DELETE, label: "Delete Flows" },
            { key: PERMISSIONS.FLOW_EXECUTE, label: "Execute Flows" },
        ]
    },
    {
        name: "Runners",
        permissions: [
            { key: PERMISSIONS.RUNNER_VIEW, label: "View Runners" },
            { key: PERMISSIONS.RUNNER_MANAGE, label: "Manage Runners" },
        ]
    },
    {
        name: "Environments",
        permissions: [
            { key: PERMISSIONS.ENVIRONMENT_VIEW, label: "View Environments" },
            { key: PERMISSIONS.ENVIRONMENT_MANAGE, label: "Manage Environments" },
        ]
    },
    {
        name: "Organisation",
        permissions: [
            { key: PERMISSIONS.ORGANISATION_VIEW, label: "View Organisation" },
            { key: PERMISSIONS.ORGANISATION_MANAGE, label: "Manage Organisation" },
        ]
    },
    {
        name: "Billing",
        permissions: [
            { key: PERMISSIONS.BILLING_VIEW, label: "View Billing" },
            { key: PERMISSIONS.BILLING_MANAGE, label: "Manage Billing" },
        ]
    },
    {
        name: "Agents",
        permissions: [
            { key: PERMISSIONS.AGENT_VIEW, label: "View Agents" },
            { key: PERMISSIONS.AGENT_CREATE, label: "Create Agents" },
            { key: PERMISSIONS.AGENT_EDIT, label: "Edit Agents" },
            { key: PERMISSIONS.AGENT_DELETE, label: "Delete Agents" },
            { key: PERMISSIONS.AGENT_START_STOP, label: "Start/Stop Agents" },
        ]
    },
] as const;