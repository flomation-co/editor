import type {Route} from "../+types/home";
import Container from "~/components/container";
import React, {useEffect, useState} from "react";
import {useOrganisation} from "~/context/organisation/use";
import type {Queue, Runner} from "~/types";
import api from "~/lib/api";
import useConfig from "~/components/config";
import useCookieToken from "~/components/cookie";
import Modal from "~/components/modal";
import {toast} from "react-toastify";
import "./index.css";
import { Icon } from "~/components/icons/Icon";

export function meta({}: Route.MetaArgs) {
    return [
        { title: "Flomation - Queues" },
        { name: "description", content: "Manage execution queues" },
    ];
}

export default function Queues() {
    const config = useConfig();
    const token = useCookieToken();
    const { currentOrg } = useOrganisation();

    const [queues, setQueues] = useState<Queue[]>([]);
    const [newQueueName, setNewQueueName] = useState("");
    const [expandedQueue, setExpandedQueue] = useState<string | null>(null);
    const [queueRunners, setQueueRunners] = useState<Record<string, Runner[]>>({});
    const [allRunners, setAllRunners] = useState<Runner[]>([]);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [confirmDeleteQueue, setConfirmDeleteQueue] = useState<string | null>(null);
    const [confirmRemoveRunner, setConfirmRemoveRunner] = useState<{ queueId: string; runnerId: string; name: string } | null>(null);

    const API_URL = config("AUTOMATE_API_URL");
    const isAdmin = currentOrg?.role === "admin";

    const fetchQueues = () => {
        api.get(`${API_URL}/api/v1/queue`, {
            headers: { Authorization: "Bearer " + token }
        })
            .then(res => { if (res.data) setQueues(res.data); })
            .catch(() => setQueues([]));
    };

    const fetchAllRunners = () => {
        api.get(`${API_URL}/api/v1/runner`, {
            headers: { Authorization: "Bearer " + token }
        })
            .then(res => { if (res.data) setAllRunners(res.data); })
            .catch(() => setAllRunners([]));
    };

    const fetchQueueRunners = (queueId: string) => {
        api.get(`${API_URL}/api/v1/queue/${queueId}/runner`, {
            headers: { Authorization: "Bearer " + token }
        })
            .then(res => {
                setQueueRunners(prev => ({...prev, [queueId]: res.data || []}));
            })
            .catch(() => {
                setQueueRunners(prev => ({...prev, [queueId]: []}));
            });
    };

    useEffect(() => {
        fetchQueues();
        fetchAllRunners();
    }, []);

    useEffect(() => {
        if (expandedQueue) {
            fetchQueueRunners(expandedQueue);
        }
    }, [expandedQueue]);

    const createQueue = () => {
        if (!newQueueName.trim()) return;
        api.post(`${API_URL}/api/v1/queue`, { name: newQueueName }, {
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }
        })
            .then(() => { setNewQueueName(""); fetchQueues(); })
            .catch(err => console.error("Unable to create queue", err));
    };

    const deleteQueue = (id: string) => {
        api.delete(`${API_URL}/api/v1/queue/${id}`, {
            headers: { Authorization: "Bearer " + token }
        })
            .then(() => {
                toast.success("Queue deleted");
                if (expandedQueue === id) setExpandedQueue(null);
                fetchQueues();
            })
            .catch(err => { console.error("Unable to delete queue", err); toast.error("Failed to delete queue"); });
    };

    const addRunner = (queueId: string, runnerId: string) => {
        api.post(`${API_URL}/api/v1/queue/${queueId}/runner`, { runner_id: runnerId }, {
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }
        })
            .then(() => fetchQueueRunners(queueId))
            .catch(err => console.error("Unable to add runner", err));
    };

    const removeRunner = (queueId: string, runnerId: string) => {
        api.delete(`${API_URL}/api/v1/queue/${queueId}/runner/${runnerId}`, {
            headers: { Authorization: "Bearer " + token }
        })
            .then(() => { toast.success("Runner removed"); fetchQueueRunners(queueId); })
            .catch(err => { console.error("Unable to remove runner", err); toast.error("Failed to remove runner"); });
    };

    const copyCode = (code: string, id: string) => {
        navigator.clipboard.writeText(code);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    if (!currentOrg) {
        return (
            <Container>
                <div className={"header"}>Queues</div>
                <div className={"queue-empty"}>
                    <p>Select an organisation to manage queues.</p>
                </div>
            </Container>
        );
    }

    const assignedRunnerIds = new Set(
        Object.values(queueRunners).flat().map(r => r.id)
    );
    const availableRunners = allRunners.filter(r => !assignedRunnerIds.has(r.id));

    return (
        <Container>
            <div className={"header"}>Queues</div>

            {isAdmin && (
                <div className="queue-create-section">
                    <div className="queue-create">
                        <input
                            type="text"
                            placeholder="New queue name..."
                            value={newQueueName}
                            onChange={e => setNewQueueName(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && createQueue()}
                        />
                        <button className="queue-create-btn" onClick={createQueue} disabled={!newQueueName.trim()}>
                            <Icon name="plus" /> Create Queue
                        </button>
                    </div>
                </div>
            )}

            <div className={"queue-list"}>
                {queues.map(q => (
                    <div key={q.id} className="queue-card">
                        <div className="queue-card-header" onClick={() => setExpandedQueue(expandedQueue === q.id ? null : q.id)}>
                            <Icon name={expandedQueue === q.id? "chevron-down" : "chevron-right"} className="queue-card-chevron" />
                            <div className="queue-card-info">
                                <div className="queue-card-name">{q.name}</div>
                                <div className="queue-card-code">
                                    {q.registration_code}
                                    <button className="queue-code-copy" onClick={(e) => { e.stopPropagation(); copyCode(q.registration_code, q.id); }}>
                                        <Icon name={copiedId === q.id? "check" : "copy"} />
                                    </button>
                                </div>
                            </div>
                            <div className="queue-card-meta">
                                {isAdmin && (
                                    <button className="queue-delete-btn" onClick={(e) => { e.stopPropagation(); setConfirmDeleteQueue(q.id); }}>
                                        <Icon name="trash" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {expandedQueue === q.id && (
                            <div className={"queue-card-body"}>
                                <div className={"queue-runners-label"}>Assigned Runners</div>
                                {(!queueRunners[q.id] || queueRunners[q.id].length === 0) && (
                                    <div className={"queue-runners-empty"}>No runners assigned to this queue</div>
                                )}
                                {queueRunners[q.id]?.map(r => (
                                    <div key={r.id} className="queue-runner-row">
                                        <div className={`queue-runner-indicator ${r.state === 'active' ? 'queue-runner-indicator--active' : ''}`} />
                                        <Icon name="server" className="queue-runner-icon" />
                                        <span className="queue-runner-name">{r.name || 'Unnamed Runner'}</span>
                                        <span className="queue-runner-id">{r.ip_address}</span>
                                        {isAdmin && (
                                            <button className="queue-runner-remove" onClick={() => setConfirmRemoveRunner({ queueId: q.id, runnerId: r.id, name: r.name || 'this runner' })}>
                                                <Icon name="xmark" />
                                            </button>
                                        )}
                                    </div>
                                ))}

                                {isAdmin && availableRunners.length > 0 && (
                                    <div className={"queue-add-runner"}>
                                        <select onChange={(e) => { if (e.target.value) { addRunner(q.id, e.target.value); e.target.value = ""; } }}>
                                            <option value="">Add runner...</option>
                                            {availableRunners.map(r => (
                                                <option key={r.id} value={r.id}>{r.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}

                {queues.length === 0 && (
                    <div className={"queue-empty"}>
                        <p>No queues configured. Create a queue and assign runners to it.</p>
                    </div>
                )}
            </div>

            {confirmDeleteQueue && (
                <Modal
                    label="Delete Queue"
                    footerMessage="This action cannot be undone"
                    visible={true}
                    canDismiss={true}
                    onDismiss={() => setConfirmDeleteQueue(null)}
                    actions={[{
                        label: "Delete",
                        primary: false,
                        variant: 'danger',
                        onClick: () => { deleteQueue(confirmDeleteQueue); setConfirmDeleteQueue(null); },
                    }]}
                >
                    Are you sure you want to delete this queue? All runner assignments will be removed.
                </Modal>
            )}

            {confirmRemoveRunner && (
                <Modal
                    label="Remove Runner"
                    visible={true}
                    canDismiss={true}
                    onDismiss={() => setConfirmRemoveRunner(null)}
                    actions={[{
                        label: "Remove",
                        primary: false,
                        variant: 'danger',
                        onClick: () => { removeRunner(confirmRemoveRunner.queueId, confirmRemoveRunner.runnerId); setConfirmRemoveRunner(null); },
                    }]}
                >
                    Are you sure you want to remove <strong>{confirmRemoveRunner.name}</strong> from this queue?
                </Modal>
            )}
        </Container>
    );
}
