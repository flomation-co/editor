import {useState, useEffect, useCallback} from "react";
import type {AgentMemory} from "~/types";
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

const MEMORY_TYPE_LABELS: Record<string, string> = {
    preference: "Preference",
    feedback: "Feedback",
    fact: "Fact",
    relationship: "Relationship",
    task: "Task",
    session_summary: "Summary",
};

const MEMORY_TYPE_COLOURS: Record<string, string> = {
    preference: "#c084fc",
    feedback: "#f59e0b",
    fact: "#00aa9c",
    relationship: "#ec4899",
    task: "#3b82f6",
    session_summary: "rgba(255,255,255,0.3)",
};

export default function AgentMemoryPanel({agentId, apiUrl, token}: Props) {
    const [memories, setMemories] = useState<AgentMemory[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [filterType, setFilterType] = useState<string>("");
    const [filterPinned, setFilterPinned] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState("");
    const [editBody, setEditBody] = useState("");
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
    const [confirmForgetAll, setConfirmForgetAll] = useState(false);

    const headers = {Authorization: "Bearer " + token, "Content-Type": "application/json"};

    const loadMemories = useCallback(() => {
        if (!agentId || !apiUrl) return;
        setLoading(true);
        const params = new URLSearchParams({limit: "500"});
        if (filterPinned) params.set("pinned", "true");

        api.get(`${apiUrl}/api/v1/agent/${agentId}/my-memories?${params}`, {headers})
            .then(res => {
                if (res?.data) setMemories(res.data);
            })
            .catch(() => setMemories([]))
            .finally(() => setLoading(false));
    }, [agentId, apiUrl, token, filterPinned]);

    useEffect(() => {
        loadMemories();
    }, [loadMemories]);

    const filtered = memories.filter(m => {
        if (filterType && m.memory_type !== filterType) return false;
        if (search) {
            const q = search.toLowerCase();
            return m.title.toLowerCase().includes(q) || m.body.toLowerCase().includes(q);
        }
        return true;
    });

    const handleDelete = (id: string) => {
        api.delete(`${apiUrl}/api/v1/agent/${agentId}/my-memories/${id}`, {headers})
            .then(() => {
                setMemories(prev => prev.filter(m => m.id !== id));
                setConfirmDelete(null);
            })
            .catch(() => {});
    };

    const handleForgetAll = () => {
        api.post(`${apiUrl}/api/v1/agent/${agentId}/my-memories/forget-all`, {}, {headers})
            .then(() => {
                setMemories([]);
                setConfirmForgetAll(false);
            })
            .catch(() => {});
    };

    const handleUpdate = (id: string) => {
        api.patch(`${apiUrl}/api/v1/agent/${agentId}/my-memories/${id}`, {
            title: editTitle,
            body: editBody,
        }, {headers})
            .then(() => {
                setMemories(prev => prev.map(m => m.id === id ? {...m, title: editTitle, body: editBody} : m));
                setEditingId(null);
            })
            .catch(() => {});
    };

    const handleTogglePin = (mem: AgentMemory) => {
        const newPinned = !mem.pinned;
        api.patch(`${apiUrl}/api/v1/agent/${agentId}/my-memories/${mem.id}`, {
            pinned: newPinned,
        }, {headers})
            .then(() => {
                setMemories(prev => prev.map(m => m.id === mem.id ? {...m, pinned: newPinned} : m));
            })
            .catch(() => {});
    };

    const handleExport = () => {
        api.post(`${apiUrl}/api/v1/agent/${agentId}/my-memories/export`, {}, {headers})
            .then(res => {
                const blob = new Blob([JSON.stringify(res.data, null, 2)], {type: "application/json"});
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `agent-${agentId}-data-export.json`;
                a.click();
                URL.revokeObjectURL(url);
            })
            .catch(() => {});
    };

    const memoryTypes = [...new Set(memories.map(m => m.memory_type))];

    if (loading) {
        return <div className="agent-empty-state">Loading memories...</div>;
    }

    return (
        <div>
            <div className="memory-toolbar">
                <input
                    className="agent-form-input memory-search"
                    placeholder="Search memories..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
                <div className="memory-filters">
                    <select
                        className="memory-filter-select"
                        value={filterType}
                        onChange={e => setFilterType(e.target.value)}
                    >
                        <option value="">All types</option>
                        {memoryTypes.map(t => (
                            <option key={t} value={t}>{MEMORY_TYPE_LABELS[t] || t}</option>
                        ))}
                    </select>
                    <div className="agent-toggle-row">
                        <label className="agent-toggle">
                            <input type="checkbox" checked={filterPinned} onChange={e => setFilterPinned(e.target.checked)} />
                            <span className="agent-toggle-slider"></span>
                        </label>
                        <span className="agent-toggle-label">Pinned only</span>
                    </div>
                </div>
                <div className="memory-actions">
                    <button className="memory-btn memory-btn-secondary" onClick={handleExport}>Export Data</button>
                    <button className="memory-btn memory-btn-danger" onClick={() => setConfirmForgetAll(true)}>Forget All</button>
                </div>
            </div>

            {confirmForgetAll && (
                <div className="memory-confirm-bar">
                    <span>Are you sure? This will permanently delete all {memories.length} memories.</span>
                    <button className="memory-btn memory-btn-danger" onClick={handleForgetAll}>Yes, Forget Everything</button>
                    <button className="memory-btn memory-btn-secondary" onClick={() => setConfirmForgetAll(false)}>Cancel</button>
                </div>
            )}

            <div className="memory-count">{filtered.length} memor{filtered.length === 1 ? 'y' : 'ies'}</div>

            {filtered.length === 0 && (
                <div className="agent-empty-state">
                    {memories.length === 0
                        ? "No memories yet. Memories will appear as you interact with this agent."
                        : "No memories match your search."}
                </div>
            )}

            <div className="agent-memory-list">
                {filtered.map(mem => (
                    <div key={mem.id} className="agent-memory-item">
                        {editingId === mem.id ? (
                            <div className="memory-edit-form">
                                <input
                                    className="agent-form-input"
                                    value={editTitle}
                                    onChange={e => setEditTitle(e.target.value)}
                                    placeholder="Title"
                                />
                                <textarea
                                    className="agent-form-input memory-edit-body"
                                    value={editBody}
                                    onChange={e => setEditBody(e.target.value)}
                                    placeholder="Body"
                                    rows={3}
                                />
                                <div className="memory-edit-actions">
                                    <button className="memory-btn memory-btn-primary" onClick={() => handleUpdate(mem.id)}>Save</button>
                                    <button className="memory-btn memory-btn-secondary" onClick={() => setEditingId(null)}>Cancel</button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="memory-item-header">
                                    <div className="memory-item-left">
                                        <span
                                            className="memory-type-badge"
                                            style={{background: MEMORY_TYPE_COLOURS[mem.memory_type] || 'rgba(255,255,255,0.2)'}}
                                        >
                                            {MEMORY_TYPE_LABELS[mem.memory_type] || mem.memory_type}
                                        </span>
                                        <span className="memory-title">{mem.title}</span>
                                        {mem.pinned && <span className="memory-pin-badge">Pinned</span>}
                                    </div>
                                    <div className="memory-item-right">
                                        <span className="memory-confidence" title={`Confidence: ${Math.round(mem.confidence * 100)}%`}>
                                            {Math.round(mem.confidence * 100)}%
                                        </span>
                                        <span className="memory-date">{dayjs.utc(mem.created_at).fromNow()}</span>
                                    </div>
                                </div>
                                <div className="memory-body">{mem.body}</div>
                                {mem.valid_until && (
                                    <div className="memory-expiry">
                                        Expires {dayjs.utc(mem.valid_until).fromNow()}
                                    </div>
                                )}
                                <div className="memory-item-actions">
                                    <button
                                        className="memory-action-btn"
                                        onClick={() => handleTogglePin(mem)}
                                    >
                                        {mem.pinned ? "Unpin" : "Pin"}
                                    </button>
                                    <button
                                        className="memory-action-btn"
                                        onClick={() => {
                                            setEditingId(mem.id);
                                            setEditTitle(mem.title);
                                            setEditBody(mem.body);
                                        }}
                                    >
                                        Edit
                                    </button>
                                    {confirmDelete === mem.id ? (
                                        <>
                                            <button className="memory-action-btn memory-action-danger" onClick={() => handleDelete(mem.id)}>Confirm</button>
                                            <button className="memory-action-btn" onClick={() => setConfirmDelete(null)}>Cancel</button>
                                        </>
                                    ) : (
                                        <button className="memory-action-btn memory-action-danger" onClick={() => setConfirmDelete(mem.id)}>Delete</button>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}