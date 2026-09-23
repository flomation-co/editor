import type {Route} from "../+types/home";
import Container from "~/components/container";
import useConfig from "~/components/config";
import api from "~/lib/api";
import {useEffect, useState, useCallback, useRef} from "react";
import CodeArea from "~/components/codeArea";
import {fileToAvatarDataURL} from "~/lib/avatar";
import type {Agent, AgentChannel, Flo} from "~/types";
import useCookieToken from "~/components/cookie";
import {useParams, useNavigate} from "react-router";
import AgentAuditPanel from "../agent-detail/audit-panel";
import "../agent-detail/index.css";
import { Icon } from "~/components/icons/Icon";
import ProtectedRoute from "~/components/protected-route";
import {PERMISSIONS} from "~/types";

export function meta({}: Route.MetaArgs) {
    return [
        { title: "Flomation - Agent Settings" },
        { name: "description", content: "Configure agent" },
    ];
}

type Tab = 'config' | 'audit';

// Providers the extraction flow can be built against. Each maps to an
// executor ai/<value> action, so a new entry needs that action to exist.
const EXTRACTION_PROVIDERS = [
    { value: 'anthropic', label: 'Anthropic' },
    { value: 'openai', label: 'OpenAI' },
    { value: 'gemini', label: 'Google Gemini' },
    { value: 'groq', label: 'Groq' },
    { value: 'openrouter', label: 'OpenRouter' },
];

const PROVIDER_KEY_HINT: Record<string, string> = {
    anthropic: 'sk-ant-...',
    openai: 'sk-...',
    gemini: 'AIza...',
    groq: 'gsk_...',
    openrouter: 'sk-or-...',
};

