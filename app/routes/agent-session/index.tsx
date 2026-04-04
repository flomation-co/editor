import type {Route} from "../+types/home";
import Container from "~/components/container";
import useConfig from "~/components/config";
import api from "~/lib/api";
import {useEffect, useState, useCallback, useMemo} from "react";
import type {AgentSession, AgentMessage, Execution} from "~/types";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faSpinner, faArrowLeft, faRobot, faGear, faPaperPlane, faCheck, faXmark, faClock} from "@fortawesome/free-solid-svg-icons";
import useCookieToken from "~/components/cookie";
import {useParams, useNavigate, Link} from "react-router";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import "./index.css";

dayjs.extend(utc);

export function meta({}: Route.MetaArgs) {
    return [
        { title: "Flomation - Agent Session" },
        { name: "description", content: "Agent session activity" },
    ];
}

// Unified timeline item — either a message or an execution action step
type TimelineItem = {
    type: 'message' | 'action' | 'execution-start' | 'execution-end';
    timestamp: string;
    // Message fields
    message?: AgentMessage;
    // Action fields
    actionLabel?: string;
    actionType?: string;
    actionStatus?: string;
    actionDuration?: number;
    isOutbound?: boolean; // true for actions that send messages (messaging/*)
    outboundContent?: string; // the message text sent by outbound actions
    executionId?: string;
};

function buildTimeline(messages: AgentMessage[], executions: Execution[]): TimelineItem[] {
    const items: TimelineItem[] = [];

    // Add messages
    for (const msg of messages) {
        items.push({
            type: 'message',
            timestamp: msg.created_at,
            message: msg,
        });
    }

    // Add execution action steps from node_results
    for (const exec of executions) {
        if (!exec.result) return items;

        let result: any = exec.result;
        if (typeof result === 'string') {
            try { result = JSON.parse(result); } catch { continue; }
        }

        const nodeResults = result?.node_results;
        if (!nodeResults || typeof nodeResults !== 'object') continue;

        for (const [, node] of Object.entries(nodeResults) as [string, any][]) {
            if (!node || !node.action) continue;

            // Skip trigger nodes — they're implicit from the message
            if (node.action.startsWith('trigger/')) continue;

            const isOutbound = node.action.startsWith('messaging/') ||
                node.action === 'agent/send_message' ||
                node.action.startsWith('output/slack') ||
                node.action.startsWith('output/discord');

            // Extract outbound message content from inputs
            let outboundContent: string | undefined;
            if (isOutbound && node.inputs) {
                outboundContent = node.inputs['message'] || node.inputs['content'] || node.inputs['text'];
            }

            // Estimate action time from execution start + duration offset
            const actionTime = exec.created_at;

            items.push({
                type: 'action',
                timestamp: actionTime,
                actionLabel: node.label || node.action,
                actionType: node.action,
                actionStatus: node.status,
                actionDuration: node.duration_ms,
                isOutbound,
                outboundContent,
                executionId: exec.id,
            });
        }
    }

    // Sort chronologically
    items.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return items;
}

function formatActionName(action: string): string {
    // "messaging/telegram" → "Telegram", "common/sleep" → "Sleep"
    const parts = action.split('/');
    const last = parts[parts.length - 1];
    return last.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
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

    const headers = { Authorization: "Bearer " + token };

    const loadSession = useCallback(() => {
        setLoading(true);
        api.get(`${baseUrl}/session/${sessionId}?limit=200`, { headers })
            .then(response => {
                if (response?.data) {
                    setSession(response.data.session);
                    setMessages(response.data.messages || []);
                    setExecutions(response.data.executions || []);
                }
            })
            .catch(error => console.error(error))
            .finally(() => setLoading(false));
    }, [id, sessionId]);

    useEffect(() => { loadSession(); }, [loadSession]);

    const timeline = useMemo(() => buildTimeline(messages, executions), [messages, executions]);

    if (loading) {
        return (
            <Container>
                <div className="loading-container">
                    <FontAwesomeIcon icon={faSpinner} spin size="2x" style={{ color: "rgba(255,255,255,0.2)" }} />
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
                        <FontAwesomeIcon icon={faArrowLeft} />
                    </button>
                    <FontAwesomeIcon icon={faRobot} style={{ color: '#c084fc' }} />
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

                {timeline.length === 0 && (
                    <div className="session-empty">No activity in this session yet.</div>
                )}

                <div className="message-timeline">
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
                            const statusIcon = item.actionStatus === 'success' ? faCheck
                                : item.actionStatus === 'failed' ? faXmark
                                : faClock;
                            const statusClass = item.actionStatus === 'success' ? 'action-success'
                                : item.actionStatus === 'failed' ? 'action-failed'
                                : 'action-pending';

                            // Outbound messaging actions with content → show as reply bubble
                            if (item.isOutbound && item.outboundContent) {
                                return (
                                    <div key={`action-${idx}`} className="action-reply-group">
                                        <div className={`action-step ${statusClass} action-outbound`}>
                                            <div className="action-step-icon">
                                                <FontAwesomeIcon icon={faPaperPlane} />
                                            </div>
                                            <div className="action-step-content">
                                                <span className="action-step-label">
                                                    {formatActionName(item.actionType || '')}
                                                </span>
                                                {item.actionDuration != null && item.actionDuration > 0 && (
                                                    <span className="action-step-duration">{item.actionDuration}ms</span>
                                                )}
                                            </div>
                                            <div className="action-step-status">
                                                <FontAwesomeIcon icon={statusIcon} />
                                            </div>
                                        </div>
                                        <div className="message-bubble outbound">
                                            <div>{item.outboundContent}</div>
                                            <div className="message-meta">
                                                <span className="message-sender">Agent</span>
                                                <span>{dayjs.utc(item.timestamp).local().format("HH:mm:ss")}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            }

                            // Non-messaging actions → centred pill
                            return (
                                <div key={`action-${idx}`} className={`action-step ${statusClass} ${item.isOutbound ? 'action-outbound' : ''}`}>
                                    <div className="action-step-icon">
                                        <FontAwesomeIcon icon={item.isOutbound ? faPaperPlane : faGear} />
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
                                        <FontAwesomeIcon icon={statusIcon} />
                                    </div>
                                </div>
                            );
                        }

                        return null;
                    })}
                </div>
            </div>
        </Container>
    );
}
