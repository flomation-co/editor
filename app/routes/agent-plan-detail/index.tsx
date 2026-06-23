// Agent Planning M2 commit 4 — the plan-detail page. Surfaces a
// single plan with:
//
//   - Header: back arrow, title, goal, status badge, created-at.
//   - Left: a vertical list of task-execution rows. Each task IS an
//     execution of a flow (orchestrator-kind invokes the agent's
//     orchestrator; flow-kind invokes a pinned flow). Clicking a row
//     navigates to /execution/<execution_id> which renders the live
//     flow graph with node statuses — the visualisation we'd
//     otherwise have to rebuild here.
//   - Right: a vertical event timeline. Streams plan_event rows via
//     SSE so transitions land without polling.
//
// Why no DAG canvas: each task is an execution; the existing
// execution-detail page already renders the live flow graph. The
// "DAG" structure on this page is implicit in row order + "after:"
// labels. Keeps the code surface small and the navigation
// consistent ("click an execution → execution detail" works the
// same everywhere).

import type {Route} from "../+types/home";
import Container from "~/components/container";
import useConfig from "~/components/config";
import api from "~/lib/api";
import {useEffect, useState, useCallback, useRef} from "react";
import type {Plan, PlanTask, PlanEvent} from "~/types";
import useCookieToken from "~/components/cookie";
import {useParams, useNavigate} from "react-router";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";
import {Icon} from "~/components/icons/Icon";
import ProtectedRoute from "~/components/protected-route";
import {PERMISSIONS} from "~/types";
import "./index.css";

dayjs.extend(relativeTime);
dayjs.extend(utc);

export function meta({}: Route.MetaArgs) {
    return [
        {title: "Flomation - Plan"},
        {name: "description", content: "View plan progress and task timeline"},
    ];
}

const STATUS_COLOURS: Record<string, string> = {
    active: "#460070",
    completed: "#00aa9c",
    blocked: "#ef4444",
    failed: "#ef4444",
    cancelled: "rgba(255,255,255,0.3)",
    draft: "rgba(255,255,255,0.3)",
    // Task statuses
    pending: "rgba(255,255,255,0.3)",
    in_progress: "#460070",
};

const STATUS_LABELS: Record<string, string> = {
    active: "Active",
    completed: "Completed",
    blocked: "Blocked",
    failed: "Failed",
    cancelled: "Cancelled",
    draft: "Draft",
    pending: "Pending",
    in_progress: "In Progress",
};

