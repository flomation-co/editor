import type {Route} from "../+types/home";
import "./index.css"
import Container from "~/components/container";
import {Link, useNavigate, useParams} from "react-router";
import {CompletionStateValue, ExecuteState, ExecutionStateValue} from "~/components/executionState";
import type {Execution, NodeStatus} from "~/types";
import {useCallback, useEffect, useState} from "react";
import api from "~/lib/api";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import useConfig from "~/components/config";
import {faLink, faSpinner, faRotateRight, faXmark, faClock, faArrowUpRightFromSquare, faChevronDown, faChevronUp, faBan} from "@fortawesome/pro-solid-svg-icons";
import useCookieToken from "~/components/cookie";
import {useToast} from "~/components/toast";
import {LogOutput} from "~/components/logOutput";
import ExecutionFlowView from "~/components/executionFlowView";
import NodeInspector from "~/components/executionFlowView/NodeInspector";
import DataInspector from "~/components/dataInspector";

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
    const { showToast } = useToast();

    const [ streamingLogs, setStreamingLogs ] = useState<string[]>([]);
    const [ nodeStatuses, setNodeStatuses ] = useState<Map<string, NodeStatus>>(new Map());
    const [ selectedNodeId, setSelectedNodeId ] = useState<string | null>(null);

    const [ detailPanelOpen, setDetailPanelOpen ] = useState<boolean>(false);
    const [ detailTab, setDetailTab ] = useState<DetailTab>('outputs');

    const controller = new AbortController();
    const token = useCookieToken();

    // Reset all state when the execution ID changes (e.g. after re-run)
    useEffect(() => {
        setExec(undefined);
        setStreamingLogs([]);
        setNodeStatuses(new Map());
        setSelectedNodeId(null);
        setDetailPanelOpen(false);
        setIsRerunning(false);
    }, [executionID]);

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

    // Initial fetch
    useEffect(() => {
        queryExecutionState();
    }, [ executionID ]);

    // SSE streaming for live logs
    useEffect(() => {
        if (!exec || exec.completion_status !== "pending") return;

        const config = useConfig();
        const url = config("AUTOMATE_API_URL") + '/api/v1/execution/' + executionID + '/stream?token=' + encodeURIComponent(token);

        const eventSource = new EventSource(url);

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
                    const existing = next.get(nodeData.id);
                    next.set(nodeData.id, { ...existing, ...nodeData });
                    return next;
                });
            } catch (e) {
                console.error("Failed to parse node event", e);
            }
        });

        eventSource.addEventListener("complete", () => {
            eventSource.close();
            queryExecutionState();
        });

        eventSource.onerror = () => {
            eventSource.close();
            const interval = setInterval(() => {
                queryExecutionState();
            }, 2000);

            return () => clearInterval(interval);
        };

        return () => {
            eventSource.close();
        };
    }, [ exec?.completion_status, executionID ]);

    // Populate node statuses from persisted results (completed/historical executions)
    useEffect(() => {
        if (exec?.result?.node_results) {
            const map = new Map<string, NodeStatus>();
            for (const [id, nr] of Object.entries(exec.result.node_results as Record<string, NodeStatus>)) {
                map.set(id, nr);
            }
            setNodeStatuses(map);
        }
    }, [exec?.result]);

    const handleNodeClick = useCallback((nodeId: string) => {
        setSelectedNodeId(nodeId);
    }, []);

    function formatDateString(date) {
        if (!date) {
            return "Never Run";
        }

        return dayjs.utc(date).local().format("D MMM YYYY H:mm:ss");
    }

    const openDetailPanel = (tab: DetailTab) => {
        setDetailTab(tab);
        setDetailPanelOpen(true);
    };

    return (
        <Container noPadding>
            {exec && (
                <div className="exec-page">
                    {/* ── Compact header bar ── */}
                    <div className="exec-header">
                        <div className="exec-header-left">
                            <span className="exec-header-title">{exec.name}</span>
                            <span className="exec-header-sequence">#{exec.sequence}</span>
                            <div className="exec-header-status"><ExecuteState state={exec.execution_status} completionState={exec.completion_status} /></div>
                        </div>
                        <div className="exec-header-right">
                            {exec.completion_status === "pending" && (
                                <button className="cancel-button" onClick={cancelExecution} disabled={isCancelling}>
                                    <FontAwesomeIcon icon={isCancelling ? faSpinner : faBan} spin={isCancelling} /> Cancel
                                </button>
                            )}
                            {exec.completion_status !== "pending" && (
                                <button className="rerun-button" onClick={rerunExecution} disabled={isRerunning}>
                                    <FontAwesomeIcon icon={isRerunning ? faSpinner : faRotateRight} spin={isRerunning} /> Re-run
                                </button>
                            )}
                        </div>
                    </div>

                    {/* ── Metadata chips ── */}
                    <div className="exec-meta-bar">
                        <Link to={"/flo/" + exec.flo_id} className="exec-meta-chip exec-meta-chip--link">
                            <FontAwesomeIcon icon={faArrowUpRightFromSquare} /> {exec.name}
                        </Link>
                        <span className="exec-meta-chip">
                            <FontAwesomeIcon icon={faClock} /> {formatDateString(exec.created_at)}
                        </span>
                        {exec.duration > 0 && (
                            <span className="exec-meta-chip">{exec.duration}ms</span>
                        )}
                        {exec.runner_id && (
                            <span className="exec-meta-chip">{exec.runner_id}</span>
                        )}
                    </div>

                    {/* ── Flow visualisation (fills remaining space) ── */}
                    <div className="exec-flow-area">
                        <ExecutionFlowView
                            floId={exec.flo_id}
                            nodeStatuses={nodeStatuses}
                            onNodeClick={handleNodeClick}
                        />

                        {/* ── Node inspector overlay ── */}
                        {selectedNodeId && nodeStatuses.has(selectedNodeId) && (
                            <NodeInspector
                                nodeId={selectedNodeId}
                                status={nodeStatuses.get(selectedNodeId)!}
                                onClose={() => setSelectedNodeId(null)}
                            />
                        )}

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
                                        <FontAwesomeIcon icon={faXmark} />
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
                                                    <FontAwesomeIcon icon={faSpinner} spin /> <span>Waiting for execution to complete...</span>
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
                                        />
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </Container>
    )
}
