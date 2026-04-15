import {useState, useEffect, useCallback} from "react";
import type {AgentUser, AgentIdentity, AgentMemory} from "~/types";
import api from "~/lib/api";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";

dayjs.extend(relativeTime);
dayjs.extend(utc);

type Props = {
    agentId: string;
    apiUrl: string;
    token: string;
};

const CHANNEL_ICONS: Record<string, {label: string; colour: string}> = {
    telegram: {label: "Telegram", colour: "#229ED9"},
    slack: {label: "Slack", colour: "#E01E5A"},
    email: {label: "Email", colour: "#EA4335"},
    webhook: {label: "Webhook", colour: "rgba(255,255,255,0.4)"},
};

export default function AgentUsersPanel({agentId, apiUrl, token}: Props) {
    const [users, setUsers] = useState<AgentUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState<string | null>(null);
    const [identities, setIdentities] = useState<AgentIdentity[]>([]);
    const [memories, setMemories] = useState<AgentMemory[]>([]);
    const [loadingDetail, setLoadingDetail] = useState(false);

    const headers = {Authorization: "Bearer " + token, "Content-Type": "application/json"};

    const loadUsers = useCallback(() => {
        if (!agentId || !apiUrl) return;
        setLoading(true);
        api.get(`${apiUrl}/api/v1/agent/${agentId}/users?limit=100`, {headers})
            .then(res => {
                if (res?.data) setUsers(res.data);
            })
            .catch(() => setUsers([]))
            .finally(() => setLoading(false));
    }, [agentId, apiUrl, token]);

    useEffect(() => {
        loadUsers();
    }, [loadUsers]);

    const loadUserDetail = useCallback((userId: string) => {
        setLoadingDetail(true);
        setSelectedUser(userId);

        // Load identities and memories in parallel.
        Promise.all([
            api.get(`${apiUrl}/api/v1/internal/agent/${agentId}/identity?agent_user_id=${userId}`).catch(() => ({data: []})),
            api.get(`${apiUrl}/api/v1/internal/agent/${agentId}/memory?agent_user_id=${userId}&limit=50`).catch(() => ({data: []})),
        ]).then(([identRes, memRes]) => {
            setIdentities(identRes?.data || []);
            setMemories(memRes?.data || []);
        }).finally(() => setLoadingDetail(false));
    }, [agentId, apiUrl]);

    if (loading) {
        return <div className="agent-empty-state">Loading users...</div>;
    }

    return (
        <div>
            <div className="memory-count">{users.length} user{users.length === 1 ? '' : 's'}</div>

            {users.length === 0 && (
                <div className="agent-empty-state">No users yet. Users appear when they interact with this agent.</div>
            )}

            <div className="agent-users-list">
                {users.map(user => (
                    <div key={user.id}>
                        <div
                            className={`agent-user-item ${selectedUser === user.id ? 'active' : ''}`}
                            onClick={() => selectedUser === user.id ? setSelectedUser(null) : loadUserDetail(user.id)}
                        >
                            <div className="user-item-left">
                                <span className="user-display-name">{user.display_name || "Unknown"}</span>
                            </div>
                            <div className="user-item-right">
                                <span className="memory-date">{dayjs.utc(user.created_at).fromNow()}</span>
                            </div>
                        </div>

                        {selectedUser === user.id && (
                            <div className="user-detail-panel">
                                {loadingDetail ? (
                                    <div className="agent-empty-state">Loading...</div>
                                ) : (
                                    <>
                                        <div className="user-detail-section">
                                            <h4 className="user-detail-heading">Identities</h4>
                                            {identities.length === 0 && (
                                                <div className="user-detail-empty">No identities linked</div>
                                            )}
                                            {identities.map(id => {
                                                const ch = CHANNEL_ICONS[id.channel_type] || {label: id.channel_type, colour: "rgba(255,255,255,0.4)"};
                                                return (
                                                    <div key={id.id} className="identity-item">
                                                        <span className="identity-channel" style={{color: ch.colour}}>{ch.label}</span>
                                                        <span className="identity-external">{id.channel_external_id}</span>
                                                        {id.verified && <span className="identity-verified">Verified</span>}
                                                        <span className="memory-date">{dayjs.utc(id.created_at).fromNow()}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <div className="user-detail-section">
                                            <h4 className="user-detail-heading">Memories ({memories.length})</h4>
                                            {memories.length === 0 && (
                                                <div className="user-detail-empty">No memories</div>
                                            )}
                                            {memories.slice(0, 20).map(mem => (
                                                <div key={mem.id} className="user-memory-item">
                                                    <span className="user-memory-title">{mem.title}</span>
                                                    <span className="user-memory-type">{mem.memory_type}</span>
                                                    {mem.pinned && <span className="memory-pin-badge">Pinned</span>}
                                                </div>
                                            ))}
                                            {memories.length > 20 && (
                                                <div className="user-detail-empty">...and {memories.length - 20} more</div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
