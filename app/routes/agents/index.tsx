import type {Route} from "../+types/home";
import Container from "~/components/container";
import type {HelpContent} from "~/components/helpPane";
import useConfig from "~/components/config";
import api from "~/lib/api";
import {useEffect, useState} from "react";
import type {Agent} from "~/types";
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

const STATUS_LABELS: Record<string, string> = {
    running: "Running",
    stopped: "Stopped",
    paused: "Paused",
    error: "Error",
};

const AGENTS_HELP: HelpContent = {
    title: "About Agents",
    intro: "Agents are AI assistants that chat on your channels, like Slack or Telegram, and run your flows to get real work done.",
    points: [
        "Create an agent and give it a personality and instructions",
        "Connect the channels it should listen and reply on",
        "Point it at a flow that decides what it can do",
        "Follow its conversations and memory as it works",
    ],
    tip: "An agent needs a flow to act on. Build that flow first, then link it when you set the agent up.",
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

    // A new agent gets a blank orchestrator flow of its own. An agent
    // without one does nothing when it receives a message, and making
    // the flow first then coming back to wire it up is a detour that
    // taught nobody anything.
    const handleCreateAgent = async () => {
        const headers = { Authorization: "Bearer " + token, "Content-Type": "application/json" };
        const name = "New Agent";
        try {
            let orchestratorFlowId: string | null = null;
            try {
                const flow = await api.post(
                    config("AUTOMATE_API_URL") + '/api/v1/flo',
                    { name: `${name} Orchestrator` },
                    { headers },
                );
                orchestratorFlowId = flow?.data?.id || null;
            } catch (error) {
                // A flow we could not create is not worth losing the
                // agent over — it can be chosen or created in settings.
                console.error(error);
            }

            const response = await api.post(url, {
                name,
                ...(orchestratorFlowId ? { orchestrator_flow_id: orchestratorFlowId } : {}),
            }, { headers });

            if (response?.data?.id) {
                // A new agent has nothing to look at yet — no sessions,
                // no memory, no plans. Settings is where the work is.
                navigate(`/agent/${response.data.id}/settings`);
            }
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <Container help={AGENTS_HELP}>
            <ProtectedRoute permission={PERMISSIONS.AGENT_VIEW}>
            <div className="header">Agents</div>
            <div className="agents-action-bar">
                <button className="create-agent-btn" onClick={handleCreateAgent}>
                    <Icon name="plus" /> New Agent
                </button>
            </div>

            {loading && (
                <div className="loading-container">
                    <Icon name="spinner" spin size="2em" style={{ color: "var(--faint)" }} />
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
                            <div className="agent-card-avatar">
                                {agent.avatar
                                    ? <img src={agent.avatar} alt="" />
                                    : <Icon name="robot" />}
                            </div>
                            <div className="agent-card-info">
                                <div className="agent-card-name">{agent.name}</div>
                                {agent.description && (
                                    <div className="agent-card-description">{agent.description}</div>
                                )}
                                {agent.orchestrator_flow_name && (
                                    <div className="agent-card-details">
                                        {/* Stop propagation so opening the flow does not
                                            also open the agent behind it. */}
                                        <a
                                            className="agent-card-flow"
                                            href={`/flo/${agent.orchestrator_flow_id}`}
                                            onClick={e => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                navigate(`/flo/${agent.orchestrator_flow_id}`);
                                            }}
                                        >
                                            <Icon name="diagram-project" /> {agent.orchestrator_flow_name}
                                        </a>
                                    </div>
                                )}
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