export default function AgentPlanDetail() {
    const {id: agentId, planId} = useParams();
    const token = useCookieToken();
    const config = useConfig();
    const navigate = useNavigate();
    const apiUrl = config("AUTOMATE_API_URL");

    const [plan, setPlan] = useState<Plan | null>(null);
    const [tasks, setTasks] = useState<PlanTask[]>([]);
    const [events, setEvents] = useState<PlanEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const timelineRef = useRef<HTMLDivElement>(null);

    const headers = {Authorization: "Bearer " + token, "Content-Type": "application/json"};

    // === Initial load ===
    const loadPlan = useCallback(() => {
        if (!agentId || !planId || !apiUrl) return;
        setLoading(true);
        setError(null);

        api.get(`${apiUrl}/api/v1/agent/${agentId}/plan/${planId}`, {headers})
            .then(res => {
                if (res?.data) {
                    setPlan(res.data.plan ?? null);
                    setTasks(res.data.tasks ?? []);
                }
            })
            .catch(() => setError("Unable to load plan."))
            .finally(() => setLoading(false));
    }, [agentId, planId, apiUrl, token]);

    const loadEvents = useCallback(() => {
        if (!agentId || !planId || !apiUrl) return;
        api.get(`${apiUrl}/api/v1/agent/${agentId}/plan/${planId}/event?limit=100`, {headers})
            .then(res => {
                if (res?.data) setEvents(res.data);
            })
            .catch(() => {
                // Non-fatal: the SSE stream will still deliver fresh events
                // even if the historical fetch fails.
            });
    }, [agentId, planId, apiUrl, token]);

    useEffect(() => {
        loadPlan();
        loadEvents();
    }, [loadPlan, loadEvents]);

    // === SSE stream ===
    // Browsers' EventSource can't set Authorization headers, so we
    // exchange the JWT for an opaque token via POST /auth/stream-token
    // (same pattern as the execution-detail page).
    useEffect(() => {
        if (!agentId || !planId || !apiUrl || !token) return;
        if (!plan || plan.status === "completed" || plan.status === "cancelled") {
            // Don't stream terminal plans — nothing more is coming.
            return;
        }

        let eventSource: EventSource | null = null;

        fetch(`${apiUrl}/api/v1/auth/stream-token`, {
            method: "POST",
            headers: {Authorization: "Bearer " + token},
        })
            .then(res => res.json())
            .then(data => {
                const streamToken = data.token || token;
                const url = `${apiUrl}/api/v1/agent/${agentId}/plan/${planId}/stream?token=${encodeURIComponent(streamToken)}`;
                eventSource = new EventSource(url);

                eventSource.addEventListener("connected", () => {
                    // Stream is live.
                });

                // The hub emits one event per plan_event row; the
                // `event:` field carries plan_event.event_type so we can
                // dispatch on it.
                //
                // For task-lifecycle events we also mutate the matching
                // task's status in local state — saves the user from
                // needing to refresh to see "in_progress → completed".
                const dispatchEvent = (ev: PlanEvent) => {
                    setEvents(prev => {
                        if (prev.some(e => e.id === ev.id)) return prev;
                        return [ev, ...prev];
                    });

                    if (!ev.plan_task_id) {
                        // Plan-level event (plan_active/plan_completed/etc) —
                        // refresh the plan header so the status badge updates.
                        loadPlan();
                        return;
                    }

                    const nextStatus = taskStatusFromEvent(ev.event_type);
                    if (nextStatus) {
                        setTasks(prev => prev.map(t =>
                            t.id === ev.plan_task_id ? {...t, status: nextStatus} : t,
                        ));
                    }
                };

                // Each event type lands as a separately-typed SSE event.
                const eventTypes = [
                    "task_started", "task_completed", "task_failed",
                    "task_blocked", "task_cancelled", "task_retry_queued",
                    "plan_created", "plan_active", "plan_completed",
                    "plan_blocked", "plan_failed", "plan_cancelled",
                ];
                eventTypes.forEach(t => {
                    eventSource?.addEventListener(t, (e) => {
                        try {
                            const parsed = JSON.parse((e as MessageEvent).data) as PlanEvent;
                            dispatchEvent(parsed);
                        } catch {
                            // Swallow parse errors — a malformed event
                            // shouldn't take down the page.
                        }
                    });
                });

                eventSource.onerror = () => {
                    // EventSource auto-reconnects; nothing to do here.
                };
            })
            .catch(() => {
                // Stream-token exchange failed — fall back to no live
                // updates. The initial fetch already populated the page.
            });

        return () => {
            eventSource?.close();
        };
    }, [agentId, planId, apiUrl, token, plan?.status, loadPlan]);

    if (loading) {
        return (
            <Container>
                <ProtectedRoute permission={PERMISSIONS.AGENT_VIEW}>
                    <div className="plan-detail">Loading…</div>
                </ProtectedRoute>
            </Container>
        );
    }

    if (error || !plan) {
        return (
            <Container>
                <ProtectedRoute permission={PERMISSIONS.AGENT_VIEW}>
                    <div className="plan-detail">
                        <button className="plan-back-btn" onClick={() => navigate(`/agent/${agentId}`)}>
                            <Icon name="arrow-left" /> Back to agent
                        </button>
                        <div className="plan-detail-error">{error || "Plan not found."}</div>
                    </div>
                </ProtectedRoute>
            </Container>
        );
    }

    const statusColour = STATUS_COLOURS[plan.status] ?? "rgba(255,255,255,0.3)";
    const statusLabel = STATUS_LABELS[plan.status] ?? plan.status;
    const taskNameByID: Record<string, string> = {};
    tasks.forEach(t => { taskNameByID[t.id] = t.name; });

    return (
        <Container>
            <ProtectedRoute permission={PERMISSIONS.AGENT_VIEW}>
                <div className="plan-detail">
                    <button className="plan-back-btn" onClick={() => navigate(`/agent/${agentId}`)}>
                        <Icon name="arrow-left" /> Back to agent
                    </button>

                    <div className="plan-detail-header">
                        <div className="plan-detail-title-row">
                            <h1>{plan.title}</h1>
                            <span
                                className="plan-status-badge"
                                style={{background: statusColour}}
                            >
                                {statusLabel}
                            </span>
                        </div>
                        {plan.goal && <div className="plan-detail-goal">{plan.goal}</div>}
                        <div className="plan-detail-meta">
                            Created {dayjs.utc(plan.created_at).local().fromNow()}
                            {plan.completed_at && (
                                <> · completed {dayjs.utc(plan.completed_at).local().fromNow()}</>
                            )}
                        </div>
                    </div>

                    <div className="plan-detail-body">
                        <div className="plan-tasks-panel">
                            <h2>Tasks ({tasks.length})</h2>
                            <div className="plan-task-list">
                                {tasks.map(task => {
                                    const taskStatusColour = STATUS_COLOURS[task.status] ?? "rgba(255,255,255,0.3)";
                                    const taskStatusLabel = STATUS_LABELS[task.status] ?? task.status;
                                    const dependsLabels = (task.depends_on ?? [])
                                        .map(depId => taskNameByID[depId])
                                        .filter(Boolean);

                                    const clickable = !!task.execution_id;
                                    return (
                                        <div
                                            key={task.id}
                                            className={`plan-task-row ${clickable ? "plan-task-row--clickable" : ""}`}
                                            onClick={() => clickable && navigate(`/execution/${task.execution_id}`)}
                                            role={clickable ? "button" : undefined}
                                            tabIndex={clickable ? 0 : undefined}
                                            onKeyDown={e => {
                                                if (clickable && (e.key === "Enter" || e.key === " ")) {
                                                    navigate(`/execution/${task.execution_id}`);
                                                }
                                            }}
                                        >
                                            <div className="plan-task-row-main">
                                                <div className="plan-task-row-name">
                                                    <span
                                                        className="plan-task-status-badge"
                                                        style={{background: taskStatusColour}}
                                                    >
                                                        {taskStatusLabel}
                                                    </span>
                                                    <strong>{task.name}</strong>
                                                </div>
                                                {clickable && (
                                                    <span className="plan-task-row-chevron">
                                                        <Icon name="arrow-right" />
                                                    </span>
                                                )}
                                            </div>
                                            <div className="plan-task-row-meta">
                                                <span className="plan-task-kind">
                                                    {task.task_kind === "flow" ? "pinned flow" : "orchestrator"}
                                                </span>
                                                {dependsLabels.length > 0 && (
                                                    <span className="plan-task-after">
                                                        after: {dependsLabels.join(", ")}
                                                    </span>
                                                )}
                                                {task.started_at && task.completed_at && (
                                                    <span className="plan-task-duration">
                                                        ran {dayjs.utc(task.started_at).local().fromNow(true)}
                                                    </span>
                                                )}
                                            </div>
                                            {task.last_error && (
                                                <div className="plan-task-error">
                                                    {task.last_error}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="plan-events-panel">
                            <h2>Event Timeline</h2>
                            <div className="plan-event-list" ref={timelineRef}>
                                {events.length === 0 && (
                                    <div className="plan-events-empty">No events yet.</div>
                                )}
                                {events.map(ev => (
                                    <div key={ev.id} className="plan-event-row">
                                        <div className="plan-event-type">{ev.event_type}</div>
                                        <div className="plan-event-time">
                                            {dayjs.utc(ev.created_at).local().format("HH:mm:ss")}
                                        </div>
                                        {ev.plan_task_id && taskNameByID[ev.plan_task_id] && (
                                            <div className="plan-event-task">
                                                task: {taskNameByID[ev.plan_task_id]}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </ProtectedRoute>
        </Container>
    );
}

// taskStatusFromEvent maps an audit event type onto the plan_task
// status it implies — letting us mutate the task in local state
// without re-fetching. Returns "" when the event isn't a task
// transition (e.g. plan_completed, which is plan-level).
function taskStatusFromEvent(eventType: string): string {
    switch (eventType) {
        case "task_started":      return "in_progress";
        case "task_completed":    return "completed";
        case "task_failed":       return "failed";
        case "task_blocked":      return "failed"; // blocked surfaces as failed on the task row
        case "task_cancelled":    return "cancelled";
        case "task_retry_queued": return "pending";
        default:                  return "";
    }
}
