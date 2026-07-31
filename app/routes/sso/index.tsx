import { useEffect, useState } from "react";
import api from "~/lib/api";
import Container from "~/components/container";
import type { HelpContent } from "~/components/helpPane";
import ProtectedRoute from "~/components/protected-route";
import { PERMISSIONS } from "~/types";
import { useOrganisation } from "~/context/organisation/use";
import useCookieToken from "~/components/cookie";
import useConfig from "~/components/config";
import { toast } from "~/components/toast";
import { Icon } from "~/components/icons/Icon";
import "./index.css";

const config = useConfig();
const API_URL = config("AUTOMATE_API_URL");

const SSO_HELP: HelpContent = {
    title: "About Single Sign-On",
    intro: "Let people in your organisation sign in with your own identity provider (Microsoft Entra ID) instead of a Flomation password.",
    points: [
        "Add a connection with your Entra tenant and app details",
        "Claim your email domains and verify each with a DNS TXT record",
        "Once verified, anyone typing an address at that domain is sent to Entra to sign in",
        "New people are created automatically on first sign-in (just-in-time)",
    ],
    tip: "Keep a Flomation password on at least one admin (break-glass) so a misconfigured connection can't lock you out.",
};

type Connection = {
    id: string;
    organisation_id: string;
    protocol: string;
    issuer: string;
    tenant_id?: string;
    client_id: string;
    enabled: boolean;
};

type Domain = {
    id: string;
    domain: string;
    verification_token: string;
    verified_at?: string | null;
};

const blankForm = { issuer: "", tenant_id: "", client_id: "", client_secret: "", enabled: true };

