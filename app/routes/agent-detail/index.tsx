import type {Route} from "../+types/home";
import Container from "~/components/container";
import useConfig from "~/components/config";
import api from "~/lib/api";
import {useEffect, useState, useCallback, useRef} from "react";
import type {Agent, AgentChannel, AgentSession, AgentState, Flo} from "~/types";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faSpinner, faPlay, faStop, faPause, faRobot, faArrowLeft, faTrash, faPlus, faTimes, faCopy, faCheck} from "@fortawesome/free-solid-svg-icons";
import {faTelegram, faSlack} from "@fortawesome/free-brands-svg-icons";
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

type Tab = 'config' | 'channels' | 'sessions' | 'state';

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
    const [channels, setChannels] = useState<AgentChannel[]>([]);
    const [orchestratorFlowId, setOrchestratorFlowId] = useState<string>('');
    const [availableFlows, setAvailableFlows] = useState<Flo[]>([]);
    const [flowSearch, setFlowSearch] = useState('');
    const [showFlowDropdown, setShowFlowDropdown] = useState(false);
    const [idCopied, setIdCopied] = useState(false);
    const [urlCopied, setUrlCopied] = useState(false);
    const flowDropdownRef = useRef<HTMLDivElement>(null);

    const headers = { Authorization: "Bearer " + token, "Content-Type": "application/json" };
    const flowsUrl = config("AUTOMATE_API_URL") + '/api/v1/flo';

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
                    setChannels(a.channels || []);
                    setOrchestratorFlowId(a.orchestrator_flow_id || '');
                }
            })
            .catch(error => console.error(error))
            .finally(() => setLoading(false));
    }, [id]);

    const loadFlows = useCallback(() => {
        api.get(flowsUrl, { headers })
            .then(response => { if (response?.data) setAvailableFlows(response.data); })
            .catch(() => {});
    }, []);

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

    useEffect(() => { loadAgent(); loadFlows(); }, [loadAgent]);

    useEffect(() => {
        if (activeTab === 'sessions') loadSessions();
        if (activeTab === 'state') loadState();
    }, [activeTab]);

    // Close flow dropdown when clicking outside
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (flowDropdownRef.current && !flowDropdownRef.current.contains(e.target as Node)) {
                setShowFlowDropdown(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const selectedFlow = availableFlows.find(f => f.id === orchestratorFlowId);
    const sortedFlows = [...availableFlows].sort((a, b) => a.name.localeCompare(b.name));
    const filteredFlows = sortedFlows.filter(f =>
        f.name.toLowerCase().includes(flowSearch.toLowerCase())
    );

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
            channels: channels,
            orchestrator_flow_id: orchestratorFlowId || null,
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

    const handleDelete = () => {
        if (!confirm(`Are you sure you want to delete "${agent?.name}"? This cannot be undone.`)) return;
        api.delete(baseUrl, { headers })
            .then(() => navigate('/agent'))
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
                                    <FontAwesomeIcon icon={idCopied ? faCheck : faCopy} />
                                </button>
                            </div>
                        </div>
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
                        <button className="agent-action-btn delete" onClick={handleDelete} title="Delete agent">
                            <FontAwesomeIcon icon={faTrash} />
                        </button>
                    </div>
                </div>

                <div className="agent-tabs">
                    <button className={`agent-tab ${activeTab === 'config' ? 'active' : ''}`} onClick={() => setActiveTab('config')}>Configuration</button>
                    <button className={`agent-tab ${activeTab === 'channels' ? 'active' : ''}`} onClick={() => setActiveTab('channels')}>Channels</button>
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

                        <div className="agent-form-group" ref={flowDropdownRef}>
                            <label className="agent-form-label">Orchestrator Flow</label>
                            <div className="flow-autocomplete">
                                <input
                                    className="agent-form-input"
                                    value={showFlowDropdown ? flowSearch : (selectedFlow?.name || '')}
                                    onChange={e => { setFlowSearch(e.target.value); setShowFlowDropdown(true); }}
                                    onFocus={() => { setFlowSearch(''); setShowFlowDropdown(true); }}
                                    placeholder="Search flows..."
                                />
                                {showFlowDropdown && (
                                    <div className="flow-autocomplete-dropdown">
                                        <div
                                            className={`flow-autocomplete-option ${!orchestratorFlowId ? 'flow-autocomplete-option--selected' : ''}`}
                                            onClick={() => { setOrchestratorFlowId(''); setShowFlowDropdown(false); }}
                                        >
                                            <span style={{ color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>None — no flow triggered on messages</span>
                                        </div>
                                        {filteredFlows.map(f => (
                                            <div
                                                key={f.id}
                                                className={`flow-autocomplete-option ${orchestratorFlowId === f.id ? 'flow-autocomplete-option--selected' : ''}`}
                                                onClick={() => { setOrchestratorFlowId(f.id); setShowFlowDropdown(false); }}
                                            >
                                                <div className="flow-autocomplete-dot" />
                                                {f.name}
                                            </div>
                                        ))}
                                        {filteredFlows.length === 0 && (
                                            <div className="flow-autocomplete-empty">No flows found</div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 4, display: 'block' }}>
                                This flow will be triggered each time the agent receives a message.
                            </span>
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

                {activeTab === 'channels' && (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>
                                Communication channels for this agent
                            </span>
                            <button className="create-agent-btn" style={{ marginTop: 0, padding: '6px 14px', fontSize: 12 }}
                                onClick={() => setChannels([...channels, { type: 'telegram', config: { bot_token: '' } }])}>
                                <FontAwesomeIcon icon={faPlus} /> Add Channel
                            </button>
                        </div>

                        {channels.length === 0 && (
                            <div className="agent-empty-state">
                                No channels configured. Add a channel to allow your agent to receive messages.
                            </div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {channels.map((ch, idx) => (
                                <div key={idx} className="agent-channel-card">
                                    <div className="agent-channel-card-header">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            {ch.type === 'telegram' && <FontAwesomeIcon icon={faTelegram} style={{ color: '#229ED9', fontSize: 18 }} />}
                                            {ch.type === 'slack' && <FontAwesomeIcon icon={faSlack} style={{ color: '#E01E5A', fontSize: 18 }} />}
                                            {(ch.type === 'webhook' || ch.type === 'email') && <FontAwesomeIcon icon={faRobot} style={{ color: 'rgba(255,255,255,0.4)', fontSize: 16 }} />}
                                            <select
                                                className="agent-form-input"
                                                style={{ width: 'auto', padding: '4px 10px' }}
                                                value={ch.type}
                                                onChange={e => {
                                                    const updated = [...channels];
                                                    updated[idx] = { type: e.target.value as AgentChannel['type'], config: {} };
                                                    setChannels(updated);
                                                }}
                                            >
                                                <option value="telegram">Telegram</option>
                                                <option value="slack">Slack</option>
                                                <option value="email">Email</option>
                                                <option value="webhook">Webhook</option>
                                            </select>
                                        </div>
                                        <button className="agent-action-btn delete" style={{ padding: '4px 8px' }}
                                            onClick={() => setChannels(channels.filter((_, i) => i !== idx))}>
                                            <FontAwesomeIcon icon={faTimes} />
                                        </button>
                                    </div>

                                    {ch.type === 'telegram' && (
                                        <div style={{ marginTop: 12 }}>
                                            <div className="agent-form-group" style={{ marginBottom: 12 }}>
                                                <label className="agent-form-label">Bot Token</label>
                                                <input
                                                    className="agent-form-input"
                                                    type="password"
                                                    value={ch.config?.bot_token || ''}
                                                    onChange={e => {
                                                        const updated = [...channels];
                                                        updated[idx] = { ...ch, config: { ...ch.config, bot_token: e.target.value } };
                                                        setChannels(updated);
                                                    }}
                                                    placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                                                />
                                            </div>
                                            <div className="agent-form-group" style={{ marginBottom: 0 }}>
                                                <label className="agent-form-label">Allowed Chat IDs (optional, comma-separated)</label>
                                                <input
                                                    className="agent-form-input"
                                                    value={ch.config?.allowed_chat_ids?.join(', ') || ''}
                                                    onChange={e => {
                                                        const updated = [...channels];
                                                        const ids = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                                                        updated[idx] = { ...ch, config: { ...ch.config, allowed_chat_ids: ids } };
                                                        setChannels(updated);
                                                    }}
                                                    placeholder="12345678, -100987654"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {ch.type === 'slack' && (
                                        <div style={{ marginTop: 12 }}>
                                            <div className="agent-form-group" style={{ marginBottom: 12 }}>
                                                <label className="agent-form-label">Bot Token</label>
                                                <input
                                                    className="agent-form-input"
                                                    type="password"
                                                    value={ch.config?.bot_token || ''}
                                                    onChange={e => {
                                                        const updated = [...channels];
                                                        updated[idx] = { ...ch, config: { ...ch.config, bot_token: e.target.value } };
                                                        setChannels(updated);
                                                    }}
                                                    placeholder="xoxb-..."
                                                />
                                            </div>
                                            <div className="agent-form-group" style={{ marginBottom: 12 }}>
                                                <label className="agent-form-label">Signing Secret (optional, for request verification)</label>
                                                <input
                                                    className="agent-form-input"
                                                    type="password"
                                                    value={ch.config?.signing_secret || ''}
                                                    onChange={e => {
                                                        const updated = [...channels];
                                                        updated[idx] = { ...ch, config: { ...ch.config, signing_secret: e.target.value } };
                                                        setChannels(updated);
                                                    }}
                                                    placeholder="Slack App signing secret"
                                                />
                                            </div>
                                            <div className="agent-form-group" style={{ marginBottom: 12 }}>
                                                <label className="agent-form-label">Events API Request URL</label>
                                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                    <input
                                                        className="agent-form-input"
                                                        readOnly
                                                        value={`${config("LAUNCH_URL", "https://your-launch-instance")}/webhook/slack/${id}`}
                                                        style={{ color: 'rgba(255,255,255,0.5)', cursor: 'text', flex: 1 }}
                                                    />
                                                    <button
                                                        type="button"
                                                        style={{
                                                            background: 'rgba(255,255,255,0.06)',
                                                            border: '1px solid rgba(255,255,255,0.1)',
                                                            borderRadius: 6,
                                                            padding: '8px 10px',
                                                            cursor: 'pointer',
                                                            color: urlCopied ? '#00aa9c' : 'rgba(255,255,255,0.5)',
                                                            fontSize: 13,
                                                            transition: 'color 0.2s',
                                                        }}
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(
                                                                `${config("LAUNCH_URL", "https://your-launch-instance")}/webhook/slack/${id}`
                                                            );
                                                            setUrlCopied(true);
                                                            setTimeout(() => setUrlCopied(false), 2000);
                                                        }}
                                                    >
                                                        <FontAwesomeIcon icon={urlCopied ? faCheck : faCopy} />
                                                    </button>
                                                </div>
                                                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 4, display: 'block' }}>
                                                    Paste this URL in your Slack App's <strong>Event Subscriptions → Request URL</strong>.
                                                </span>
                                            </div>
                                            <div className="agent-form-group" style={{ marginBottom: 0 }}>
                                                <label className="agent-form-label" style={{ marginBottom: 6 }}>Slack App Setup Guide</label>
                                                <div style={{
                                                    fontSize: 12,
                                                    color: 'rgba(255,255,255,0.4)',
                                                    lineHeight: 1.6,
                                                    background: 'rgba(255,255,255,0.02)',
                                                    border: '1px solid rgba(255,255,255,0.06)',
                                                    borderRadius: 8,
                                                    padding: '10px 14px',
                                                }}>
                                                    <div style={{ marginBottom: 8 }}>
                                                        <strong style={{ color: 'rgba(255,255,255,0.6)' }}>Event Subscriptions</strong>
                                                        <div style={{ marginTop: 4 }}>
                                                            Subscribe to these bot events:
                                                        </div>
                                                        <div style={{ marginTop: 2, fontFamily: "'Courier New', monospace", fontSize: 11 }}>
                                                            message.channels · message.groups · message.im · message.mpim · app_mention
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <strong style={{ color: 'rgba(255,255,255,0.6)' }}>Bot Token Scopes</strong>
                                                        <div style={{ marginTop: 4 }}>
                                                            Required OAuth scopes under <em>OAuth &amp; Permissions</em>:
                                                        </div>
                                                        <div style={{ marginTop: 2, fontFamily: "'Courier New', monospace", fontSize: 11 }}>
                                                            chat:write · users:read · app_mentions:read · channels:history · groups:history · im:history · mpim:history
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {ch.type === 'email' && (
                                        <div style={{ marginTop: 12, color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>
                                            Email channel configuration will be available in a future update.
                                        </div>
                                    )}

                                    {ch.type === 'webhook' && (
                                        <div style={{ marginTop: 12 }}>
                                            <div className="agent-form-group" style={{ marginBottom: 0 }}>
                                                <label className="agent-form-label">Webhook URL</label>
                                                <input
                                                    className="agent-form-input"
                                                    readOnly
                                                    value={`${config("LAUNCH_URL", "https://your-launch-instance")}/webhook/agent/${id}`}
                                                    style={{ color: 'rgba(255,255,255,0.5)', cursor: 'text' }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {channels.length > 0 && (
                            <button className="agent-save-btn" onClick={handleSave} disabled={saving} style={{ marginTop: 16 }}>
                                {saving ? <FontAwesomeIcon icon={faSpinner} spin /> : 'Save Channels'}
                            </button>
                        )}
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
