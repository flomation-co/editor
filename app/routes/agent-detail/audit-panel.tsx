import {useState, useEffect, useCallback} from "react";
import type {AgentAuditLog} from "~/types";
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

const EVENT_TYPE_CONFIG: Record<string, {label: string; colour: string}> = {
    memory_created: {label: "Memory Created", colour: "#00aa9c"},
    memory_updated: {label: "Memory Updated", colour: "#3b82f6"},
    memory_deleted: {label: "Memory Deleted", colour: "#f44336"},
    memory_pinned: {label: "Memory Pinned", colour: "#c084fc"},
    memory_unpinned: {label: "Memory Unpinned", colour: "rgba(255,255,255,0.4)"},
    identity_linked: {label: "Identity Linked", colour: "#00aa9c"},
    identity_unlinked: {label: "Identity Unlinked", colour: "#f59e0b"},
    identity_merged: {label: "Identity Merged", colour: "#c084fc"},
    bulk_forget: {label: "Bulk Forget", colour: "#f44336"},
    data_export: {label: "Data Export", colour: "#3b82f6"},
    retention_sweep: {label: "Retention Sweep", colour: "#f59e0b"},
    retention_updated: {label: "Retention Updated", colour: "#3b82f6"},
};

const ACTOR_TYPE_LABELS: Record<string, string> = {
    user: "User",
    system: "System",
    agent: "Agent",
    retention: "Retention Poller",
};

export default function AgentAuditPanel({agentId, apiUrl, token}: Props) {
    const [entries, setEntries] = useState<AgentAuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [offset, setOffset] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [filterEvent, setFilterEvent] = useState<string>("");
    const limit = 50;

    const headers = {Authorization: "Bearer " + token, "Content-Type": "application/json"};

    const loadEntries = useCallback((appendOffset: number = 0) => {
        if (!agentId || !apiUrl) return;
        setLoading(true);

        api.get(`${apiUrl}/api/v1/agent/${agentId}/audit-log?limit=${limit}&offset=${appendOffset}`, {headers})
            .then(res => {
                const data = res?.data || [];
                if (appendOffset === 0) {
                    setEntries(data);
                } else {
                    setEntries(prev => [...prev, ...data]);
                }
                setHasMore(data.length === limit);
            })
            .catch(() => {
                if (appendOffset === 0) setEntries([]);
            })
            .finally(() => setLoading(false));
    }, [agentId, apiUrl, token]);

    useEffect(() => {
        loadEntries(0);
    }, [loadEntries]);

    const filtered = filterEvent
        ? entries.filter(e => e.event_type === filterEvent)
        : entries;

    const eventTypes = [...new Set(entries.map(e => e.event_type))];

    if (loading && entries.length === 0) {
        return <div className="agent-empty-state">Loading audit log...</div>;
    }

    return (
        <div>
            <div className="memory-toolbar">
                <select
                    className="memory-filter-select"
                    value={filterEvent}
                    onChange={e => setFilterEvent(e.target.value)}
                >
                    <option value="">All events</option>
                    {eventTypes.map(t => (
                        <option key={t} value={t}>{EVENT_TYPE_CONFIG[t]?.label || t}</option>
                    ))}
                </select>
                <button className="memory-btn memory-btn-secondary" onClick={() => loadEntries(0)}>Refresh</button>
            </div>

            <div className="memory-count">{filtered.length} event{filtered.length === 1 ? '' : 's'}</div>

            {filtered.length === 0 && (
                <div className="agent-empty-state">No audit events yet.</div>
            )}

            <div className="audit-log-list">
                {filtered.map(entry => {
                    const config = EVENT_TYPE_CONFIG[entry.event_type] || {label: entry.event_type, colour: "rgba(255,255,255,0.4)"};
                    return (
                        <div
                            key={entry.id}
                            className="audit-log-item"
                            onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                        >
                            <div className="audit-item-header">
                                <div className="audit-item-left">
                                    <span className="audit-event-badge" style={{background: config.colour}}>
                                        {config.label}
                                    </span>
                                    <span className="audit-resource">
                                        {entry.resource_type}
                                        {entry.resource_id && ` (${entry.resource_id.slice(0, 8)}...)`}
                                    </span>
                                </div>
                                <div className="audit-item-right">
                                    <span className="audit-actor">
                                        {ACTOR_TYPE_LABELS[entry.actor_type] || entry.actor_type}
                                    </span>
                                    <span className="memory-date">
                                        {dayjs.utc(entry.created_at).local().format("D MMM YYYY HH:mm")}
                                    </span>
                                </div>
                            </div>
                            {expandedId === entry.id && entry.detail && (
                                <pre className="audit-detail">
                                    {JSON.stringify(entry.detail, null, 2)}
                                </pre>
                            )}
                        </div>
                    );
                })}
            </div>

            {hasMore && !filterEvent && (
                <div style={{textAlign: 'center', padding: 16}}>
                    <button
                        className="memory-btn memory-btn-secondary"
                        onClick={() => {
                            const newOffset = offset + limit;
                            setOffset(newOffset);
                            loadEntries(newOffset);
                        }}
                        disabled={loading}
                    >
                        {loading ? 'Loading...' : 'Load More'}
                    </button>
                </div>
            )}
        </div>
    );
}