export default function SSO() {
    const { currentOrg } = useOrganisation();
    const token = useCookieToken();

    const [connections, setConnections] = useState<Connection[]>([]);
    const [domains, setDomains] = useState<Record<string, Domain[]>>({});
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ ...blankForm });
    const [newDomain, setNewDomain] = useState<Record<string, string>>({});
    const [txtHint, setTxtHint] = useState<{ name: string; value: string } | null>(null);

    const base = () => `${API_URL}/api/v1/organisation/${currentOrg?.id}/sso`;
    const hdr = { headers: { Authorization: "Bearer " + token } };

    const loadConnections = () => {
        if (!currentOrg) return;
        api.get(`${base()}/connection`, hdr)
            .then(res => setConnections(Array.isArray(res.data) ? res.data : []))
            .catch(() => setConnections([]));
    };

    const loadDomains = (connID: string) => {
        api.get(`${base()}/connection/${connID}/domain`, hdr)
            .then(res => setDomains(prev => ({ ...prev, [connID]: Array.isArray(res.data) ? res.data : [] })))
            .catch(() => setDomains(prev => ({ ...prev, [connID]: [] })));
    };

    useEffect(() => { loadConnections(); }, [currentOrg]);
    useEffect(() => { connections.forEach(c => loadDomains(c.id)); /* eslint-disable-next-line */ }, [connections.length]);

    const createConnection = () => {
        if (!form.issuer.trim() || !form.client_id.trim()) { toast.error("Issuer and Client ID are required"); return; }
        api.post(`${base()}/connection`, {
            protocol: "oidc",
            issuer: form.issuer.trim(),
            tenant_id: form.tenant_id.trim() || null,
            client_id: form.client_id.trim(),
            client_secret: form.client_secret || null,
            enabled: form.enabled,
        }, hdr)
            .then(() => { toast.success("Connection created"); setShowForm(false); setForm({ ...blankForm }); loadConnections(); })
            .catch(() => toast.error("Failed to create connection"));
    };

    const toggleEnabled = (c: Connection) => {
        api.put(`${base()}/connection/${c.id}`, { issuer: c.issuer, tenant_id: c.tenant_id || null, client_id: c.client_id, enabled: !c.enabled }, hdr)
            .then(() => loadConnections())
            .catch(() => toast.error("Failed to update"));
    };

    const deleteConnection = (c: Connection) => {
        api.delete(`${base()}/connection/${c.id}`, hdr)
            .then(() => { toast.success("Connection deleted"); loadConnections(); })
            .catch(() => toast.error("Failed to delete"));
    };

    const addDomain = (connID: string) => {
        const d = (newDomain[connID] || "").trim().toLowerCase();
        if (!d) return;
        api.post(`${base()}/connection/${connID}/domain`, { domain: d }, hdr)
            .then(res => {
                setTxtHint({ name: res.data.record_name, value: res.data.record_value });
                setNewDomain(prev => ({ ...prev, [connID]: "" }));
                loadDomains(connID);
            })
            .catch(() => toast.error("Domain already claimed, or invalid"));
    };

    const verifyDomain = (connID: string, dom: Domain) => {
        api.post(`${base()}/connection/${connID}/domain/${dom.id}/verify`, null, hdr)
            .then(res => {
                if (res.data?.verified) { toast.success("Domain verified"); } else { toast.error("TXT record not found yet — DNS can take a while"); }
                loadDomains(connID);
            })
            .catch(() => toast.error("Verification failed"));
    };

    const deleteDomain = (connID: string, dom: Domain) => {
        api.delete(`${base()}/connection/${connID}/domain/${dom.id}`, hdr)
            .then(() => loadDomains(connID))
            .catch(() => toast.error("Failed to delete domain"));
    };

    return (
        <Container help={SSO_HELP}>
            <ProtectedRoute permissions={[PERMISSIONS.ORGANISATION_MANAGE]}>
                <div className="header">Single Sign-On</div>

                {!currentOrg && <div className="sso-empty">SSO is configured per organisation — switch to an organisation to set it up.</div>}

                {currentOrg && (
                    <>
                        <div className="sso-actions">
                            <button className="sso-btn sso-btn--primary" onClick={() => setShowForm(v => !v)}>
                                <Icon name="plus" /> New connection
                            </button>
                        </div>

                        {showForm && (
                            <div className="sso-card sso-form">
                                <label className="sso-label">Issuer URL</label>
                                <input className="sso-input" placeholder="https://login.microsoftonline.com/<tenant-id>/v2.0" value={form.issuer} onChange={e => setForm({ ...form, issuer: e.target.value })} />
                                <label className="sso-label">Tenant ID (recommended — pins the tenant)</label>
                                <input className="sso-input" placeholder="00000000-0000-0000-0000-000000000000" value={form.tenant_id} onChange={e => setForm({ ...form, tenant_id: e.target.value })} />
                                <label className="sso-label">Application (client) ID</label>
                                <input className="sso-input" value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })} />
                                <label className="sso-label">Client secret</label>
                                <input className="sso-input" type="password" placeholder="Value from Entra → Certificates & secrets" value={form.client_secret} onChange={e => setForm({ ...form, client_secret: e.target.value })} />
                                <div className="sso-form-actions">
                                    <button className="sso-btn" onClick={() => { setShowForm(false); setForm({ ...blankForm }); }}>Cancel</button>
                                    <button className="sso-btn sso-btn--primary" onClick={createConnection}>Create</button>
                                </div>
                                <div className="sso-hint">Set the redirect URI in Entra to <code>{API_URL.replace(/\/$/, "")}</code>'s Sentinel host at <code>/sso/callback</code>.</div>
                            </div>
                        )}

                        {txtHint && (
                            <div className="sso-card sso-txt">
                                <div className="sso-txt-title"><Icon name="circle-info" /> Add this DNS TXT record, then click Verify</div>
                                <div className="sso-txt-row"><span>Host</span><code>{txtHint.name}</code></div>
                                <div className="sso-txt-row"><span>Value</span><code>{txtHint.value}</code></div>
                                <button className="sso-btn" onClick={() => setTxtHint(null)}>Dismiss</button>
                            </div>
                        )}

                        {connections.length === 0 && !showForm && (
                            <div className="sso-empty">No SSO connections yet. Add one to let your team sign in with Entra ID.</div>
                        )}

                        {connections.map(c => (
                            <div key={c.id} className="sso-card">
                                <div className="sso-conn-head">
                                    <Icon name="lock" className="sso-conn-icon" />
                                    <div className="sso-conn-title">
                                        <div className="sso-conn-name">Microsoft Entra ID</div>
                                        <div className="sso-conn-issuer">{c.issuer}</div>
                                    </div>
                                    <span className={`sso-badge ${c.enabled ? "sso-badge--on" : "sso-badge--off"}`}>{c.enabled ? "Enabled" : "Disabled"}</span>
                                    <button className="sso-btn" onClick={() => toggleEnabled(c)}>{c.enabled ? "Disable" : "Enable"}</button>
                                    <button className="sso-btn sso-btn--danger" onClick={() => deleteConnection(c)}><Icon name="trash" /></button>
                                </div>

                                <div className="sso-domains">
                                    <div className="sso-domains-title">Claimed domains</div>
                                    {(domains[c.id] || []).map(dom => (
                                        <div key={dom.id} className="sso-domain-row">
                                            <span className="sso-domain-name">{dom.domain}</span>
                                            {dom.verified_at
                                                ? <span className="sso-badge sso-badge--on"><Icon name="check" /> Verified</span>
                                                : <span className="sso-badge sso-badge--off">Unverified</span>}
                                            {!dom.verified_at && <button className="sso-btn" onClick={() => verifyDomain(c.id, dom)}>Verify</button>}
                                            <button className="sso-btn sso-btn--danger" onClick={() => deleteDomain(c.id, dom)}><Icon name="trash" /></button>
                                        </div>
                                    ))}
                                    <div className="sso-domain-add">
                                        <input className="sso-input" placeholder="example.gov.uk" value={newDomain[c.id] || ""} onChange={e => setNewDomain(prev => ({ ...prev, [c.id]: e.target.value }))} />
                                        <button className="sso-btn" onClick={() => addDomain(c.id)}>Add domain</button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </>
                )}
            </ProtectedRoute>
        </Container>
    );
}
