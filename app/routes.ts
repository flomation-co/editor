import { type RouteConfig, index, route, prefix } from "@react-router/dev/routes";

export default [
    index("routes/dashboard/index.tsx"),

    route("profile", "routes/profile/index.tsx"),

    route("flow", "routes/flows/index.tsx"),
    route("trigger", "routes/triggers/index.tsx"),
    route("integration", "routes/integrations/index.tsx"),
    route("runner", "routes/runners/index.tsx"),

    route("queue", "routes/queues/index.tsx"),
    route("organisation", "routes/organisations/index.tsx"),
    route("invite/:code", "routes/invite/index.tsx"),
    route("team", "routes/teams/index.tsx"),
    route("usage", "routes/usage/index.tsx"),
    route("status", "routes/status/index.tsx"),
    
    ...prefix("environment", [
        index("routes/environments/index.tsx", {id: "list-envs"}),
        route(":id", "routes/environment/index.tsx", {id: "view-env"})
    ]),

    ...prefix("flo", [
        index("routes/editor/index.tsx", {id: "create-flo"}),
        route(":id", "routes/editor/index.tsx", {id: "edit-flo"})
    ]),

    ...prefix("agent", [
        index("routes/agents/index.tsx", {id: "list-agents"}),
        route(":id", "routes/agent-detail/index.tsx", {id: "view-agent"}),
        route(":id/session/:sessionId", "routes/agent-session/index.tsx", {id: "view-agent-session"})
    ]),

    ...prefix("execution", [
        index("routes/executions/index.tsx", {id: "list-executions"}),
        route(":id", "routes/execution/index.tsx", {id: "view-execution"})
    ])
] satisfies RouteConfig;
