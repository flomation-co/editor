import type {Route} from "../+types/home";
import Container from "~/components/container";
import useConfig from "~/components/config";
import api from "~/lib/api";
import {useEffect, useState} from "react";
import type {Agent, AgentChannel} from "~/types";
import useCookieToken from "~/components/cookie";
import {useNavigate} from "react-router";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";
import "./index.css";
import { Icon } from "~/components/icons/Icon";
import ProtectedRoute from "~/components/protected-route";
import {PERMISSIONS} from "~/types";

dayjs.extend(relativeTime);
dayjs.extend(utc);

export function meta({}: Route.MetaArgs) {
    return [
        { title: "Flomation - Agents" },
        { name: "description", content: "Manage autonomous agents" },
    ];
}

const CHANNEL_ICONS: Record<string, any> = {
    telegram: "telegram",
    slack: "slack",
    email: "envelope",
    webhook: "globe",
    facebook_messenger: "facebook",
};

function ChannelIcon({ type }: { type: string }) {
    return (
        <div className="agent-channel-icon" title={type}>
            <Icon name={CHANNEL_ICONS[type] || "comment"} />
        </div>
    );
}

const STATUS_LABELS: Record<string, string> = {
    running: "Running",
    stopped: "Stopped",
    paused: "Paused",
    error: "Error",
};

export default function Agents() {
    const token = useCookieToken();
    const config = useConfig();
    const navigate = useNavigate();
    const url = config("AUTOMATE_API_URL") + '/api/v1/agent';

    const [agents, setAgents] = useState<Agent[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    const queryAgents = () => {
        setLoading(true);
        api.get(url, {
            headers: { Authorization: "Bearer " + token }
        })
            .then(response => {
                if (response?.data) {
                    const sorted = [...response.data].sort((a: Agent, b: Agent) => a.name.localeCompare(b.name));
                    setAgents(sorted);
                }
            })
            .catch(error => console.error(error))
            .finally(() => setLoading(false));
    };

    useEffect(() => { queryAgents(); }, []);

    const handleCreateAgent = () => {
        api.post(url, { name: "New Agent" }, {
            headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }
        })
            .then(response => {
                if (response?.data?.id) {
                    navigate(`/agent/${response.data.id}`);
                }
            })
            .catch(error => console.error(error));
    };

    return (
        <Container>
            <ProtectedRoute permission={PERMISSIONS.AGENT_VIEW}>
            <div className="header">Agents</div>
            <div className="agents-action-bar">
                <button className="create-agent-btn" onClick={handleCreateAgent}>
                    <Icon name="plus" /> New Agent
                </button>
            </div>

            {loading && (
                <div className="loading-container">
                    <Icon name="spinner" spin size="2em" style={{ color: "rgba(255,255,255,0.2)" }} />
                </div>
            )}

            {!loading && agents.length === 0 && (
                <div className="agents-empty">
                    <div className="agents-empty-icon">
                        <Icon name="robot" />
                    </div>
                    <div className="agents-empty-title">No Agents Yet</div>
                    <div className="agents-empty-subtitle">
                        Create an agent to autonomously receive messages, process tasks, and interact with your flows.
                    </div>
                    <button className="create-agent-btn" onClick={handleCreateAgent}>
                        <Icon name="plus" /> Create Your First Agent
                    </button>
                </div>
            )}

            {!loading && agents.length > 0 && (
                <div className="agents-list">
                    {agents.map(agent => (
                        <div
                            key={agent.id}
                            className="agent-card"
                            onClick={() => navigate(`/agent/${agent.id}`)}
                        >
                            <div className={`agent-card-indicator agent-card-indicator--${agent.status}`} />
                            <div className="agent-card-info">
                                <div className="agent-card-name">
                                    <Icon name="robot" className="agent-card-icon" />
                                    {agent.name}
                                </div>
                                {agent.description && (
                                    <div className="agent-card-description">{agent.description}</div>
                                )}
                                <div className="agent-card-details">
                                    <div className="agent-channels">
                                        {(agent.channels || []).map((ch: AgentChannel, i: number) => (
                                            <ChannelIcon key={i} type={ch.type} />
                                        ))}
                                        {(!agent.channels || agent.channels.length === 0) && (
                                            <span>No channels</span>
                                        )}
                                    </div>
                                    <span><Icon name="comment" /> {agent.message_count || 0} messages</span>
                                    <span><Icon name="bolt" /> {agent.execution_count || 0} executions</span>
                                    {agent.orchestrator_flow_name && (
                                        <span><Icon name="diagram-project" /> {agent.orchestrator_flow_name}</span>
                                    )}
                                </div>
                            </div>
                            <div className="agent-card-meta">
                                <span className={`agent-card-badge agent-card-badge--${agent.status}`}>
                                    {STATUS_LABELS[agent.status] || agent.status}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            </ProtectedRoute>
        </Container>
    );
}
