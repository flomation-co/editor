import type {Route} from "../+types/home";
import Container from "~/components/container";
import useConfig from "~/components/config";
import api from "~/lib/api";
import {useEffect, useState, useCallback} from "react";
import type {Agent, AgentSession} from "~/types";
import useCookieToken from "~/components/cookie";
import {useParams, useNavigate} from "react-router";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";
import AgentMemoryPanel from "./memory-panel";
import AgentUsersPanel from "./users-panel";
import AgentSchedulePanel from "./schedule-panel";
import AgentPlansPanel from "./plans-panel";
import "./index.css";
import { Icon } from "~/components/icons/Icon";
import ProtectedRoute from "~/components/protected-route";
import {PERMISSIONS} from "~/types";

dayjs.extend(relativeTime);
dayjs.extend(utc);

export function meta({}: Route.MetaArgs) {
    return [
        { title: "Flomation - Agent" },
        { name: "description", content: "Configure agent" },
    ];
}

type Tab = 'sessions' | 'memory' | 'plans' | 'schedules' | 'users';


export default function AgentDetail() {
    const { id } = useParams();
    const token = useCookieToken();
    const config = useConfig();
    const navigate = useNavigate();
    const baseUrl = config("AUTOMATE_API_URL") + `/api/v1/agent/${id}`;

    const [agent, setAgent] = useState<Agent | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<Tab>('sessions');
    const [sessions, setSessions] = useState<AgentSession[]>([]);
    const [idCopied, setIdCopied] = useState(false);

    const headers = { Authorization: "Bearer " + token, "Content-Type": "application/json" };

    const loadAgent = useCallback(() => {
        setLoading(true);
        api.get(baseUrl, { headers })
            .then(response => {
                if (response?.data) {
                    const a = response.data as Agent;
                    setAgent(a);
                }
            })
            .catch(error => console.error(error))
            .finally(() => setLoading(false));
    }, [id]);

    const loadSessions = useCallback(() => {
        api.get(baseUrl + '/session?limit=20', { headers })
            .then(response => { if (response?.data) setSessions(response.data); })
            .catch(() => {});
    }, [id]);

    useEffect(() => { loadAgent(); }, [loadAgent]);

    useEffect(() => {
        if (activeTab === 'sessions') loadSessions();
    }, [activeTab]);

    const handleStart = () => {
        api.post(baseUrl + '/start', {}, { headers })
            .then(() => loadAgent())
            .catch(error => console.error(error));
    };

    const handleStop = () => {
        api.post(baseUrl + '/stop', {}, { headers })
            .then(() => loadAgent())
            .catch(error => console.error(error));
    };

    const handlePause = () => {
        api.post(baseUrl + '/pause', {}, { headers })
            .then(() => loadAgent())
            .catch(error => console.error(error));
    };

    if (loading) {
        return (
            <Container>
                <ProtectedRoute permission={PERMISSIONS.AGENT_VIEW}>
                <div className="loading-container">
                    <Icon name="spinner" spin size="2em" style={{ color: "var(--faint)" }} />
                </div>
                </ProtectedRoute>
            </Container>
        );
    }

    if (!agent) {
        return (
            <Container>
                <ProtectedRoute permission={PERMISSIONS.AGENT_VIEW}>
                <div className="agent-empty-state">Agent not found.</div>
                </ProtectedRoute>
            </Container>
        );
    }

    return (
        <Container>
            <ProtectedRoute permission={PERMISSIONS.AGENT_VIEW}>
            <div className="agent-detail">
                <div className="agent-detail-header">
                    <div className="agent-detail-title">
                        <button className="agent-action-btn" onClick={() => navigate('/agent')} title="Back to agents">
                            <Icon name="arrow-left" />
                        </button>
                        <Icon name="robot" style={{ color: 'var(--lilac)', fontSize: 20 }} />
                        <div>
                            <h1>{agent.name}</h1>
                            <div className="agent-id-row">
                                <span className="agent-id-value">{agent.id}</span>
                                <button
                                    className="agent-id-copy"
                                    onClick={() => {
                                        navigator.clipboard.writeText(agent.id);
                                        setIdCopied(true);
                                        setTimeout(() => setIdCopied(false), 2000);
                                    }}
                                    title="Copy Agent ID"
                                >
                                    <Icon name={idCopied? "check" : "copy"} />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="agent-detail-actions">
                        {(agent.status === 'stopped' || agent.status === 'error') && (
                            <button className="agent-action-btn start" onClick={handleStart}>
                                <Icon name="play" /> Start
                            </button>
                        )}
                        {agent.status === 'running' && (
                            <>
                                <button className="agent-action-btn pause" onClick={handlePause}>
                                    <Icon name="pause" /> Pause
                                </button>
                                <button className="agent-action-btn stop" onClick={handleStop}>
                                    <Icon name="stop" /> Stop
                                </button>
                            </>
                        )}
                        {agent.status === 'paused' && (
                            <>
                                <button className="agent-action-btn start" onClick={handleStart}>
                                    <Icon name="play" /> Resume
                                </button>
                                <button className="agent-action-btn stop" onClick={handleStop}>
                                    <Icon name="stop" /> Stop
                                </button>
                            </>
                        )}
                        {agent.orchestrator_flow_id && (
                            <button
                                className="agent-action-btn"
                                onClick={() => navigate(`/flo/${agent.orchestrator_flow_id}`)}
                                title={agent.orchestrator_flow_name || 'Open the orchestrator flow'}
                            >
                                <Icon name="diagram-project" /> Flow
                            </button>
                        )}
                        <button className="agent-action-btn" onClick={() => navigate(`/agent/${id}/settings`)} title="Agent settings">
                            <Icon name="gear" /> Settings
                        </button>
                    </div>
                </div>

                <div className="agent-tabs">
                    <button className={`agent-tab ${activeTab === 'sessions' ? 'active' : ''}`} onClick={() => setActiveTab('sessions')}>Sessions</button>
                    <button className={`agent-tab ${activeTab === 'memory' ? 'active' : ''}`} onClick={() => setActiveTab('memory')}>Memory</button>
                    <button className={`agent-tab ${activeTab === 'plans' ? 'active' : ''}`} onClick={() => setActiveTab('plans')}>Plans</button>
                    <button className={`agent-tab ${activeTab === 'schedules' ? 'active' : ''}`} onClick={() => setActiveTab('schedules')}>Schedules</button>
                    <button className={`agent-tab ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>Users</button>
                </div>

                {activeTab === 'schedules' && (
                    <AgentSchedulePanel baseUrl={baseUrl} headers={headers} />
                )}

                {activeTab === 'sessions' && (
                    <div>
                        {sessions.length === 0 && (
                            <div className="agent-empty-state">No sessions yet. Start the agent to create a session.</div>
                        )}
                        <div className="agent-sessions-list">
                            {sessions.map(session => (
                                <div
                                    key={session.id}
                                    className="agent-session-item"
                                    onClick={() => navigate(`/agent/${id}/session/${session.id}`)}
                                >
                                    <div className="agent-session-info">
                                        <div className="agent-session-time">
                                            {dayjs.utc(session.started_at).local().format("D MMM YYYY HH:mm")}
                                            {session.ended_at && ` — ${dayjs.utc(session.ended_at).local().format("HH:mm")}`}
                                        </div>
                                        <div className="agent-session-stats">
                                            <span>{session.message_count || 0} messages</span>
                                            <span>{session.execution_count || 0} executions</span>
                                            {session.status === 'active' && <span style={{ color: 'var(--teal)' }}>Active</span>}
                                            {session.status === 'crashed' && <span style={{ color: 'var(--danger)' }}>Crashed</span>}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'memory' && id && (
                    <AgentMemoryPanel agentId={id} apiUrl={config("AUTOMATE_API_URL")} token={token} />
                )}

                {activeTab === 'plans' && id && (
                    <AgentPlansPanel agentId={id} apiUrl={config("AUTOMATE_API_URL")} token={token} />
                )}

                {activeTab === 'users' && id && (
                    <AgentUsersPanel agentId={id} apiUrl={config("AUTOMATE_API_URL")} token={token} />
                )}

            </div>
            </ProtectedRoute>
        </Container>
    );
}
