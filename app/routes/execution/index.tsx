import type {Route} from "../+types/home";
import "./index.css"
import Container from "~/components/container";
import {Link, useNavigate, useParams} from "react-router";
import {CompletionStateValue, ExecuteState, ExecutionStateValue} from "~/components/executionState";
import type {Execution, NodeStatus} from "~/types";
import {useCallback, useEffect, useRef, useState} from "react";
import api from "~/lib/api";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";
import useConfig from "~/components/config";
import useCookieToken from "~/components/cookie";
import {useToast} from "~/components/toast";
import {LogOutput} from "~/components/logOutput";
import ExecutionFlowView, { type ExecutionFlowViewHandle } from "~/components/executionFlowView";
import NodeInspector from "~/components/executionFlowView/NodeInspector";
import DataInspector from "~/components/dataInspector";
import { Icon } from "~/components/icons/Icon";
import ProtectedRoute from "~/components/protected-route";
import {PERMISSIONS} from "~/types";

dayjs.extend(relativeTime);
dayjs.extend(utc);

export function meta({}: Route.MetaArgs) {
    return [
        { title: "Flomation - Execution" },
        { name: "description", content: "Get in the Flo" },
    ];
}

type DetailTab = 'inputs' | 'outputs' | 'logs';

export default function ExecutionDetail() {
    const navigate = useNavigate();
    const { id: executionID } = useParams();
    const [ exec, setExec ] = useState<Execution>();
    const [ isRerunning, setIsRerunning ] = useState<boolean>(false);
    const [ isCancelling, setIsCancelling ] = useState<boolean>(false);
    const [ isResuming, setIsResuming ] = useState<boolean>(false);
    const [ showTimingPane, setShowTimingPane ] = useState<boolean>(false);
    const { showToast } = useToast();

    const [ streamingLogs, setStreamingLogs ] = useState<string[]>([]);
    const [ nodeStatuses, setNodeStatuses ] = useState<Map<string, NodeStatus[]>>(new Map());
    const [ selectedNodeId, setSelectedNodeId ] = useState<string | null>(null);
    const [ selectedIteration, setSelectedIteration ] = useState<number>(-1);

    const [ detailPanelOpen, setDetailPanelOpen ] = useState<boolean>(false);
    const [ detailTab, setDetailTab ] = useState<DetailTab>('outputs');
    const [ elapsedMs, setElapsedMs ] = useState<number>(0);

    // Hierarchy breadcrumb: chain of ancestor executions ordered
    // root → parent. Empty for top-of-tree executions. Fetched on-
    // demand whenever the current execution actually has a parent.
    const [ ancestors, setAncestors ] = useState<Execution[]>([]);

    const flowViewRef = useRef<ExecutionFlowViewHandle>(null);

    const controller = new AbortController();
    const token = useCookieToken();

    // Reset all state when the execution ID changes (e.g. after re-run)
    useEffect(() => {
        setExec(undefined);
        setStreamingLogs([]);
        setNodeStatuses(new Map());
        setSelectedNodeId(null);
        setSelectedIteration(-1);
        setDetailPanelOpen(false);
        setIsRerunning(false);
        setAncestors([]);
    }, [executionID]);

    // Fetch ancestor chain once the execution loads and we know it
    // has a parent. Root executions skip the round-trip entirely.
    useEffect(() => {
        if (!exec || !exec.parent_execution_id) return;
        const config = useConfig();
        const url = config("AUTOMATE_API_URL") + '/api/v1/execution/' + exec.id + '/ancestors';
        api.get(url, { headers: { Authorization: "Bearer " + token } })
            .then(resp => { if (resp) setAncestors(resp.data || []); })
            .catch(err => console.error("failed to fetch ancestors", err));
    }, [exec?.id, exec?.parent_execution_id]);

    const queryExecutionState = () => {
        const config = useConfig();
        let url = config("AUTOMATE_API_URL") + '/api/v1/execution/' + executionID;

        api.get(url, {
            signal: controller.signal,
            headers: {
                Authorization: "Bearer " + token,
            }
        })
            .then(response => {
                if (response) {
                    setExec(response.data);
                }
            })
            .catch(error => {
                console.error(error);
            })
    }

    const rerunExecution = () => {
        if (!exec || isRerunning) return;
        setIsRerunning(true);

        const config = useConfig();
        const url = config("AUTOMATE_API_URL") + `/api/v1/flo/${exec.flo_id}/trigger/default/execute`;

        api.post(url, null, {
            headers: { Authorization: "Bearer " + token }
        })
            .then(response => {
                if (response?.data?.id) {
                    showToast("Flow re-triggered successfully");
                    navigate("/execution/" + response.data.id);
                }
            })
            .catch(error => {
                console.error(error);
                showToast("Failed to re-run flow", "error");
            })
            .finally(() => setIsRerunning(false));
    };

    const cancelExecution = () => {
        if (!exec || isCancelling) return;
        setIsCancelling(true);

        const config = useConfig();
        const url = config("AUTOMATE_API_URL") + `/api/v1/execution/${executionID}/cancel`;

        api.post(url, null, {
            headers: { Authorization: "Bearer " + token }
        })
            .then(() => {
                showToast("Execution cancelled");
                queryExecutionState();
            })
            .catch(error => {
                console.error(error);
                showToast("Failed to cancel execution", "error");
            })
            .finally(() => setIsCancelling(false));
    };

    const resumeExecution = () => {
        if (!exec || isResuming) return;
        setIsResuming(true);

        const config = useConfig();
        const url = config("AUTOMATE_API_URL") + `/api/v1/execution/${executionID}/resume`;

        api.post(url, null, {
            headers: { Authorization: "Bearer " + token }
        })
            .then(() => {
                showToast("Execution resumed");
                queryExecutionState();
            })
            .catch(error => {
                console.error(error);
                showToast("Failed to resume execution", "error");
            })
            .finally(() => setIsResuming(false));
    };

    // Initial fetch
    useEffect(() => {
        queryExecutionState();
    }, [ executionID ]);

    // SSE streaming for live logs
    useEffect(() => {
        if (!exec || exec.completion_status !== "pending") return;

        const config = useConfig();
        let eventSource: EventSource | null = null;

        // Exchange JWT for a short-lived stream token before opening EventSource
        fetch(config("AUTOMATE_API_URL") + '/api/v1/auth/stream-token', {
            method: 'POST',
            headers: { Authorization: "Bearer " + token },
        })
        .then(res => res.json())
        .then(data => {
            const streamToken = data.token || token;
            const url = config("AUTOMATE_API_URL") + '/api/v1/execution/' + executionID + '/stream?token=' + encodeURIComponent(streamToken);
            eventSource = new EventSource(url);

            eventSource.onmessage = (event) => {
                setStreamingLogs(prev => [...prev, event.data]);
            };

            eventSource.addEventListener("status", (event) => {
                setExec(prev => prev ? {...prev, execution_status: event.data} : prev);
            });

            eventSource.addEventListener("node", (event) => {
                try {
                    const nodeData = JSON.parse(event.data) as NodeStatus;
                    setNodeStatuses(prev => {
                        const next = new Map(prev);
                        const existing = next.get(nodeData.id) || [];
                        const last = existing.length > 0 ? existing[existing.length - 1] : null;
                        if (nodeData.status === 'running') {
                            // A `running` event arriving after `suspended` is a
                            // RESUME of the same logical iteration — not a new
                            // one. Replace the suspended entry instead of
                            // appending. This stops Pause/Wait nodes from
                            // showing a misleading ×2 badge after every
                            // suspend/resume cycle (the iteration badge is for
                            // Loop nodes, not for paused-then-resumed nodes).
                            if (last?.status === 'suspended') {
                                const updated = [...existing];
                                updated[updated.length - 1] = nodeData;
                                next.set(nodeData.id, updated);
                            } else {
                                next.set(nodeData.id, [...existing, nodeData]);
                            }
                        } else {
                            // Completion events update the last entry (the running one)
                            if (last?.status === 'running') {
                                const updated = [...existing];
                                updated[updated.length - 1] = { ...last, ...nodeData };
                                next.set(nodeData.id, updated);
                            } else {
                                next.set(nodeData.id, [...existing, nodeData]);
                            }
                        }
                        return next;
                    });
                } catch (e) {
                    console.error("Failed to parse node event", e);
                }
            });

            eventSource.addEventListener("complete", () => {
                eventSource?.close();
                queryExecutionState();
            });

            eventSource.onerror = () => {
                eventSource?.close();
                const interval = setInterval(() => {
                    queryExecutionState();
                }, 2000);

                return () => clearInterval(interval);
            };
        })
        .catch(() => {
            // Fall back to polling if stream token exchange fails
            const interval = setInterval(() => {
                queryExecutionState();
            }, 2000);
            return () => clearInterval(interval);
        });

        return () => {
            eventSource?.close();
        };
    }, [ exec?.completion_status, executionID ]);

    // Populate node statuses from persisted results (completed/historical executions).
    // Parse __NODE__ events from logs to recover per-iteration data.
    useEffect(() => {
        if (!exec?.result) return;

        const map = new Map<string, NodeStatus[]>();

        // First, try to extract iterations from raw logs
        const logStr = exec.result.logs || '';
        if (logStr) {
            logStr.split('\n').forEach((line: string) => {
                if (!line.startsWith('__NODE__:')) return;
                try {
                    const data = JSON.parse(line.substring(9)) as NodeStatus;
                    const existing = map.get(data.id) || [];
                    const last = existing.length > 0 ? existing[existing.length - 1] : null;
                    if (data.status === 'running') {
                        // `running` after `suspended` is a resume of the same
                        // iteration — replace, don't append. See the matching
                        // SSE handler above for the full rationale.
                        if (last?.status === 'suspended') {
                            existing[existing.length - 1] = data;
                        } else {
                            existing.push(data);
                        }
                    } else {
                        // Merge completion into the last running entry for this node
                        if (last?.status === 'running') {
                            existing[existing.length - 1] = { ...last, ...data };
                        } else {
                            existing.push(data);
                        }
                    }
                    map.set(data.id, existing);
                } catch { /* skip unparseable lines */ }
            });
        }

        // Overlay node_results onto whatever the log walk gave us.
        // Two distinct cases:
        //
        //   1) Nodes that NEVER appeared in logs (single-execution
        //      nodes that emitted no streaming event) — node_results
        //      is the only source we have, so install it as the sole
        //      iteration.
        //
        //   2) Nodes that DID appear in logs — the log entries carry
        //      truncated inputs/outputs because emitNodeEvent caps
        //      string values at ~4KB to keep the runner-executor
        //      stdout pipe from blocking. node_results carries the
        //      full, untruncated values. We replace the FINAL log
        //      iteration's value map with the full one, preserving
        //      any earlier loop iterations (which only exist in
        //      logs — node_results only stores the latest).
        //
        // Without this overlay, a 553KB TTS audio_base64 displays in
        // the inspector with a "… [truncated, NKB bytes total]"
        // suffix that breaks Download links, audio playback, and any
        // downstream rendering that assumes the value is complete.
        if (exec.result.node_results) {
            for (const [id, nr] of Object.entries(exec.result.node_results as Record<string, NodeStatus>)) {
                const existing = map.get(id);
                if (!existing || existing.length === 0) {
                    map.set(id, [nr]);
                    continue;
                }
                const updated = [...existing];
                const last = updated[updated.length - 1];
                updated[updated.length - 1] = {
                    ...last,
                    inputs: nr.inputs ?? last.inputs,
                    outputs: nr.outputs ?? last.outputs,
                };
                map.set(id, updated);
            }
        }

        setNodeStatuses(map);
    }, [exec?.result]);

    const handleNodeClick = useCallback((nodeId: string, iterationIndex?: number) => {
        setSelectedNodeId(nodeId);
        // Default to the last iteration (-1 signals "show latest")
        setSelectedIteration(iterationIndex !== undefined ? iterationIndex : -1);
    }, []);

    const focusNode = useCallback((nodeId: string, iterationIndex?: number) => {
        if (flowViewRef.current) {
            flowViewRef.current.focusNode(nodeId);
        }
        // Also select the node and iteration so the inspector opens
        setSelectedNodeId(nodeId);
        setSelectedIteration(iterationIndex !== undefined ? iterationIndex : -1);
    }, []);

    function formatDateString(date) {
        if (!date) {
            return "Never Run";
        }

        return dayjs.utc(date).local().format("D MMM YYYY H:mm:ss");
    }

    function friendlyDuration(ms?: number): string {
        if (!ms || ms <= 0) return "";
        if (ms < 1000) return ms + "ms";
        const seconds = Math.floor(ms / 1000);
        if (seconds < 60) return seconds + "s";
        const minutes = Math.floor(seconds / 60);
        const remainSec = seconds % 60;
        if (minutes < 60) return remainSec > 0 ? `${minutes}m ${remainSec}s` : `${minutes}m`;
        const hours = Math.floor(minutes / 60);
        const remainMin = minutes % 60;
        return remainMin > 0 ? `${hours}h ${remainMin}m` : `${hours}h`;
    }

    // Calculate the effective duration:
    // 1. Use result duration if available (from executor)
    // 2. Fall back to created_at → completed_at diff (for cancelled/failed without result)
    // 3. For in-progress flows, calculate live elapsed time
    function getEffectiveDuration(): number {
        if (!exec) return 0;
        if (exec.duration && exec.duration > 0) return exec.duration;
        if (exec.completed_at && exec.created_at) {
            return dayjs.utc(exec.completed_at).diff(dayjs.utc(exec.created_at));
        }
        return 0;
    }

    // Live elapsed timer for in-progress executions
    useEffect(() => {
        if (!exec || exec.completion_status !== 'pending') {
            setElapsedMs(0);
            return;
        }
        const start = dayjs.utc(exec.created_at);
        const tick = () => setElapsedMs(dayjs.utc().diff(start));
        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [exec?.id, exec?.completion_status]);

    const openDetailPanel = (tab: DetailTab) => {
        setDetailTab(tab);
        setDetailPanelOpen(true);
    };

    return (
        <Container noPadding>
            <ProtectedRoute permission={PERMISSIONS.FLOW_EXECUTE}>
            {exec && (
                <div className="exec-page">
                    {ancestors.length > 0 && (
                        <div className="exec-breadcrumb" aria-label="Execution hierarchy">
                            {ancestors.map((a, i) => (
                                <span key={a.id} className="exec-breadcrumb-segment">
                                    <Link
                                        to={"/execution/" + a.id}
                                        className={"exec-breadcrumb-link" + (i === 0 ? " exec-breadcrumb-link--root" : "")}
                                        title={a.id}
                                    >
                                        {i === 0 && <span className="exec-breadcrumb-root-marker">root:</span>}
                                        {a.name || a.id.slice(0, 8)}
                                    </Link>
                                    <span className="exec-breadcrumb-sep" aria-hidden="true">▸</span>
                                </span>
                            ))}
                            <span className="exec-breadcrumb-current">
                                {exec.name || exec.id.slice(0, 8)}
                                {exec.parent_relationship && (
                                    <span className="exec-breadcrumb-rel" title={"Relationship to parent: " + exec.parent_relationship}>
                                        {exec.parent_relationship}
                                    </span>
                                )}
                            </span>
                        </div>
                    )}

                    {/* ── Compact header bar ── */}
                    <div className="exec-header">
                        <div className="exec-header-left">
                            <span className="exec-header-title">{exec.name}</span>
                            <span className="exec-header-sequence">#{exec.sequence}</span>
                            <div className="exec-header-status"><ExecuteState state={exec.execution_status} completionState={exec.completion_status} /></div>
                        </div>
                        <div className="exec-header-right">
                            {exec.execution_status === "suspended" && (
                                <button className="resume-button" onClick={resumeExecution} disabled={isResuming}>
                                    <Icon name={isResuming ? "spinner" : "play"} spin={isResuming} /> Resume
                                </button>
                            )}
                            {exec.completion_status === "pending" && (
                                <button className="cancel-button" onClick={cancelExecution} disabled={isCancelling}>
                                    <Icon name={isCancelling? "spinner" : "ban"} spin={isCancelling} /> Cancel
                                </button>
                            )}
                            {exec.completion_status !== "pending" && exec.execution_status !== "suspended" && (
                                <button className="rerun-button" onClick={rerunExecution} disabled={isRerunning}>
                                    <Icon name={isRerunning? "spinner" : "rotate-right"} spin={isRerunning} /> Re-run
                                </button>
                            )}
                        </div>
                    </div>

                    {/* ── Metadata chips ── */}
                    <div className="exec-meta-bar">
                        <Link to={"/flo/" + exec.flo_id} className="exec-meta-chip exec-meta-chip--link">
                            <Icon name="arrow-up-right-from-square" /> {exec.name}
                        </Link>
                        <span className="exec-meta-chip">
                            <Icon name="clock" /> {formatDateString(exec.created_at)}
                        </span>
                        {exec.completion_status === 'pending' && elapsedMs > 0 && (
                            <span className="exec-meta-chip exec-meta-chip--live">
                                <Icon name="hourglass-half" /> {friendlyDuration(elapsedMs)}
                            </span>
                        )}
                        {exec.completion_status !== 'pending' && getEffectiveDuration() > 0 && (
                            <span
                                className="exec-meta-chip exec-meta-chip--clickable"
                                onClick={() => setShowTimingPane(!showTimingPane)}
                                title="Click to view execution timing segments"
                            >
                                <Icon name="clock" /> {friendlyDuration(getEffectiveDuration())}
                                {(exec as any).suspend_count > 0 && (
                                    <span className="exec-meta-suspend-count">({(exec as any).suspend_count} pause{(exec as any).suspend_count !== 1 ? 's' : ''})</span>
                                )}
                            </span>
                        )}
                        {(exec.runner_name || exec.runner_id) && (
                            <span className="exec-meta-chip">{exec.runner_name || exec.runner_id}</span>
                        )}
                    </div>

                    {/* ── Timing segments pane ── */}
                    {showTimingPane && (exec as any).segments && (
                        <div className="exec-timing-pane">
                            <div className="exec-timing-header">
                                <span className="exec-timing-title">Execution Segments</span>
                                <span className="exec-timing-total">
                                    Total billed: {friendlyDuration((exec as any).billing_duration || getEffectiveDuration())}
                                </span>
                            </div>
                            <div className="exec-timing-segments">
                                {(() => {
                                    try {
                                        const segments = typeof (exec as any).segments === 'string'
                                            ? JSON.parse((exec as any).segments)
                                            : (exec as any).segments;
                                        if (!Array.isArray(segments) || segments.length === 0) {
                                            return <div className="exec-timing-empty">No segments recorded</div>;
                                        }
                                        return segments.map((seg: any, i: number) => (
                                            <div key={i} className={`exec-timing-segment exec-timing-segment--${seg.status}`}>
                                                <span className="exec-timing-segment-index">#{i + 1}</span>
                                                <span className="exec-timing-segment-status">{seg.status}</span>
                                                <span className="exec-timing-segment-duration">{friendlyDuration(seg.duration_ms)}</span>
                                                <span className="exec-timing-segment-times">
                                                    {formatDateString(seg.started_at)} → {formatDateString(seg.ended_at)}
                                                </span>
                                                {seg.runner_id && (
                                                    <span className="exec-timing-segment-runner">{seg.runner_id}</span>
                                                )}
                                            </div>
                                        ));
                                    } catch {
                                        return <div className="exec-timing-empty">Unable to parse segments</div>;
                                    }
                                })()}
                            </div>
                        </div>
                    )}

                    {/* ── Flow visualisation (fills remaining space) ── */}
                    <div className="exec-flow-area">
                        <ExecutionFlowView
                            ref={flowViewRef}
                            floId={exec.flo_id}
                            nodeStatuses={nodeStatuses}
                            onNodeClick={handleNodeClick}
                        />

                        {/* ── Node inspector overlay ── */}
                        {selectedNodeId && nodeStatuses.has(selectedNodeId) && (() => {
                            const iterations = nodeStatuses.get(selectedNodeId)!;
                            const currentIdx = selectedIteration < 0 || selectedIteration >= iterations.length
                                ? iterations.length - 1
                                : selectedIteration;
                            return (
                                <NodeInspector
                                    nodeId={selectedNodeId}
                                    status={iterations[currentIdx]}
                                    iterations={iterations}
                                    currentIteration={currentIdx}
                                    onIterationChange={setSelectedIteration}
                                    onClose={() => { setSelectedNodeId(null); setSelectedIteration(-1); }}
                                />
                            );
                        })()}

                        {/* ── Quick-access tab buttons (bottom of flow area) ── */}
                        {!detailPanelOpen && (
                            <div className="exec-detail-tabs-bar">
                                <button className="exec-detail-tab-btn" onClick={() => openDetailPanel('inputs')}>Inputs</button>
                                <button className="exec-detail-tab-btn" onClick={() => openDetailPanel('outputs')}>Outputs</button>
                                <button className="exec-detail-tab-btn" onClick={() => openDetailPanel('logs')}>Logs</button>
                            </div>
                        )}

                        {/* ── Floating detail panel ── */}
                        {detailPanelOpen && (
                            <div className="exec-detail-panel">
                                <div className="exec-detail-panel-header">
                                    <div className="exec-detail-panel-tabs">
                                        <button
                                            className={`exec-detail-panel-tab ${detailTab === 'inputs' ? 'active' : ''}`}
                                            onClick={() => setDetailTab('inputs')}
                                        >
                                            Inputs
                                        </button>
                                        <button
                                            className={`exec-detail-panel-tab ${detailTab === 'outputs' ? 'active' : ''}`}
                                            onClick={() => setDetailTab('outputs')}
                                        >
                                            Outputs
                                        </button>
                                        <button
                                            className={`exec-detail-panel-tab ${detailTab === 'logs' ? 'active' : ''}`}
                                            onClick={() => setDetailTab('logs')}
                                        >
                                            Logs
                                        </button>
                                    </div>
                                    <button className="exec-detail-panel-close" onClick={() => setDetailPanelOpen(false)}>
                                        <Icon name="xmark" />
                                    </button>
                                </div>

                                <div className="exec-detail-panel-body">
                                    {/* Inputs tab */}
                                    {detailTab === 'inputs' && (
                                        <DataInspector data={exec.data} emptyMessage="No input data" />
                                    )}

                                    {/* Outputs tab */}
                                    {detailTab === 'outputs' && (
                                        <>
                                            {exec.completion_status === "pending" && !exec.result && (
                                                <div className="exec-detail-loading">
                                                    <Icon name="spinner" spin /> <span>Waiting for execution to complete...</span>
                                                </div>
                                            )}
                                            {(exec.result?.outputs || exec.completion_status !== "pending") && (
                                                <DataInspector data={exec.result?.outputs} emptyMessage="No output data" />
                                            )}
                                        </>
                                    )}

                                    {/* Logs tab */}
                                    {detailTab === 'logs' && (
                                        <LogOutput
                                            logs={exec.result}
                                            streamingLines={!exec.result ? streamingLogs : undefined}
                                            onNodeClick={focusNode}
                                        />
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
            </ProtectedRoute>
        </Container>
    )
}
