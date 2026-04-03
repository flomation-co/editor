import type {Route} from "../+types/home";
import Container from "~/components/container";
import useConfig from "~/components/config";
import api from "~/lib/api";
import {useEffect, useState, useCallback} from "react";
import type {AgentSession, AgentMessage} from "~/types";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faSpinner, faArrowLeft, faRobot} from "@fortawesome/free-solid-svg-icons";
import useCookieToken from "~/components/cookie";
import {useParams, useNavigate} from "react-router";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import "./index.css";

dayjs.extend(utc);

export function meta({}: Route.MetaArgs) {
    return [
        { title: "Flomation - Agent Session" },
        { name: "description", content: "Agent session messages" },
    ];
}

export default function AgentSessionView() {
    const { id, sessionId } = useParams();
    const token = useCookieToken();
    const config = useConfig();
    const navigate = useNavigate();
    const baseUrl = config("AUTOMATE_API_URL") + `/api/v1/agent/${id}`;

    const [session, setSession] = useState<AgentSession | null>(null);
    const [messages, setMessages] = useState<AgentMessage[]>([]);
    const [loading, setLoading] = useState(true);

    const headers = { Authorization: "Bearer " + token };

    const loadSession = useCallback(() => {
        setLoading(true);
        api.get(`${baseUrl}/session/${sessionId}?limit=200`, { headers })
            .then(response => {
                if (response?.data) {
                    setSession(response.data.session);
                    setMessages(response.data.messages || []);
                }
            })
            .catch(error => console.error(error))
            .finally(() => setLoading(false));
    }, [id, sessionId]);

    useEffect(() => { loadSession(); }, [loadSession]);

    // TODO: Phase 3 — add SSE connection for live message updates when session is active

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

                {messages.length === 0 && (
                    <div className="session-empty">No messages in this session yet.</div>
                )}

                <div className="message-timeline">
                    {messages.map(msg => (
                        <div key={msg.id} className={`message-bubble ${msg.direction}`}>
                            <div>{msg.content}</div>
                            <div className="message-meta">
                                {msg.sender && <span className="message-sender">{msg.sender}</span>}
                                <span>{msg.channel_type}</span>
                                <span>{dayjs.utc(msg.created_at).local().format("HH:mm:ss")}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </Container>
    );
}
