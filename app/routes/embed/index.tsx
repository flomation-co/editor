import type {Route} from "../+types/home";
import Container from "~/components/container";
import {useEffect, useState} from "react";
import useConfig from "~/components/config";
import api from "~/lib/api";
import useCookieToken from "~/components/cookie";
import type {EmbedApp} from "~/types";
import {PERMISSIONS} from "~/types";
import Modal from "~/components/modal";
import {toast} from "react-toastify";
import {Icon} from "~/components/icons/Icon";
import ProtectedRoute from "~/components/protected-route";
import "./index.css";

export function meta({}: Route.MetaArgs) {
    return [
        {title: "Flomation - Embed SDK"},
        {name: "description", content: "Publishable keys for embedding forms, flows and agents"},
    ];
}

const RESOURCE_TYPES = ["form", "flow", "agent"] as const;

export default function EmbedApps() {
    const token = useCookieToken();
    const [isLoading, setIsLoading] = useState(true);
    const [apps, setApps] = useState<EmbedApp[]>([]);
    const [showCreate, setShowCreate] = useState(false);
    const [newName, setNewName] = useState("");
    const [newOrigins, setNewOrigins] = useState("");
    const [expanded, setExpanded] = useState<string | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    const base = () => useConfig()("AUTOMATE_API_URL") + "/api/v1/embed/app";
    const auth = {headers: {Authorization: "Bearer " + token}};

    const load = () => {
        api.get(base(), auth)
            .then(r => setApps(Array.isArray(r?.data) ? r.data : []))
            .catch(() => setApps([]))
            .finally(() => setIsLoading(false));
    };
    useEffect(() => { load(); }, []);

    const create = () => {
        if (newName.trim().length < 3) return;
        const origins = newOrigins.split(/[\n,]/).map(o => o.trim()).filter(Boolean);
        api.post(base(), {name: newName.trim(), allowed_origins: origins}, auth)
            .then(() => {
                setNewName(""); setNewOrigins(""); setShowCreate(false);
                toast.success("Embed key created");
                load();
            })
            .catch(() => toast.error("Failed to create embed key"));
    };

    const remove = (id: string) => {
        api.delete(base() + "/" + id, auth)
            .then(() => { toast.success("Embed key deleted"); load(); })
            .catch(() => toast.error("Failed to delete embed key"));
    };

    const copyKey = (key: string) => {
        navigator.clipboard?.writeText(key).then(
            () => toast.success("Publishable key copied"),
            () => toast.error("Could not copy"),
        );
    };

    return (
        <Container>
            <ProtectedRoute permission={PERMISSIONS.EMBED_VIEW}>
                <div className="header">Embed SDK</div>
                <p className="embed-intro">
                    Publishable keys let you render Flomation forms, flows and agents natively in your own
                    site with the SDK — no iframe. A key is safe in client-side code: access is gated by the
                    allowed origins and the resources you opt in below, and every submission is re-validated
                    server-side.
                </p>

                {isLoading && (
                    <div className="loading-container"><Icon name="spinner" spin /></div>
                )}

                {!isLoading && (
                    <div className="embed-page">
                        {!showCreate && (
                            <button className="embed-create-btn" onClick={() => setShowCreate(true)}>
                                <Icon name="plus" /> Create Embed Key
                            </button>
                        )}

                        {showCreate && (
                            <div className="embed-create-form">
                                <input
                                    type="text" autoFocus placeholder="Key name (e.g. Marketing site)"
                                    value={newName} onChange={e => setNewName(e.target.value)}
                                />
                                <textarea
                                    placeholder="Allowed origins, one per line — e.g. https://example.com"
                                    value={newOrigins} onChange={e => setNewOrigins(e.target.value)}
                                />
                                <div className="embed-create-actions">
                                    <button className="embed-btn-save" onClick={create} disabled={newName.trim().length < 3}>
                                        <Icon name="plus" /> Create
                                    </button>
                                    <button className="embed-btn-cancel" onClick={() => { setShowCreate(false); setNewName(""); setNewOrigins(""); }}>
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}

                        {apps.length === 0 && <div className="embed-empty">No embed keys yet</div>}

                        <div className="embed-list">
                            {apps.map(app => (
                                <EmbedCard
                                    key={app.id}
                                    app={app}
                                    expanded={expanded === app.id}
                                    onToggle={() => setExpanded(expanded === app.id ? null : app.id)}
                                    onCopy={() => copyKey(app.publishable_key)}
                                    onDelete={() => setConfirmDeleteId(app.id)}
                                    onChanged={load}
                                    base={base}
                                    auth={auth}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {confirmDeleteId && (
                    <Modal
                        label="Delete Embed Key" footerMessage="This action cannot be undone"
                        visible={true} canDismiss={true} onDismiss={() => setConfirmDeleteId(null)}
                        actions={[{
                            label: "Delete", primary: false, variant: "danger",
                            onClick: () => { remove(confirmDeleteId); setConfirmDeleteId(null); },
                        }]}
                    >
                        Deleting this key immediately stops any site using it from loading your embedded forms.
                    </Modal>
                )}
            </ProtectedRoute>
        </Container>
    );
}

function EmbedCard(props: {
    app: EmbedApp;
    expanded: boolean;
    onToggle: () => void;
    onCopy: () => void;
    onDelete: () => void;
    onChanged: () => void;
    base: () => string;
    auth: {headers: {Authorization: string}};
}) {
    const {app, base, auth, onChanged} = props;
    const [origin, setOrigin] = useState("");
    const [resType, setResType] = useState<typeof RESOURCE_TYPES[number]>("form");
    const [resId, setResId] = useState("");

    const appURL = base() + "/" + app.id;

    const addOrigin = () => {
        if (!origin.trim()) return;
        api.post(appURL + "/origin", {origin: origin.trim()}, auth)
            .then(() => { setOrigin(""); toast.success("Origin added"); onChanged(); })
            .catch(() => toast.error("Failed to add origin"));
    };
    const removeOrigin = (o: string) => {
        api.delete(appURL + "/origin", {...auth, data: {origin: o}})
            .then(() => { toast.success("Origin removed"); onChanged(); })
            .catch(() => toast.error("Failed to remove origin"));
    };
    const setResource = (rt: string, rid: string, enabled: boolean) => {
        if (!rid.trim()) return;
        api.post(appURL + "/resource", {resource_type: rt, resource_id: rid.trim(), enabled}, auth)
            .then(() => { setResId(""); toast.success(enabled ? "Resource added" : "Resource removed"); onChanged(); })
            .catch(() => toast.error("Failed to update resource"));
    };

    const masked = app.publishable_key.slice(0, 7) + "…" + app.publishable_key.slice(-4);

    return (
        <div className="embed-card">
            <div className="embed-card-head" onClick={props.onToggle}>
                <div className="embed-card-icon"><Icon name="code" /></div>
                <div className="embed-card-info">
                    <div className="embed-card-name">{app.name}</div>
                    <div className="embed-card-meta">
                        <span>{(app.allowed_origins?.length ?? 0)} origins</span>
                        <span>{(app.resources?.length ?? 0)} resources</span>
                    </div>
                </div>
                <button className="embed-key-pill" onClick={e => { e.stopPropagation(); props.onCopy(); }} title="Copy publishable key">
                    <Icon name="copy" /> {masked}
                </button>
                <button className="embed-card-delete" onClick={e => { e.stopPropagation(); props.onDelete(); }}>
                    <Icon name="trash" />
                </button>
                <Icon name={props.expanded ? "chevron-up" : "chevron-down"} />
            </div>

            {props.expanded && (
                <div className="embed-card-body">
                    <section>
                        <h4>Allowed origins</h4>
                        <div className="embed-chip-row">
                            {(app.allowed_origins ?? []).map(o => (
                                <span key={o} className="embed-chip">
                                    {o}
                                    <button onClick={() => removeOrigin(o)}><Icon name="xmark" /></button>
                                </span>
                            ))}
                            {(app.allowed_origins?.length ?? 0) === 0 && <span className="embed-hint">No origins — the key can't be used from any site yet.</span>}
                        </div>
                        <div className="embed-add-row">
                            <input placeholder="https://example.com" value={origin}
                                   onChange={e => setOrigin(e.target.value)}
                                   onKeyDown={e => e.key === "Enter" && addOrigin()} />
                            <button onClick={addOrigin}><Icon name="plus" /> Add origin</button>
                        </div>
                    </section>

                    <section>
                        <h4>Embeddable resources</h4>
                        <div className="embed-chip-row">
                            {(app.resources ?? []).map(r => (
                                <span key={r.resource_type + r.resource_id} className="embed-chip">
                                    {r.resource_type}: {r.resource_id.slice(0, 8)}
                                    <button onClick={() => setResource(r.resource_type, r.resource_id, false)}><Icon name="xmark" /></button>
                                </span>
                            ))}
                            {(app.resources?.length ?? 0) === 0 && <span className="embed-hint">Nothing embeddable yet — opt a form, flow or agent in below.</span>}
                        </div>
                        <div className="embed-add-row">
                            <select value={resType} onChange={e => setResType(e.target.value as typeof RESOURCE_TYPES[number])}>
                                {RESOURCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                            <input placeholder="Resource ID (form / flow / agent)" value={resId}
                                   onChange={e => setResId(e.target.value)}
                                   onKeyDown={e => e.key === "Enter" && setResource(resType, resId, true)} />
                            <button onClick={() => setResource(resType, resId, true)}><Icon name="plus" /> Opt in</button>
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
}
