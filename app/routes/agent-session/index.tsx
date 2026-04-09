import type {Route} from "../+types/home";
import Container from "~/components/container";
import useConfig from "~/components/config";
import api from "~/lib/api";
import {useEffect, useState, useCallback, useMemo, useRef} from "react";
import type {AgentSession, AgentMessage, Execution} from "~/types";
import useCookieToken from "~/components/cookie";
import {useParams, useNavigate} from "react-router";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import "./index.css";
import { Icon } from "~/components/icons/Icon";

dayjs.extend(utc);

export function meta({}: Route.MetaArgs) {
    return [
        { title: "Flomation - Agent Session" },
        { name: "description", content: "Agent session activity" },
    ];
}

type TimelineItem = {
    type: 'message' | 'action';
    timestamp: string;
    message?: AgentMessage;
    actionLabel?: string;
    actionType?: string;
    actionStatus?: string;
    actionDuration?: number;
    isOutbound?: boolean;
    outboundContent?: string;
    executionId?: string;
    sortKey?: number;
};

function buildTimeline(messages: AgentMessage[], executions: Execution[]): TimelineItem[] {
    const items: TimelineItem[] = [];

    for (const msg of messages) {
        items.push({
            type: 'message',
            timestamp: msg.created_at,
            message: msg,
            sortKey: new Date(msg.created_at).getTime(),
        });
    }

    for (const exec of executions) {
        if (!exec.result) continue;

        let result: any = exec.result;
        if (typeof result === 'string') {
            try { result = JSON.parse(result); } catch { continue; }
        }

        const nodeResults = result?.node_results;
        if (!nodeResults || typeof nodeResults !== 'object') continue;

        const logs = result?.logs || '';
        const nodeOrder: string[] = [];
        const nodeRegex = /__NODE__:\{.*?"id":"([^"]+)".*?"status":"(success|failed)"/g;
        let logMatch;
        while ((logMatch = nodeRegex.exec(logs)) !== null) {
            if (!nodeOrder.includes(logMatch[1])) nodeOrder.push(logMatch[1]);
        }

        const sortedEntries = Object.entries(nodeResults).sort(([idA], [idB]) => {
            const orderA = nodeOrder.indexOf(idA);
            const orderB = nodeOrder.indexOf(idB);
            if (orderA === -1 && orderB === -1) return 0;
            if (orderA === -1) return 1;
            if (orderB === -1) return -1;
            return orderA - orderB;
        });

        const execStartMs = new Date(exec.created_at).getTime();
        let stepIndex = 0;

        for (const [, node] of sortedEntries as [string, any][]) {
            if (!node || !node.action) continue;
            if (node.action.startsWith('trigger/')) continue;

            const isOutbound = node.action.startsWith('messaging/') ||
                node.action === 'agent/send_message' ||
                node.action.startsWith('output/slack') ||
                node.action.startsWith('output/discord');

            let outboundContent: string | undefined;
            if (isOutbound && node.inputs) {
                outboundContent = node.inputs['message'] || node.inputs['content'] || node.inputs['text'];
            }

            stepIndex++;
            items.push({
                type: 'action',
                timestamp: exec.created_at,
                actionLabel: node.label || node.action,
                actionType: node.action,
                actionStatus: node.status,
                actionDuration: node.duration_ms,
                isOutbound,
                outboundContent,
                executionId: exec.id,
                sortKey: execStartMs + stepIndex,
            });
        }
    }

    items.sort((a, b) => (a.sortKey || 0) - (b.sortKey || 0));
    return items;
}

