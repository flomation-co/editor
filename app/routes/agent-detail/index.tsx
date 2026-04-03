import type {Route} from "../+types/home";
import Container from "~/components/container";
import useConfig from "~/components/config";
import api from "~/lib/api";
import {useEffect, useState, useCallback} from "react";
import type {Agent, AgentSession, AgentState} from "~/types";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faSpinner, faPlay, faStop, faPause, faRobot, faArrowLeft} from "@fortawesome/free-solid-svg-icons";
import useCookieToken from "~/components/cookie";
import {useParams, useNavigate} from "react-router";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";
import "./index.css";

dayjs.extend(relativeTime);
dayjs.extend(utc);

export function meta({}: Route.MetaArgs) {
    return [
        { title: "Flomation - Agent" },
        { name: "description", content: "Configure agent" },
    ];
}

type Tab = 'config' | 'sessions' | 'state';

export default function AgentDetail() {
    const { id } = useParams();
    const token = useCookieToken();
    const config = useConfig();
    const navigate = useNavigate();
    const baseUrl = config("AUTOMATE_API_URL") + `/api/v1/agent/${id}`;

    const [agent, setAgent] = useState<Agent | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<Tab>('config');
    const [sessions, setSessions] = useState<AgentSession[]>([]);
    const [stateEntries, setStateEntries] = useState<AgentState[]>([]);
    const [saving, setSaving] = useState(false);

    // Form state
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [systemPrompt, setSystemPrompt] = useState('');
    const [maxConcurrent, setMaxConcurrent] = useState(3);
    const [idleTimeout, setIdleTimeout] = useState(3600);
    const [maxPerHour, setMaxPerHour] = useState(100);
    const [requiresApproval, setRequiresApproval] = useState(false);

    const headers = { Authorization: "Bearer " + token, "Content-Type": "application/json" };

    const loadAgent = useCallback(() => {
        setLoading(true);
        api.get(baseUrl, { headers })
            .then(response => {
                if (response?.data) {
                    const a = response.data as Agent;
                    setAgent(a);
                    setName(a.name);
                    setDescription(a.description || '');
                    setSystemPrompt(a.system_prompt || '');
                    setMaxConcurrent(a.max_concurrent_executions);
                    setIdleTimeout(a.idle_timeout_seconds);
                    setMaxPerHour(a.max_executions_per_hour);
                    setRequiresApproval(a.requires_approval);
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

    const loadState = useCallback(() => {
        api.get(baseUrl + '/state', { headers })
            .then(response => { if (response?.data) setStateEntries(response.data); })
            .catch(() => {});
    }, [id]);

    useEffect(() => { loadAgent(); }, [loadAgent]);

    useEffect(() => {
        if (activeTab === 'sessions') loadSessions();
        if (activeTab === 'state') loadState();
    }, [activeTab]);

    const handleSave = () => {
        setSaving(true);
        api.post(baseUrl, {
            name,
            description: description || null,
            system_prompt: systemPrompt || null,
            max_concurrent_executions: maxConcurrent,
            idle_timeout_seconds: idleTimeout,
            max_executions_per_hour: maxPerHour,
            requires_approval: requiresApproval,
            channels: agent?.channels || [],
        }, { headers })
            .then(() => loadAgent())
            .catch(error => console.error(error))
            .finally(() => setSaving(false));
    };

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
                <div className="loading-container">
                    <FontAwesomeIcon icon={faSpinner} spin size="2x" style={{ color: "rgba(255,255,255,0.2)" }} />
                </div>
            </Container>
        );
    }

    if (!agent) {
        return (
            <Container>
                <div className="agent-empty-state">Agent not found.</div>
            </Container>
        );
    }

    return (
        <Container>
            <div className="agent-detail">
                <div className="agent-detail-header">
                    <div className="agent-detail-title">
                        <button className="agent-action-btn" onClick={() => navigate('/agent')} title="Back to agents">
                            <FontAwesomeIcon icon={faArrowLeft} />
                        </button>
                        <FontAwesomeIcon icon={faRobot} style={{ color: '#c084fc', fontSize: 20 }} />
                        <h1>{agent.name}</h1>
                    </div>

                    <div className="agent-detail-actions">
                        {(agent.status === 'stopped' || agent.status === 'error') && (
                            <button className="agent-action-btn start" onClick={handleStart}>
                                <FontAwesomeIcon icon={faPlay} /> Start
                            </button>
                        )}
                        {agent.status === 'running' && (
                            <>
                                <button className="agent-action-btn pause" onClick={handlePause}>
                                    <FontAwesomeIcon icon={faPause} /> Pause
                                </button>
                                <button className="agent-action-btn stop" onClick={handleStop}>
                                    <FontAwesomeIcon icon={faStop} /> Stop
                                </button>
                            </>
                        )}
                        {agent.status === 'paused' && (
                            <>
                                <button className="agent-action-btn start" onClick={handleStart}>
                                    <FontAwesomeIcon icon={faPlay} /> Resume
                                </button>
                                <button className="agent-action-btn stop" onClick={handleStop}>
                                    <FontAwesomeIcon icon={faStop} /> Stop
                                </button>
                            </>
                        )}
                    </div>
                </div>

                <div className="agent-tabs">
                    <button className={`agent-tab ${activeTab === 'config' ? 'active' : ''}`} onClick={() => setActiveTab('config')}>Configuration</button>
                    <button className={`agent-tab ${activeTab === 'sessions' ? 'active' : ''}`} onClick={() => setActiveTab('sessions')}>Sessions</button>
                    <button className={`agent-tab ${activeTab === 'state' ? 'active' : ''}`} onClick={() => setActiveTab('state')}>State</button>
                </div>

                {activeTab === 'config' && (
                    <div>
                        <div className="agent-form-group">
                            <label className="agent-form-label">Name</label>
                            <input className="agent-form-input" value={name} onChange={e => setName(e.target.value)} placeholder="Agent name" />
                        </div>

                        <div className="agent-form-group">
                            <label className="agent-form-label">Description</label>
                            <input className="agent-form-input" value={description} onChange={e => setDescription(e.target.value)} placeholder="What does this agent do?" />
                        </div>

                        <div className="agent-form-group">
                            <label className="agent-form-label">System Prompt</label>
                            <textarea className="agent-form-input textarea" value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)} placeholder="Instructions for the agent..." />
                        </div>

                        <div className="agent-form-row">
                            <div className="agent-form-group">
                                <label className="agent-form-label">Max Concurrent Executions</label>
                                <input className="agent-form-input" type="number" value={maxConcurrent} onChange={e => setMaxConcurrent(parseInt(e.target.value) || 1)} min={1} max={50} />
                            </div>
                            <div className="agent-form-group">
                                <label className="agent-form-label">Max Executions per Hour</label>
                                <input className="agent-form-input" type="number" value={maxPerHour} onChange={e => setMaxPerHour(parseInt(e.target.value) || 1)} min={1} />
                            </div>
                        </div>

                        <div className="agent-form-row">
                            <div className="agent-form-group">
                                <label className="agent-form-label">Idle Timeout (seconds)</label>
                                <input className="agent-form-input" type="number" value={idleTimeout} onChange={e => setIdleTimeout(parseInt(e.target.value) || 0)} min={0} />
                            </div>
                            <div className="agent-form-group">
                                <label className="agent-form-label">Require Approval</label>
                                <div className="agent-toggle-row">
                                    <label className="agent-toggle">
                                        <input type="checkbox" checked={requiresApproval} onChange={e => setRequiresApproval(e.target.checked)} />
                                        <span className="agent-toggle-slider"></span>
                                    </label>
                                    <span className="agent-toggle-label">
                                        {requiresApproval ? 'Executions require manual approval' : 'Executions dispatch automatically'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <button className="agent-save-btn" onClick={handleSave} disabled={saving}>
                            {saving ? <FontAwesomeIcon icon={faSpinner} spin /> : 'Save Changes'}
                        </button>
                    </div>
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
                                            {session.status === 'active' && <span style={{ color: '#00aa9c' }}>Active</span>}
                                            {session.status === 'crashed' && <span style={{ color: '#f44336' }}>Crashed</span>}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'state' && (
                    <div>
                        {stateEntries.length === 0 && (
                            <div className="agent-empty-state">No state stored yet. State will appear as the agent runs.</div>
                        )}
                        <div className="agent-state-list">
                            {stateEntries.map(entry => (
                                <div key={entry.state_key} className="agent-state-item">
                                    <span className="agent-state-key">{entry.state_key}</span>
                                    <span className="agent-state-updated">{dayjs.utc(entry.updated_at).fromNow()}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </Container>
    );
}
