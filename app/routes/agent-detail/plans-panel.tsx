// Agent Planning M2 — the Plans tab on agent-detail. Lists plans
// the agent has authored (via plan/create) with status, task counts,
// and a click-through to the plan-detail page (which lands in
// commit 4 of M2). Read-only view; cancel/revise are M3.
//
// Modelled on memory-panel.tsx so the visual rhythm matches the
// other agent-scoped panels (same .agent-memory-item card shape,
// same toolbar spacing).

import {useState, useEffect, useCallback} from "react";
import {useNavigate} from "react-router";
import type {Plan} from "~/types";
import api from "~/lib/api";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";

dayjs.extend(relativeTime);
dayjs.extend(utc);

type Props = {
    agentId: string;
    apiUrl: string;
    token: string;
};

// Status → background colour mapping. Matches the colour vocabulary
// used by AgentMemoryPanel and the executions list: green = good,
// purple = active/running, red = failure, neutral grey = terminal.
const STATUS_COLOURS: Record<string, string> = {
    active: "#460070",
    completed: "#00aa9c",
    blocked: "#ef4444",
    failed: "#ef4444",
    cancelled: "rgba(255,255,255,0.3)",
    draft: "rgba(255,255,255,0.3)",
};

const STATUS_LABELS: Record<string, string> = {
    active: "Active",
    completed: "Completed",
    blocked: "Blocked",
    failed: "Failed",
    cancelled: "Cancelled",
    draft: "Draft",
};

// Page size for the paginated list. Higher than the API default
// (50) so a single fetch typically covers the visible list without
// scroll-triggered pagination (which we'd add in M3 if plans get
// numerous). The API hard-caps at 200.
const PAGE_LIMIT = 100;

export default function AgentPlansPanel({agentId, apiUrl, token}: Props) {
    const navigate = useNavigate();
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>("");
    const [error, setError] = useState<string | null>(null);

    const headers = {Authorization: "Bearer " + token, "Content-Type": "application/json"};

    const loadPlans = useCallback(() => {
        if (!agentId || !apiUrl) return;
        setLoading(true);
        setError(null);

        const params = new URLSearchParams({limit: String(PAGE_LIMIT)});
        if (statusFilter) params.set("status", statusFilter);

        api.get(`${apiUrl}/api/v1/agent/${agentId}/plan?${params}`, {headers})
            .then(res => {
                if (res?.data) setPlans(res.data);
                else setPlans([]);
            })
            .catch(() => {
                setPlans([]);
                setError("Unable to load plans.");
            })
            .finally(() => setLoading(false));
    }, [agentId, apiUrl, token, statusFilter]);

    useEffect(() => {
        loadPlans();
    }, [loadPlans]);

    const openPlan = (planId: string) => {
        // The plan-detail page lands in M2 commit 4; until then the
        // route resolves to a 404 from the editor's catch-all. Wiring
        // the navigation now keeps the click affordance correct.
        navigate(`/agent/${agentId}/plan/${planId}`);
    };

    return (
        <div className="agent-plans-panel">
            <div className="memory-toolbar">
                <select
                    className="memory-filter-select"
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                >
                    <option value="">All statuses</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="blocked">Blocked</option>
                    <option value="failed">Failed</option>
                    <option value="cancelled">Cancelled</option>
                </select>
                <div className="memory-count">
                    {loading ? "Loading…" : `${plans.length} plan${plans.length === 1 ? "" : "s"}`}
                </div>
            </div>

            {error && (
                <div className="agent-plans-error">{error}</div>
            )}

            {!loading && !error && plans.length === 0 && (
                <div className="agent-plans-empty">
                    This agent has not authored any plans yet.
                </div>
            )}

            <div className="agent-memory-list">
                {plans.map(plan => {
                    const statusColour = STATUS_COLOURS[plan.status] ?? "rgba(255,255,255,0.3)";
                    const statusLabel = STATUS_LABELS[plan.status] ?? plan.status;
                    return (
                        <div
                            key={plan.id}
                            className="agent-memory-item agent-plan-item"
                            onClick={() => openPlan(plan.id)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={e => {
                                if (e.key === "Enter" || e.key === " ") openPlan(plan.id);
                            }}
                        >
                            <div className="memory-item-header">
                                <div className="memory-item-left">
                                    <span
                                        className="memory-type-badge"
                                        style={{background: statusColour}}
                                    >
                                        {statusLabel}
                                    </span>
                                    <strong>{plan.title}</strong>
                                </div>
                                <div className="memory-item-right">
                                    <span style={{opacity: 0.6, fontSize: "0.85em"}}>
                                        {dayjs.utc(plan.created_at).local().fromNow()}
                                    </span>
                                </div>
                            </div>
                            {plan.goal && (
                                <div style={{
                                    opacity: 0.75,
                                    fontSize: "0.9em",
                                    marginTop: 4,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                }}>
                                    {plan.goal}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