function formatActionName(action: string): string {
    const parts = action.split('/');
    const last = parts[parts.length - 1];
    return last.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function getChannelIcon(actionType: string): any {
    if (actionType.includes('telegram')) return "telegram";
    if (actionType.includes('slack')) return "slack";
    if (actionType.includes('email')) return "envelope";
    return "paper-plane";
}

function getChannelName(actionType: string): string {
    if (actionType.includes('telegram')) return 'Telegram';
    if (actionType.includes('slack')) return 'Slack';
    if (actionType.includes('email')) return 'Email';
    return 'Message';
}

export default function AgentSessionView() {
    const { id, sessionId } = useParams();
    const token = useCookieToken();
    const config = useConfig();
    const navigate = useNavigate();
    const baseUrl = config("AUTOMATE_API_URL") + `/api/v1/agent/${id}`;

    const [session, setSession] = useState<AgentSession | null>(null);
    const [messages, setMessages] = useState<AgentMessage[]>([]);
    const [executions, setExecutions] = useState<Execution[]>([]);
    const [loading, setLoading] = useState(true);
    const [hasRunningExecution, setHasRunningExecution] = useState(false);
    const [userScrolledUp, setUserScrolledUp] = useState(false);
    const [streamingItems, setStreamingItems] = useState<TimelineItem[]>([]);

    const timelineRef = useRef<HTMLDivElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const prevItemCount = useRef(0);

    const headers = { Authorization: "Bearer " + token };

    const loadSession = useCallback(() => {
        api.get(`${baseUrl}/session/${sessionId}?limit=500`, { headers })
            .then(response => {
                if (response?.data) {
                    setSession(response.data.session);
                    setMessages(response.data.messages || []);
                    setExecutions(response.data.executions || []);

                    // Check for running executions
                    const execs = response.data.executions || [];
                    const running = execs.some((e: Execution) =>
                        e.execution_status !== 'executed'
                    );
                    setHasRunningExecution(running);
                }
            })
            .catch(error => console.error(error))
            .finally(() => setLoading(false));
    }, [id, sessionId]);

    // Initial load
    useEffect(() => { loadSession(); }, [loadSession]);

    // SSE for real-time updates on active sessions
    useEffect(() => {
        if (!session || session.status !== 'active') return;

        const sseUrl = `${config("AUTOMATE_API_URL")}/api/v1/internal/agent/${id}/session/${sessionId}/stream`;
        const eventSource = new EventSource(sseUrl);

        eventSource.addEventListener('message', (e) => {
            try {
                const msg = JSON.parse(e.data) as AgentMessage;
                setMessages(prev => {
                    if (prev.some(m => m.id === msg.id)) return prev;
                    return [...prev, msg];
                });
                // An inbound message means an execution is likely starting
                if (msg.direction === 'inbound') {
                    setHasRunningExecution(true);
                }
            } catch {}
        });

        eventSource.addEventListener('node', (e) => {
            try {
                const node = JSON.parse(e.data);
                if (!node || !node.action || node.action.startsWith('trigger/')) return;
                if (node.status === 'running') {
                    // Show as in-progress action
                    return;
                }

                const isOutbound = node.action.startsWith('messaging/') ||
                    node.action === 'agent/send_message' ||
                    node.action.startsWith('output/slack') ||
                    node.action.startsWith('output/discord');

                let outboundContent: string | undefined;
                if (isOutbound && node.inputs) {
                    outboundContent = node.inputs['message'] || node.inputs['content'] || node.inputs['text'];
                }

                const newItem: TimelineItem = {
                    type: 'action',
                    timestamp: new Date().toISOString(),
                    actionLabel: node.label || node.action,
                    actionType: node.action,
                    actionStatus: node.status,
                    actionDuration: node.duration_ms,
                    isOutbound,
                    outboundContent,
                    sortKey: Date.now(),
                };

                // Append directly to timeline via a streaming items state
                setStreamingItems(prev => [...prev, newItem]);
                if (node.status === 'failed') {
                    setHasRunningExecution(false);
                }
            } catch {}
        });

        eventSource.addEventListener('execution', (e) => {
            try {
                const exec = JSON.parse(e.data) as Execution;
                setExecutions(prev => {
                    const existing = prev.findIndex(ex => ex.id === exec.id);
                    if (existing >= 0) {
                        const updated = [...prev];
                        updated[existing] = exec;
                        return updated;
                    }
                    return [...prev, exec];
                });
                setHasRunningExecution(false);
                // Clear streaming items — the full execution result replaces them
                setStreamingItems([]);
            } catch {}
        });

        eventSource.addEventListener('connected', () => {
            // SSE connected
        });

        eventSource.onerror = () => {
            // Reconnect handled automatically by EventSource
        };

        return () => eventSource.close();
    }, [session?.status, id, sessionId]);

    // Auto-scroll to bottom when new items appear (unless user scrolled up)
    const baseTimeline = useMemo(() => buildTimeline(messages, executions), [messages, executions]);
    // Merge streaming items (real-time node events) into the timeline
    const timeline = useMemo(() => [...baseTimeline, ...streamingItems], [baseTimeline, streamingItems]);

    useEffect(() => {
        if (timeline.length > prevItemCount.current && !userScrolledUp) {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
        prevItemCount.current = timeline.length;
    }, [timeline.length, userScrolledUp]);

    // Detect user scroll position
    const handleScroll = useCallback(() => {
        const el = timelineRef.current;
        if (!el) return;
        const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
        setUserScrolledUp(!atBottom);
    }, []);

    const scrollToBottom = () => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        setUserScrolledUp(false);
    };

    // Check if the latest execution failed
    const latestError = useMemo(() => {
        const failed = executions.filter(e => e.completion_status === 'fail');
        if (failed.length === 0) return null;
        const last = failed[failed.length - 1];
        let result: any = last.result;
        if (typeof result === 'string') {
            try { result = JSON.parse(result); } catch { return 'Execution failed'; }
        }
        // Try to extract error from node results
        const nodeResults = result?.node_results;
        if (nodeResults) {
            for (const node of Object.values(nodeResults) as any[]) {
                if (node?.status === 'failed' && node?.error) {
                    return `${node.action}: ${node.error}`;
                }
            }
        }
        return 'Execution failed';
    }, [executions]);

    if (loading) {
        return (
            <Container>
                <div className="loading-container">
                    <Icon name="spinner" spin size="2em" style={{ color: "rgba(255,255,255,0.2)" }} />
                </div>
            </Container>
        );
    }

    return (
        <Container>
            <div className="agent-session-view">
                <div className="agent-session-header">
                    <button
                        className="agent-action-btn"
                        onClick={() => navigate(`/agent/${id}`)}
                        style={{ padding: "6px 12px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", borderRadius: 8, color: "rgba(255,255,255,0.6)", cursor: "pointer" }}
                    >
                        <Icon name="arrow-left" />
                    </button>
                    <Icon name="robot" style={{ color: '#c084fc' }} />
                    <h1>Session</h1>
                    {session && (
                        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.35)" }}>
                            {dayjs.utc(session.started_at).local().format("D MMM YYYY HH:mm")}
                            {session.status === 'active' && <span style={{ color: '#00aa9c', marginLeft: 8 }}>● Active</span>}
                            {session.status === 'crashed' && <span style={{ color: '#f44336', marginLeft: 8 }}>● Crashed</span>}
                            {session.status === 'ended' && <span style={{ color: 'rgba(255,255,255,0.3)', marginLeft: 8 }}>● Ended</span>}
                        </span>
                    )}
                </div>

                {timeline.length === 0 && !hasRunningExecution && (
                    <div className="session-empty">No activity in this session yet.</div>
                )}

                <div className="message-timeline" ref={timelineRef} onScroll={handleScroll}>
                    {timeline.map((item, idx) => {
                        if (item.type === 'message' && item.message) {
                            const msg = item.message;
                            return (
                                <div key={`msg-${msg.id}`} className={`message-bubble ${msg.direction}`}>
                                    <div>{msg.content}</div>
                                    <div className="message-meta">
                                        {msg.sender && <span className="message-sender">{msg.sender}</span>}
                                        <span>{msg.channel_type}</span>
                                        <span>{dayjs.utc(msg.created_at).local().format("HH:mm:ss")}</span>
                                    </div>
                                </div>
                            );
                        }

                        if (item.type === 'action') {
                            const statusIcon = item.actionStatus === 'success' ? "check"
                                : item.actionStatus === 'failed' ? "xmark"
                                : "clock";
                            const statusClass = item.actionStatus === 'success' ? 'action-success'
                                : item.actionStatus === 'failed' ? 'action-failed'
                                : 'action-pending';

                            if (item.isOutbound && item.outboundContent) {
                                const channelIcon = getChannelIcon(item.actionType || '');
                                const channelName = getChannelName(item.actionType || '');

                                return (
                                    <div key={`action-${idx}`} className="message-bubble outbound">
                                        <div>{item.outboundContent}</div>
                                        <div className="message-meta">
                                            <span className="message-sender">
                                                <Icon name={channelIcon} style={{ marginRight: 4 }} />
                                                {channelName}
                                            </span>
                                            {item.actionDuration != null && item.actionDuration > 0 && (
                                                <span className="message-duration">{item.actionDuration}ms</span>
                                            )}
                                            <span>{dayjs.utc(item.timestamp).local().format("HH:mm:ss")}</span>
                                            <Icon name={statusIcon} style={{ fontSize: 10 }} className={statusClass === 'action-success' ? 'meta-success' : statusClass === 'action-failed' ? 'meta-failed' : ''} />
                                        </div>
                                    </div>
                                );
                            }

                            return (
                                <div key={`action-${idx}`} className={`action-step ${statusClass}`}>
                                    <div className="action-step-icon">
                                        <Icon name="gear" />
                                    </div>
                                    <div className="action-step-content">
                                        <span className="action-step-label">
                                            {formatActionName(item.actionType || item.actionLabel || '')}
                                        </span>
                                        {item.actionDuration != null && item.actionDuration > 0 && (
                                            <span className="action-step-duration">{item.actionDuration}ms</span>
                                        )}
                                    </div>
                                    <div className="action-step-status">
                                        <Icon name={statusIcon} />
                                    </div>
                                </div>
                            );
                        }

                        return null;
                    })}

                    {/* Running execution spinner */}
                    {hasRunningExecution && (
                        <div className="action-step action-running">
                            <div className="action-step-icon">
                                <Icon name="spinner" spin />
                            </div>
                            <div className="action-step-content">
                                <span className="action-step-label">Processing...</span>
                            </div>
                        </div>
                    )}

                    {/* Latest error banner */}
                    {latestError && (
                        <div className="session-error">
                            <Icon name="exclamation-triangle" />
                            <span>{latestError}</span>
                        </div>
                    )}

                    <div ref={bottomRef} />
                </div>

                {/* Scroll to bottom button */}
                {userScrolledUp && (
                    <button className="scroll-to-bottom" onClick={scrollToBottom}>
                        <Icon name="arrow-down" />
                    </button>
                )}
            </div>
        </Container>
    );
}
