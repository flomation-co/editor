// Agent Planning M3 — task drill-down modal. Rendered from the
// plan-detail page when the user clicks the "details" icon on a
// task row. Shows everything you'd otherwise need to leave the
// page (via /execution/:id) to see: inputs, outputs, last_error,
// attempts, and timings.
//
// All data already lives in the existing M2 `{plan, tasks}` payload
// — no new fetch needed.

import Modal from "~/components/modal";
import type {PlanTask} from "~/types";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";

dayjs.extend(relativeTime);
dayjs.extend(utc);

type Props = {
    task: PlanTask;
    onClose: () => void;
};

const STATUS_LABELS: Record<string, string> = {
    pending: "Pending",
    in_progress: "In Progress",
    completed: "Completed",
    failed: "Failed",
    cancelled: "Cancelled",
};

// formatJSON renders a JSON value as a pretty-printed string for
// the monospace display blocks. Handles three input shapes:
//   * already-stringified JSON (just re-indent)
//   * a JS object (typical when api lib auto-parses inputs_json)
//   * null/undefined → empty-state copy.
function formatJSON(value: unknown): string {
    if (value == null) return "";
    if (typeof value === "string") {
        try {
            return JSON.stringify(JSON.parse(value), null, 2);
        } catch {
            return value;
        }
    }
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
}

export default function TaskDetailModal({task, onClose}: Props) {
    const inputsText = formatJSON(task.inputs_json);
    const outputsText = formatJSON(task.outputs_json);
    const statusLabel = STATUS_LABELS[task.status] ?? task.status;

    return (
        <Modal
            label={`Task: ${task.name}`}
            visible={true}
            canDismiss={true}
            onDismiss={onClose}
            // No `actions` — the auto-injected dismiss button (re-
            // labelled "Close" via dismissLabel) is the only
            // affordance this read-only modal needs.
            dismissLabel="Close"
        >
            <div className="task-detail-modal">
                <div className="task-detail-section">
                    <div className="task-detail-row">
                        <span className="task-detail-label">Status</span>
                        <span className="task-detail-value">{statusLabel}</span>
                    </div>
                    <div className="task-detail-row">
                        <span className="task-detail-label">Kind</span>
                        <span className="task-detail-value">
                            {task.task_kind === "flow" ? "pinned flow" : "orchestrator"}
                        </span>
                    </div>
                    <div className="task-detail-row">
                        <span className="task-detail-label">Attempts</span>
                        <span className="task-detail-value">
                            {task.attempt_count} / {task.max_attempts}
                        </span>
                    </div>
                    {task.started_at && (
                        <div className="task-detail-row">
                            <span className="task-detail-label">Started</span>
                            <span className="task-detail-value">
                                {dayjs.utc(task.started_at).local().format("YYYY-MM-DD HH:mm:ss")}
                                {" "}({dayjs.utc(task.started_at).local().fromNow()})
                            </span>
                        </div>
                    )}
                    {task.completed_at && (
                        <div className="task-detail-row">
                            <span className="task-detail-label">Completed</span>
                            <span className="task-detail-value">
                                {dayjs.utc(task.completed_at).local().format("YYYY-MM-DD HH:mm:ss")}
                                {" "}({dayjs.utc(task.completed_at).local().fromNow()})
                            </span>
                        </div>
                    )}
                    {task.execution_id && (
                        <div className="task-detail-row">
                            <span className="task-detail-label">Execution</span>
                            <span className="task-detail-value">
                                <a
                                    href={`/execution/${task.execution_id}`}
                                    className="task-detail-link"
                                >
                                    {task.execution_id} ↗
                                </a>
                            </span>
                        </div>
                    )}
                </div>

                {task.description && (
                    <div className="task-detail-section">
                        <div className="task-detail-section-label">Description</div>
                        <div className="task-detail-description">{task.description}</div>
                    </div>
                )}

                {task.last_error && (
                    <div className="task-detail-section">
                        <div className="task-detail-section-label task-detail-error-label">
                            Last Error
                        </div>
                        <div className="task-detail-error-body">{task.last_error}</div>
                    </div>
                )}

                <div className="task-detail-section">
                    <div className="task-detail-section-label">Inputs</div>
                    {inputsText ? (
                        <pre className="task-detail-json">{inputsText}</pre>
                    ) : (
                        <div className="task-detail-empty">No inputs.</div>
                    )}
                </div>

                <div className="task-detail-section">
                    <div className="task-detail-section-label">Outputs</div>
                    {outputsText ? (
                        <pre className="task-detail-json">{outputsText}</pre>
                    ) : (
                        <div className="task-detail-empty">
                            {task.status === "completed"
                                ? "No outputs captured."
                                : "Outputs appear once the task completes."}
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
}
