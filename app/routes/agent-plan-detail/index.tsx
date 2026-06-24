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
import TaskDetailModal from "./TaskDetailModal";
import Modal from "~/components/modal";
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
    // M3: drill-down modal. The task itself is stored in state
    // rather than just an id so the modal keeps rendering the
    // exact snapshot the user clicked, even if SSE patches the
    // tasks list while the modal is open.
    const [viewingTask, setViewingTask] = useState<PlanTask | null>(null);
    // M3: cancel-confirmation dialog. `cancelOpen` controls the
    // modal mount; `cancelReason` is the optional textarea bound
    // value; `cancelling` shows a spinner state during the POST.
    const [cancelOpen, setCancelOpen] = useState(false);
    const [cancelReason, setCancelReason] = useState("");
    const [cancelling, setCancelling] = useState(false);
    // M4: Start button state. No confirmation dialog — starting a
    // draft is benign (transitions to active, begins dispatch). The
    // `starting` flag prevents double-clicks during the round-trip.
    const [starting, setStarting] = useState(false);
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

    // M3 cancel: POST to /agent/:id/plan/:planID/cancel then
    // refetch. The SSE stream also pushes plan_cancelled +
    // task_cancelled events so other open tabs converge; the
    // explicit refetch here makes THIS tab feel snappy without
    // waiting for the round-trip to the editor's own EventSource.
    // M4 start: POST to /agent/:id/plan/:planID/start then refetch
    // so the header status flips immediately. SSE also pushes
    // plan_started so other open tabs converge.
    const startPlan = useCallback(() => {
        if (!agentId || !planId || !apiUrl) return;
        setStarting(true);
        api.post(
            `${apiUrl}/api/v1/agent/${agentId}/plan/${planId}/start`,
            {},
            {headers},
        )
            .then(() => {
                loadPlan();
                loadEvents();
            })
            .catch(() => {
                // Failure is rare (would be 409 already-terminal or
                // 5xx). Refetch so the page state is honest about
                // what happened.
                loadPlan();
            })
            .finally(() => setStarting(false));
    }, [agentId, planId, apiUrl, loadPlan, loadEvents]);

    const cancelPlan = useCallback(() => {
        if (!agentId || !planId || !apiUrl) return;
        setCancelling(true);
        api.post(
            `${apiUrl}/api/v1/agent/${agentId}/plan/${planId}/cancel`,
            {reason: cancelReason},
            {headers},
        )
            .then(() => {
                setCancelOpen(false);
                setCancelReason("");
                loadPlan();
                loadEvents();
            })
            .catch(() => {
                // Keep the dialog open so the user can retry; the
                // confirmation button will re-enable.
            })
            .finally(() => setCancelling(false));
    }, [agentId, planId, apiUrl, cancelReason, loadPlan, loadEvents]);

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
                // plan_started (M4) lands when a draft transitions to
                // active — the header status flips here, the Start
                // button disappears, tasks begin appearing as
                // in_progress.
                const eventTypes = [
                    "task_started", "task_completed", "task_failed",
                    "task_blocked", "task_cancelled", "task_retry_queued",
                    "plan_created", "plan_started", "plan_active", "plan_completed",
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
                            {/* M4 start button. Visible only when the plan
                                is a draft. Starting transitions draft →
                                active and begins dispatching tasks. No
                                confirmation needed — the action is benign
                                and the user has already seen the plan via
                                the AI's summary or the task list above. */}
                            {plan.status === "draft" && (
                                <button
                                    className="plan-start-btn"
                                    onClick={startPlan}
                                    disabled={starting}
                                >
                                    {starting ? "Starting…" : "Start plan"}
                                </button>
                            )}
                            {/* M3 cancel button. Visible for any non-
                                terminal plan: drafts (user changed mind
                                before starting), active (stopping in
                                flight), and blocked (cancelling a stuck
                                plan). */}
                            {(plan.status === "draft" || plan.status === "active" || plan.status === "blocked") && (
                                <button
                                    className="plan-cancel-btn"
                                    onClick={() => setCancelOpen(true)}
                                >
                                    Cancel plan
                                </button>
                            )}
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
                                                <div className="plan-task-row-actions">
                                                    {/* M3 drill-down: opens the modal without
                                                        navigating. stopPropagation keeps the
                                                        row's existing chevron-click (which
                                                        navigates to /execution/:id) intact. */}
                                                    <button
                                                        className="plan-task-details-btn"
                                                        title="View task details"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setViewingTask(task);
                                                        }}
                                                    >
                                                        <Icon name="eye" />
                                                    </button>
                                                    {clickable && (
                                                        <span className="plan-task-row-chevron">
                                                            <Icon name="arrow-right" />
                                                        </span>
                                                    )}
                                                </div>
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

                {/* M3 task drill-down. Mounted conditionally on
                    `viewingTask` because the Modal component only
                    samples `visible` at mount time — toggle by
                    mount/unmount rather than prop change. */}
                {viewingTask && (
                    <TaskDetailModal
                        task={viewingTask}
                        onClose={() => setViewingTask(null)}
                    />
                )}

                {/* M3 cancel-confirmation dialog. Optional reason
                    textarea; submitting POSTs to the M3 cancel
                    endpoint. Dialog stays open while the request is
                    in flight so the user sees a spinner state. */}
                {cancelOpen && (
                    <Modal
                        label="Cancel plan?"
                        footerMessage="Tasks in flight will be marked cancelled. This cannot be undone."
                        visible={true}
                        canDismiss={!cancelling}
                        onDismiss={() => {
                            setCancelOpen(false);
                            setCancelReason("");
                        }}
                        actions={[
                            {
                                label: cancelling ? "Cancelling…" : "Cancel plan",
                                primary: false,
                                variant: "danger",
                                onClick: cancelPlan,
                            },
                        ]}
                    >
                        <div className="plan-cancel-dialog">
                            <p>
                                Cancelling will stop all pending and in-progress tasks for{" "}
                                <strong>{plan.title}</strong>.
                            </p>
                            <label className="plan-cancel-reason-label">
                                Reason (optional)
                                <textarea
                                    className="plan-cancel-reason-input"
                                    value={cancelReason}
                                    onChange={e => setCancelReason(e.target.value)}
                                    placeholder="e.g. requirements changed"
                                    rows={3}
                                    disabled={cancelling}
                                />
                            </label>
                        </div>
                    </Modal>
                )}
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
