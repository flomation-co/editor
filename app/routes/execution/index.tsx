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
import {faLink, faSpinner, faRotateRight} from "@fortawesome/pro-solid-svg-icons";
import useCookieToken from "~/components/cookie";
import {useToast} from "~/components/toast";
import {LogOutput} from "~/components/logOutput";
import ExecutionFlowView from "~/components/executionFlowView";
import NodeInspector from "~/components/executionFlowView/NodeInspector";

dayjs.extend(relativeTime);
dayjs.extend(utc);

export function meta({}: Route.MetaArgs) {
    return [
        { title: "Flomation - Execution" },
        { name: "description", content: "Get in the Flo" },
    ];
}

export default function ExecutionDetail() {
    const navigate = useNavigate();
    const [ executionID, setExecutionID ] = useState<string>(useParams().id)
    const [ exec, setExec ] = useState<Execution>();
    const [ isRerunning, setIsRerunning ] = useState<boolean>(false);
    const { showToast } = useToast();

    const [ streamingLogs, setStreamingLogs ] = useState<string[]>([]);
    const [ nodeStatuses, setNodeStatuses ] = useState<Map<string, NodeStatus>>(new Map());
    const [ selectedNodeId, setSelectedNodeId ] = useState<string | null>(null);

    const [ isMobile, setIsMobile ] = useState<boolean>(true);
    const [ width, setWidth ] = useState<number>(0);

    const [ logModeRaw, setLogModeRaw ] = useState<boolean>(true)

    const controller = new AbortController();
    const token = useCookieToken();

    function handleWindowSizeChange() {
        setWidth(window.innerWidth);
    }

    useEffect(() => {
        window.addEventListener('resize', handleWindowSizeChange);
        return () => {
            window.removeEventListener('resize', handleWindowSizeChange);
        }
    }, []);

    useEffect(() => {
        setIsMobile(width <= 768);
    }, [ width ]);

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
                    // Merge with existing data — running events lack inputs/outputs
                    next.set(nodeData.id, { ...existing, ...nodeData });
                    return next;
                });
            } catch (e) {
                console.error("Failed to parse node event", e);
            }
        });

        eventSource.addEventListener("complete", () => {
            eventSource.close();
            // Re-fetch the full execution to get final state
            queryExecutionState();
        });

        eventSource.onerror = () => {
            eventSource.close();
            // Fall back to polling on SSE failure
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

    function formatDate(date) {
        if (!date) {
            return "";
        }

        return dayjs.utc(date).fromNow();
    }

    function formatDateString(date) {
        if (!date) {
            return "Never Run";
        }

        return dayjs.utc(date).local().format("D MMM YYYY H:mm:ss");
    }

    return (
        <Container>
            {exec && (
                <>
                    <div className={"header"}>
                        {exec.name} - #{exec.sequence}
                        <div className={"small-label"}><ExecuteState state={exec.execution_status} completionState={exec.completion_status} /></div>
                        {exec.completion_status !== "pending" && (
                            <button className={"rerun-button"} onClick={rerunExecution} disabled={isRerunning}>
                                <FontAwesomeIcon icon={isRerunning ? faSpinner : faRotateRight} spin={isRerunning} /> Re-run
                            </button>
                        )}
                    </div>

                    <div><div className={"property-label"}>Flow: <span className={"flo-table-subtext"}><Link to={"/flo/" + exec.flo_id}>{exec.name} <FontAwesomeIcon icon={faLink} /> </Link></span></div></div>
                    <div><div className={"property-label"}>Started: <span className={"flo-table-subtext"}>{formatDateString(exec.created_at)}</span></div></div>
                    <div><div className={"property-label"}>Completed: <span className={"flo-table-subtext"}>{exec.completed_at ? formatDateString(exec.completed_at) : "-"}</span></div></div>
                    <div><div className={"property-label"}>Runner: <span className={"flo-table-subtext"}>{exec.runner_id ? exec.runner_id : "-"}</span></div></div>
                    <div><div className={"property-label"}>Duration: <span className={"flo-table-subtext"}>{exec.duration > 0 ? exec.duration + " ms" : ""}</span></div></div>

                    <div className={"code-block-label"}>Flow</div>
                    <ExecutionFlowView
                        floId={exec.flo_id}
                        nodeStatuses={nodeStatuses}
                        onNodeClick={handleNodeClick}
                    />
                    {selectedNodeId && nodeStatuses.has(selectedNodeId) && (
                        <NodeInspector
                            nodeId={selectedNodeId}
                            status={nodeStatuses.get(selectedNodeId)!}
                            onClose={() => setSelectedNodeId(null)}
                        />
                    )}

                    <div className={"code-block-label"}>
                        Inputs
                    </div>
                    <pre className={"code-block"}>
                        {exec.data && (
                            <>
                                {JSON.stringify(exec.data, null, 4)}
                            </>
                        )}
                    </pre>

                    <div className={"code-block-label"}>
                        Outputs
                    </div>
                    <pre className={"code-block"}>
                        {exec.completion_status === "pending" && !exec.result && (
                            <div className={"loading-container"} style={{padding: "20px 0"}}>
                                <FontAwesomeIcon icon={faSpinner} spin /> <span style={{marginLeft: "8px", color: "rgba(255,255,255,0.4)"}}>Waiting for execution to complete...</span>
                            </div>
                        )}
                        {exec.completion_status !== "pending" && !exec.result && (
                            <>&nbsp;</>
                        )}
                        {exec.result && (
                            <>
                                {exec.result.outputs ? JSON.stringify(exec.result.outputs, null, 4): " "}
                            </>
                        )}
                    </pre>

                    <div className={"code-block-label"}>
                        Logs
                    </div>

                    <div className={"log-toggle"}>
                        <span className={!logModeRaw ? "log-toggle-option active" : "log-toggle-option"} onClick={() => setLogModeRaw(false)}>Parsed</span>
                        <span className={logModeRaw ? "log-toggle-option active" : "log-toggle-option"} onClick={() => setLogModeRaw(true)}>Raw</span>
                    </div>

                    {!logModeRaw && (
                        <>
                            {exec.completion_status === "pending" && !exec.result && (
                                <pre className={"code-block"}>
                                    <div className={"loading-container"} style={{padding: "20px 0"}}>
                                        <FontAwesomeIcon icon={faSpinner} spin /> <span style={{marginLeft: "8px", color: "rgba(255,255,255,0.4)"}}>Streaming logs...</span>
                                    </div>
                                </pre>
                            )}
                            {exec.result && <LogOutput logs={exec.result} />}
                        </>
                    )}

                    {logModeRaw && (
                        <pre className={"code-block"}>
                        {exec.completion_status === "pending" && !exec.result && streamingLogs.length === 0 && (
                            <div className={"loading-container"} style={{padding: "20px 0"}}>
                                <FontAwesomeIcon icon={faSpinner} spin /> <span style={{marginLeft: "8px", color: "rgba(255,255,255,0.4)"}}>Waiting for logs...</span>
                            </div>
                        )}
                        {exec.completion_status !== "pending" && !exec.result && streamingLogs.length === 0 && (
                            <>&nbsp;</>
                        )}
                            {exec.result && exec.result.logs && (
                                <>
                                    {exec.result.logs}
                                </>
                            )}
                            {!exec.result && streamingLogs.length > 0 && (
                                <>
                                    {streamingLogs.join("\n")}
                                </>
                            )}
                    </pre>
                    )}
                </>
            )}
        </Container>
    )
}