import type {ExecutionStateValue} from "~/components/executionState";
import {CompletionStateValue} from "~/components/executionState";

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
    billing_duration?: number
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
    Loop
}

export type PluginCategory = {
    key: string,
    name: string,
    icon: string,
    description: string
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

export type UserDashboard = {
    usage: number,
    allowance: number
}

export type Organisation = {
    id: string,
    name: string,
    icon?: string,
    role: string,
    created_at?: string
}

export type OrganisationMember = {
    user_id: string,
    name: string,
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