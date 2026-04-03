import type {Route} from "../+types/home";
import Container from "~/components/container";
import useConfig from "~/components/config";
import api from "~/lib/api";
import {useEffect, useState} from "react";
import type {Agent, AgentChannel} from "~/types";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faSpinner, faRobot, faPlus, faEnvelope, faComment, faGlobe} from "@fortawesome/free-solid-svg-icons";
import {faTelegram} from "@fortawesome/free-brands-svg-icons";
import useCookieToken from "~/components/cookie";
import {useNavigate} from "react-router";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";
import "./index.css";

dayjs.extend(relativeTime);
dayjs.extend(utc);

export function meta({}: Route.MetaArgs) {
    return [
        { title: "Flomation - Agents" },
        { name: "description", content: "Manage autonomous agents" },
    ];
}

const CHANNEL_ICONS: Record<string, any> = {
    telegram: faTelegram,
    email: faEnvelope,
    webhook: faGlobe,
};

function ChannelIcon({ type }: { type: string }) {
    return (
        <div className="agent-channel-icon" title={type}>
            <FontAwesomeIcon icon={CHANNEL_ICONS[type] || faComment} />
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const labels: Record<string, string> = {
        running: "Running",
        stopped: "Stopped",
        paused: "Paused",
        error: "Error",
    };
    return (
        <span className={`agent-status-badge ${status}`}>
            <span className="agent-status-dot" />
            {labels[status] || status}
        </span>
    );
}

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
                if (response?.data) setAgents(response.data);
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
            <div className="header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Agents</span>
                <div className="agents-header-actions">
                    <button className="create-agent-btn" onClick={handleCreateAgent}>
                        <FontAwesomeIcon icon={faPlus} /> New Agent
                    </button>
                </div>
            </div>

            {loading && (
                <div className="loading-container">
                    <FontAwesomeIcon icon={faSpinner} spin size="2x" style={{ color: "rgba(255,255,255,0.2)" }} />
                </div>
            )}

            {!loading && agents.length === 0 && (
                <div className="agents-empty">
                    <div className="agents-empty-icon">
                        <FontAwesomeIcon icon={faRobot} />
                    </div>
                    <div className="agents-empty-title">No Agents Yet</div>
                    <div className="agents-empty-subtitle">
                        Create an agent to autonomously receive messages, process tasks, and interact with your flows.
                    </div>
                    <button className="create-agent-btn" onClick={handleCreateAgent}>
                        <FontAwesomeIcon icon={faPlus} /> Create Your First Agent
                    </button>
                </div>
            )}

            {!loading && agents.length > 0 && (
                <div className="agents-grid">
                    {agents.map(agent => (
                        <div
                            key={agent.id}
                            className="agent-card"
                            onClick={() => navigate(`/agent/${agent.id}`)}
                        >
                            <div className="agent-card-header">
                                <span className="agent-card-name">{agent.name}</span>
                                <StatusBadge status={agent.status} />
                            </div>

                            {agent.description && (
                                <div className="agent-card-description">{agent.description}</div>
                            )}

                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div className="agent-channels">
                                    {(agent.channels || []).map((ch: AgentChannel, i: number) => (
                                        <ChannelIcon key={i} type={ch.type} />
                                    ))}
                                    {(!agent.channels || agent.channels.length === 0) && (
                                        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.25)" }}>No channels</span>
                                    )}
                                </div>

                                <div className="agent-card-stats">
                                    <span className="agent-card-stat">
                                        <FontAwesomeIcon icon={faComment} />
                                        {agent.message_count || 0}
                                    </span>
                                    <span className="agent-card-stat">
                                        <FontAwesomeIcon icon={faRobot} />
                                        {agent.execution_count || 0}
                                    </span>
                                </div>
                            </div>

                            {agent.orchestrator_flow_name && (
                                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
                                    Flow: {agent.orchestrator_flow_name}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </Container>
    );
}