export default function AgentSettings() {
    const { id } = useParams();
    const token = useCookieToken();
    const config = useConfig();
    const navigate = useNavigate();
    const baseUrl = config("AUTOMATE_API_URL") + `/api/v1/agent/${id}`;

    const [agent, setAgent] = useState<Agent | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<Tab>('config');
    const [saving, setSaving] = useState(false);

    // Form state
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [systemPrompt, setSystemPrompt] = useState('');
    const [aiApiKey, setAiApiKey] = useState('');
    const [extractionProvider, setExtractionProvider] = useState('anthropic');
    const [idleTimeout, setIdleTimeout] = useState(3600);
    const [priorConversationCount, setPriorConversationCount] = useState(5);
    const [channels, setChannels] = useState<AgentChannel[]>([]);
    const [orchestratorFlowId, setOrchestratorFlowId] = useState<string>('');
    const [availableFlows, setAvailableFlows] = useState<Flo[]>([]);
    const [flowSearch, setFlowSearch] = useState('');
    const [showFlowDropdown, setShowFlowDropdown] = useState(false);
    const [needsRestart, setNeedsRestart] = useState(false);
    const [avatar, setAvatar] = useState<string>('');
    const [avatarError, setAvatarError] = useState<string>('');
    const [creatingFlow, setCreatingFlow] = useState(false);
    const flowDropdownRef = useRef<HTMLDivElement>(null);
    const avatarInputRef = useRef<HTMLInputElement>(null);

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
                    setAvatar(a.avatar || '');
                    setAiApiKey(a.ai_api_key || '');
                    setExtractionProvider(a.extraction_provider || 'anthropic');
                    setIdleTimeout(a.idle_timeout_seconds);
                    // Default 5 matches the API column default — only
                    // override when the agent row explicitly set a value.
                    setPriorConversationCount(typeof a.prior_conversation_count === 'number' ? a.prior_conversation_count : 5);
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

    useEffect(() => { loadAgent(); loadFlows(); }, [loadAgent]);

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
            avatar: avatar || null,
            ai_api_key: aiApiKey || null,
            extraction_provider: extractionProvider,
            idle_timeout_seconds: idleTimeout,
            prior_conversation_count: priorConversationCount,
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

    const handleAvatarChange = async (file: File | undefined) => {
        if (!file) return;
        setAvatarError('');
        try {
            setAvatar(await fileToAvatarDataURL(file));
        } catch (error: any) {
            setAvatarError(error?.message || 'That image could not be used.');
        }
    };

    // An agent needs a flow to act on, and making one first then coming
    // back to wire it up is a detour nobody wants. A blank flow created
    // here is immediately selected, so the agent is complete and the
    // flow can be built later.
    const handleCreateBlankFlow = () => {
        setCreatingFlow(true);
        api.post(flowsUrl, { name: `${name || 'Agent'} Orchestrator` }, { headers })
            .then(response => {
                const created = response?.data;
                if (created?.id) {
                    setOrchestratorFlowId(created.id);
                    setShowFlowDropdown(false);
                    loadFlows();
                }
            })
            .catch(error => console.error(error))
            .finally(() => setCreatingFlow(false));
    };

    const handleRestart = () => {
        api.post(baseUrl + '/stop', {}, { headers })
            .then(() => {
                setTimeout(() => {
                    api.post(baseUrl + '/start', {}, { headers })
                        .then(() => { loadAgent(); setNeedsRestart(false); })
                        .catch(error => console.error(error));
                }, 2000);
            })
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
                <ProtectedRoute permission={PERMISSIONS.AGENT_EDIT}>
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
                <ProtectedRoute permission={PERMISSIONS.AGENT_EDIT}>
                <div className="agent-empty-state">Agent not found.</div>
                </ProtectedRoute>
            </Container>
        );
    }

    return (
        <Container>
            <ProtectedRoute permission={PERMISSIONS.AGENT_EDIT}>
            <div className="agent-detail">
                <div className="agent-detail-header">
                    <div className="agent-detail-title">
                        <button className="agent-action-btn" onClick={() => navigate(`/agent/${id}`)} title="Back to agent">
                            <Icon name="arrow-left" />
                        </button>
                        <Icon name="gear" style={{ color: 'var(--lilac)', fontSize: 20 }} />
                        <div>
                            <h1>Settings</h1>
                            <div className="agent-id-row">
                                <span className="agent-id-value">{agent.name}</span>
                            </div>
                        </div>
                    </div>

                    <div className="agent-detail-actions">
                        <button className="agent-action-btn delete" onClick={handleDelete} title="Delete agent">
                            <Icon name="trash" /> Delete
                        </button>
                    </div>
                </div>

                {needsRestart && (
                    <div className="agent-restart-banner">
                        <span>
                            <Icon name="exclamation-triangle" style={{ marginRight: 8 }} />
                            Agent must be restarted for changes to take effect.
                        </span>
                        <button className="agent-restart-btn" onClick={handleRestart}>
                            Restart now
                        </button>
                    </div>
                )}

                <div className="agent-tabs">
                    <button className={`agent-tab ${activeTab === 'config' ? 'active' : ''}`} onClick={() => setActiveTab('config')}>Configuration</button>
                    <button className={`agent-tab ${activeTab === 'audit' ? 'active' : ''}`} onClick={() => setActiveTab('audit')}>Audit Log</button>
                </div>

                {activeTab === 'config' && (
                    <div>
                        <div className="agent-form-group">
                            <label className="agent-form-label">Avatar</label>
                            <div className="agent-avatar-row">
                                <div className="agent-avatar-preview">
                                    {avatar
                                        ? <img src={avatar} alt="" />
                                        : <Icon name="robot" />}
                                </div>
                                <div className="agent-avatar-actions">
                                    <input
                                        ref={avatarInputRef}
                                        type="file"
                                        accept="image/png,image/jpeg,image/gif,image/webp"
                                        style={{ display: 'none' }}
                                        onChange={e => {
                                            handleAvatarChange(e.target.files?.[0]);
                                            e.target.value = '';
                                        }}
                                    />
                                    <button
                                        type="button"
                                        className="agent-action-btn"
                                        onClick={() => avatarInputRef.current?.click()}
                                    >
                                        <Icon name="cloud-arrow-up" /> {avatar ? 'Replace' : 'Upload'}
                                    </button>
                                    {avatar && (
                                        <button
                                            type="button"
                                            className="agent-action-btn"
                                            onClick={() => { setAvatar(''); setAvatarError(''); }}
                                        >
                                            Remove
                                        </button>
                                    )}
                                    <span className="agent-avatar-hint">
                                        {avatarError || 'PNG, JPEG, GIF or WebP. Cropped square and scaled down for you.'}
                                    </span>
                                </div>
                            </div>
                        </div>

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
                                            className="flow-autocomplete-option flow-autocomplete-option--create"
                                            onClick={handleCreateBlankFlow}
                                        >
                                            <Icon name={creatingFlow ? 'spinner' : 'plus'} spin={creatingFlow} />
                                            Create a new blank flow
                                        </div>
                                        <div
                                            className={`flow-autocomplete-option ${!orchestratorFlowId ? 'flow-autocomplete-option--selected' : ''}`}
                                            onClick={() => { setOrchestratorFlowId(''); setShowFlowDropdown(false); }}
                                        >
                                            <span style={{ color: 'var(--faint)', fontStyle: 'italic' }}>None — no flow triggered on messages</span>
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
                            <span style={{ fontSize: 12, color: 'var(--faint)', marginTop: 4, display: 'block' }}>
                                This flow will be triggered each time the agent receives a message.
                            </span>
                        </div>

                        <div className="agent-form-group">
                            <label className="agent-form-label">System Prompt</label>
                            <CodeArea
                                value={systemPrompt}
                                onChange={setSystemPrompt}
                                placeholder="Instructions for the agent..."
                                rows={22}
                            />
                        </div>

                        <div className="agent-form-row">
                            <div className="agent-form-group">
                                <label className="agent-form-label">Extraction Provider</label>
                                <select
                                    className="agent-form-input"
                                    value={extractionProvider}
                                    onChange={e => setExtractionProvider(e.target.value)}
                                >
                                    {EXTRACTION_PROVIDERS.map(p => (
                                        <option key={p.value} value={p.value}>{p.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="agent-form-group">
                                <label className="agent-form-label">Extraction API Key</label>
                                <input
                                    className="agent-form-input"
                                    type="password"
                                    value={aiApiKey}
                                    onChange={e => setAiApiKey(e.target.value)}
                                    placeholder={PROVIDER_KEY_HINT[extractionProvider] || ''}
                                />
                            </div>
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--faint)', marginTop: -8, marginBottom: 16, display: 'block' }}>
                            Runs the agent's memory extraction pipeline, which detects memories, commitments and preferences. Changing the provider rebuilds the extraction flow.
                        </span>

                        <div className="agent-form-row">
                            <div className="agent-form-group">
                                <label className="agent-form-label">Idle Timeout (seconds)</label>
                                <input className="agent-form-input" type="number" value={idleTimeout} onChange={e => setIdleTimeout(parseInt(e.target.value) || 0)} min={0} />
                            </div>
                            <div className="agent-form-group">
                                <label className="agent-form-label" title="Number of past conversation summaries surfaced to the agent on every inbound message. Each summary carries a conversation_id the agent can pass to the get_conversation tool to fetch the full history. 0 disables the feature.">Prior Conversations</label>
                                <input className="agent-form-input" type="number" value={priorConversationCount} onChange={e => setPriorConversationCount(Math.max(0, Math.min(50, parseInt(e.target.value) || 0)))} min={0} max={50} />
                            </div>
                        </div>

                        <button className="agent-save-btn" onClick={handleSave} disabled={saving}>
                            {saving ? <Icon name="spinner" spin /> : 'Save Changes'}
                        </button>
                    </div>
                )}

                {activeTab === 'audit' && id && (
                    <AgentAuditPanel agentId={id} apiUrl={config("AUTOMATE_API_URL")} token={token} />
                )}
            </div>
            </ProtectedRoute>
        </Container>
    );
}
