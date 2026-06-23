import type {Route} from "../+types/home";
import Container from "~/components/container";
import useConfig from "~/components/config";
import api from "~/lib/api";
import {useEffect, useState, useCallback, useRef} from "react";
import type {Agent, AgentChannel, AgentSession, AgentState, Flo} from "~/types";
import useCookieToken from "~/components/cookie";
import {useParams, useNavigate} from "react-router";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";
import AgentMemoryPanel from "./memory-panel";
import AgentUsersPanel from "./users-panel";
import AgentAuditPanel from "./audit-panel";
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

type Tab = 'config' | 'schedules' | 'sessions' | 'state' | 'memory' | 'plans' | 'users' | 'audit';


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
    const [aiApiKey, setAiApiKey] = useState('');
    const [maxConcurrent, setMaxConcurrent] = useState(3);
    const [idleTimeout, setIdleTimeout] = useState(3600);
    const [priorConversationCount, setPriorConversationCount] = useState(5);
    const [maxPerHour, setMaxPerHour] = useState(100);
    const [requiresApproval, setRequiresApproval] = useState(false);
    const [channels, setChannels] = useState<AgentChannel[]>([]);
    const [orchestratorFlowId, setOrchestratorFlowId] = useState<string>('');
    const [availableFlows, setAvailableFlows] = useState<Flo[]>([]);
    const [flowSearch, setFlowSearch] = useState('');
    const [showFlowDropdown, setShowFlowDropdown] = useState(false);
    const [needsRestart, setNeedsRestart] = useState(false);
    const [idCopied, setIdCopied] = useState(false);
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
                    setAiApiKey(a.ai_api_key || '');
                    setMaxConcurrent(a.max_concurrent_executions);
                    setIdleTimeout(a.idle_timeout_seconds);
                    // Default 5 matches the API column default — only
                    // override when the agent row explicitly set a value.
                    setPriorConversationCount(typeof a.prior_conversation_count === 'number' ? a.prior_conversation_count : 5);
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
            ai_api_key: aiApiKey || null,
            max_concurrent_executions: maxConcurrent,
            idle_timeout_seconds: idleTimeout,
            prior_conversation_count: priorConversationCount,
            max_executions_per_hour: maxPerHour,
            requires_approval: requiresApproval,
            channels: channels,
            orchestrator_flow_id: orchestratorFlowId || null,
        }, { headers })
            .then(() => {
                loadAgent();
                if (agent?.status === 'running') {
                    setNeedsRestart(true);
                }
            })
            .catch(error => console.error(error))
            .finally(() => setSaving(false));
    };

    const handleStart = () => {
        api.post(baseUrl + '/start', {}, { headers })
            .then(() => { loadAgent(); setNeedsRestart(false); })
            .catch(error => console.error(error));
    };

    const handleStop = () => {
        api.post(baseUrl + '/stop', {}, { headers })
            .then(() => { loadAgent(); setNeedsRestart(false); })
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
                <ProtectedRoute permission={PERMISSIONS.AGENT_VIEW}>
                <div className="loading-container">
                    <Icon name="spinner" spin size="2em" style={{ color: "rgba(255,255,255,0.2)" }} />
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
                        <Icon name="robot" style={{ color: '#c084fc', fontSize: 20 }} />
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
                        <button className="agent-action-btn delete" onClick={handleDelete} title="Delete agent">
                            <Icon name="trash" />
                        </button>
                    </div>
                </div>

                {needsRestart && (
                    <div style={{
                        background: 'rgba(245,158,11,0.1)',
                        border: '1px solid rgba(245,158,11,0.3)',
                        borderRadius: 8,
                        padding: '10px 16px',
                        marginBottom: 16,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: 13,
                        color: 'rgba(245,158,11,0.9)',
                    }}>
                        <span>
                            <Icon name="exclamation-triangle" style={{ marginRight: 8 }} />
                            Agent must be restarted for changes to take effect.
                        </span>
                        <button
                            style={{
                                background: 'rgba(245,158,11,0.15)',
                                border: '1px solid rgba(245,158,11,0.3)',
                                borderRadius: 6,
                                padding: '4px 12px',
                                cursor: 'pointer',
                                color: 'rgba(245,158,11,0.9)',
                                fontSize: 12,
                            }}
                            onClick={() => { handleStop(); setTimeout(handleStart, 2000); }}
                        >
                            Restart now
                        </button>
                    </div>
                )}

                <div className="agent-tabs">
                    <button className={`agent-tab ${activeTab === 'config' ? 'active' : ''}`} onClick={() => setActiveTab('config')}>Configuration</button>
                    <button className={`agent-tab ${activeTab === 'schedules' ? 'active' : ''}`} onClick={() => setActiveTab('schedules')}>Schedules</button>
                    <button className={`agent-tab ${activeTab === 'sessions' ? 'active' : ''}`} onClick={() => setActiveTab('sessions')}>Sessions</button>
                    <button className={`agent-tab ${activeTab === 'state' ? 'active' : ''}`} onClick={() => setActiveTab('state')}>State</button>
                    <button className={`agent-tab ${activeTab === 'memory' ? 'active' : ''}`} onClick={() => setActiveTab('memory')}>Memory</button>
                    <button className={`agent-tab ${activeTab === 'plans' ? 'active' : ''}`} onClick={() => setActiveTab('plans')}>Plans</button>
                    <button className={`agent-tab ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>Users</button>
                    <button className={`agent-tab ${activeTab === 'audit' ? 'active' : ''}`} onClick={() => setActiveTab('audit')}>Audit Log</button>
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

                        <div className="agent-form-group">
                            <label className="agent-form-label">AI API Key</label>
                            <input
                                className="agent-form-input"
                                type="password"
                                value={aiApiKey}
                                onChange={e => setAiApiKey(e.target.value)}
                                placeholder="sk-ant-..."
                            />
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 4, display: 'block' }}>
                                Anthropic API key used by the agent's memory extraction pipeline. Required for automatic memory, commitment, and preference detection.
                            </span>
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
                                <label className="agent-form-label" title="Number of past conversation summaries surfaced to the agent on every inbound message. Each summary carries a conversation_id the agent can pass to the get_conversation tool to fetch the full history. 0 disables the feature.">Prior Conversations</label>
                                <input className="agent-form-input" type="number" value={priorConversationCount} onChange={e => setPriorConversationCount(Math.max(0, Math.min(50, parseInt(e.target.value) || 0)))} min={0} max={50} />
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
                            {saving ? <Icon name="spinner" spin /> : 'Save Changes'}
                        </button>
                    </div>
                )}


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

                {activeTab === 'memory' && id && (
                    <AgentMemoryPanel agentId={id} apiUrl={config("AUTOMATE_API_URL")} token={token} />
                )}

                {activeTab === 'plans' && id && (
                    <AgentPlansPanel agentId={id} apiUrl={config("AUTOMATE_API_URL")} token={token} />
                )}

                {activeTab === 'users' && id && (
                    <AgentUsersPanel agentId={id} apiUrl={config("AUTOMATE_API_URL")} token={token} />
                )}

                {activeTab === 'audit' && id && (
                    <AgentAuditPanel agentId={id} apiUrl={config("AUTOMATE_API_URL")} token={token} />
                )}
            </div>
            </ProtectedRoute>
        </Container>
    );
}
