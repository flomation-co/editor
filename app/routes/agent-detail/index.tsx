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
import "./index.css";
import { Icon } from "~/components/icons/Icon";

dayjs.extend(relativeTime);
dayjs.extend(utc);

export function meta({}: Route.MetaArgs) {
    return [
        { title: "Flomation - Agent" },
        { name: "description", content: "Configure agent" },
    ];
}

type Tab = 'config' | 'channels' | 'sessions' | 'state';

type EmailAccount = { email: string; label?: string; purpose: string };

function AgentEmailChannel({ agentId, config }: { agentId: string; config: (key: string, fallback?: string) => string }) {
    const [accounts, setAccounts] = useState<EmailAccount[]>([]);
    const [authURLs, setAuthURLs] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);

    const apiUrl = config("AUTOMATE_API_URL");
    // Use the trigger_google_account endpoints with agent ID as the scope key.
    // This reuses the same infrastructure — trigger_id is just TEXT, works with agent IDs too.

    const fetchAccounts = useCallback(() => {
        if (!agentId || !apiUrl) { setLoading(false); return; }
        setLoading(true);
        fetch(`${apiUrl}/api/v1/internal/trigger/${agentId}/google-accounts`)
            .then(res => res.json())
            .then(data => {
                setAccounts(data.accounts || []);
                setAuthURLs(data.auth_urls || {});
            })
            .catch(() => { setAccounts([]); setAuthURLs({}); })
            .finally(() => setLoading(false));
    }, [agentId, apiUrl]);

    useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

    const openOAuth = (purpose: string) => {
        const launchUrl = config("LAUNCH_URL", "");
        if (!launchUrl) return;
        const url = `${launchUrl}/auth/google/trigger/${agentId}?purpose=${purpose}`;
        const popup = window.open(url, "google-oauth", "width=500,height=700,scrollbars=yes");
        if (popup) {
            const timer = setInterval(() => {
                if (popup.closed) {
                    clearInterval(timer);
                    setTimeout(() => fetchAccounts(), 1000);
                }
            }, 500);
        }
    };

    const removeAccount = (email: string, purpose: string) => {
        if (!agentId || !apiUrl) return;
        fetch(`${apiUrl}/api/v1/internal/trigger/${agentId}/google-account/${encodeURIComponent(email)}?purpose=${purpose}`, { method: "DELETE" })
            .then(() => fetchAccounts())
            .catch(console.error);
    };

    return (
        <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label className="agent-form-label" style={{ margin: 0 }}>Connected Gmail Accounts</label>
                <button
                    type="button"
                    onClick={fetchAccounts}
                    style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: 4 }}
                    title="Refresh"
                >
                    <Icon name="refresh" />
                </button>
            </div>

            {loading ? (
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, padding: '8px 0' }}>Loading...</div>
            ) : accounts.length === 0 ? (
                <div style={{
                    textAlign: 'center', padding: '14px 8px', color: 'rgba(255,255,255,0.3)', fontSize: 12,
                    background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)',
                    borderRadius: 6, marginBottom: 10,
                }}>
                    No Gmail accounts connected. Add one below to enable email triggers.
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                    {accounts.map((acct, i) => (
                        <div key={`${acct.email}-${acct.purpose}-${i}`} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '8px 10px', background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, fontSize: 12,
                        }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                                <span style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>{acct.email}</span>
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                    {acct.label && <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>{acct.label}</span>}
                                    <span style={{
                                        color: '#00aa9c', fontSize: 10, background: 'rgba(0,170,156,0.1)',
                                        padding: '1px 5px', borderRadius: 3,
                                    }}>
                                        {acct.purpose === 'email_read' ? 'read' : acct.purpose === 'email_send' ? 'send' : acct.purpose}
                                    </span>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => removeAccount(acct.email, acct.purpose)}
                                style={{
                                    background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)',
                                    cursor: 'pointer', padding: 4, fontSize: 12,
                                }}
                                title="Remove"
                            >
                                <Icon name="trash" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <div style={{ display: 'flex', gap: 6 }}>
                <button
                    type="button"
                    onClick={() => openOAuth('email_read')}
                    style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        padding: '7px 10px', background: 'rgba(0,170,156,0.08)',
                        border: '1px solid rgba(0,170,156,0.2)', borderRadius: 6,
                        color: '#00aa9c', fontSize: 12, cursor: 'pointer',
                    }}
                >
                    <Icon name="plus" /> Read Access
                </button>
                <button
                    type="button"
                    onClick={() => openOAuth('email_send')}
                    style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        padding: '7px 10px', background: 'rgba(0,170,156,0.08)',
                        border: '1px solid rgba(0,170,156,0.2)', borderRadius: 6,
                        color: '#00aa9c', fontSize: 12, cursor: 'pointer',
                    }}
                >
                    <Icon name="plus" /> Send Access
                </button>
            </div>

            <div className="agent-form-group" style={{ marginTop: 12, marginBottom: 0 }}>
                <label className="agent-form-label">Gmail Search Filter (optional)</label>
                <input
                    className="agent-form-input"
                    placeholder="is:unread from:support@example.com"
                    style={{ fontSize: 12 }}
                />
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 4, display: 'block' }}>
                    Only trigger on emails matching this Gmail search query. Leave empty for all new emails.
                </span>
            </div>
        </div>
    );
}

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
    const [maxPerHour, setMaxPerHour] = useState(100);
    const [requiresApproval, setRequiresApproval] = useState(false);
    const [channels, setChannels] = useState<AgentChannel[]>([]);
    const [orchestratorFlowId, setOrchestratorFlowId] = useState<string>('');
    const [availableFlows, setAvailableFlows] = useState<Flo[]>([]);
    const [flowSearch, setFlowSearch] = useState('');
    const [showFlowDropdown, setShowFlowDropdown] = useState(false);
    const [needsRestart, setNeedsRestart] = useState(false);
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
                    setAiApiKey(a.ai_api_key || '');
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
            ai_api_key: aiApiKey || null,
            max_concurrent_executions: maxConcurrent,
            idle_timeout_seconds: idleTimeout,
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
                <div className="loading-container">
                    <Icon name="spinner" spin size="2em" style={{ color: "rgba(255,255,255,0.2)" }} />
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

                {activeTab === 'channels' && (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>
                                Communication channels for this agent
                            </span>
                            <button className="create-agent-btn" style={{ marginTop: 0, padding: '6px 14px', fontSize: 12 }}
                                onClick={() => setChannels([...channels, { type: 'telegram', config: { bot_token: '' } }])}>
                                <Icon name="plus" /> Add Channel
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
                                            {ch.type === 'telegram' && <Icon name="telegram" style={{ color: '#229ED9', fontSize: 18 }} />}
                                            {ch.type === 'slack' && <Icon name="slack" style={{ color: '#E01E5A', fontSize: 18 }} />}
                                            {ch.type === 'email' && <Icon name="envelope" style={{ color: '#EA4335', fontSize: 16 }} />}
                                            {ch.type === 'webhook' && <Icon name="robot" style={{ color: 'rgba(255,255,255,0.4)', fontSize: 16 }} />}
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
                                            <Icon name="times" />
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
                                                        <Icon name={urlCopied? "check" : "copy"} />
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
                                        <AgentEmailChannel agentId={id || ''} config={config} />
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
                                {saving ? <Icon name="spinner" spin /> : 'Save Channels'}
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
