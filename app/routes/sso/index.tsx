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
    intro: "Let people in your organisation sign in with your own identity provider — any OpenID Connect (OIDC) provider, such as Microsoft Entra ID, Okta or Google Workspace — instead of a Flomation password.",
    points: [
        "Pick your provider (or Generic OIDC) and enter its issuer + app credentials",
        "Register the redirect URI shown here in your provider",
        "Claim your email domains and verify each with a DNS TXT record",
        "Once verified, anyone typing an address at that domain is sent to your provider to sign in",
    ],
    tip: "Keep a Flomation password on at least one admin (break-glass) so a misconfigured connection can't lock you out.",
};

// Provider presets. Entra is the guided default; the engine itself is generic
// OIDC, so any compliant provider works. Tenant ID is Entra-only.
const PRESETS: Record<string, { label: string; issuerHint: string; tenant: boolean; note?: string; docs?: string; docsLabel?: string }> = {
    entra:   { label: "Microsoft Entra ID", issuerHint: "https://login.microsoftonline.com/<tenant-id>/v2.0", tenant: true,  note: "Client secret comes from Entra → Certificates & secrets.",
               docs: "https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app", docsLabel: "Register an app in Microsoft Entra ID" },
    okta:    { label: "Okta",               issuerHint: "https://<your-org>.okta.com",                        tenant: false,
               docs: "https://developer.okta.com/docs/guides/implement-grant-type/authcode/main/", docsLabel: "Create an OIDC app in Okta" },
    google:  { label: "Google Workspace",   issuerHint: "https://accounts.google.com",                       tenant: false,
               docs: "https://developers.google.com/identity/openid-connect/openid-connect#registeringyourapp", docsLabel: "Create OAuth credentials in Google Cloud" },
    generic: { label: "",                   issuerHint: "https://idp.example.com",                            tenant: false,
               docs: "https://openid.net/developers/how-connect-works/", docsLabel: "How OpenID Connect works" },
};

type Connection = {
    id: string;
    name?: string;
    protocol: string;
    issuer: string;
    tenant_id?: string;
    client_id: string;
    enabled: boolean;
};

type Domain = { id: string; domain: string; verification_token: string; verified_at?: string | null };

const blankForm = { preset: "entra", name: "Microsoft Entra ID", issuer: "", tenant_id: "", client_id: "", client_secret: "" };

export default function SSO() {
    const { currentOrg } = useOrganisation();
    const token = useCookieToken();

    const [connections, setConnections] = useState<Connection[]>([]);
    const [domains, setDomains] = useState<Record<string, Domain[]>>({});
    const [showForm, setShowForm] = useState(false);

    // The redirect URI is Sentinel's login host + /sso/callback. Derived from
    // LOGIN_URL so it's always populated (no cross-service call to load it).
    const redirectUri = (() => {
        try { const u = config("LOGIN_URL"); return u ? new URL(u).origin + "/sso/callback" : ""; }
        catch { return ""; }
    })();
    const [form, setForm] = useState({ ...blankForm });
    const [newDomain, setNewDomain] = useState<Record<string, string>>({});
    const [txtHint, setTxtHint] = useState<{ name: string; value: string } | null>(null);

    const base = () => `${API_URL}/api/v1/organisation/${currentOrg?.id}/sso`;
    const hdr = { headers: { Authorization: "Bearer " + token } };

    const copy = (text: string) => {
        navigator.clipboard?.writeText(text).then(() => toast.success("Copied to clipboard")).catch(() => toast.error("Couldn't copy"));
    };

    const loadConnections = () => {
        if (!currentOrg) return;
        api.get(`${base()}/connection`, hdr).then(r => setConnections(Array.isArray(r.data) ? r.data : [])).catch(() => setConnections([]));
    };
    const loadDomains = (connID: string) => {
        api.get(`${base()}/connection/${connID}/domain`, hdr).then(r => setDomains(p => ({ ...p, [connID]: Array.isArray(r.data) ? r.data : [] }))).catch(() => setDomains(p => ({ ...p, [connID]: [] })));
    };

    useEffect(() => { loadConnections(); }, [currentOrg]);
    useEffect(() => { connections.forEach(c => loadDomains(c.id)); /* eslint-disable-next-line */ }, [connections.length]);

    const applyPreset = (key: string) => {
        const p = PRESETS[key];
        setForm(f => ({ ...f, preset: key, name: p.label || f.name }));
    };

    const activePreset = PRESETS[form.preset] || PRESETS.generic;

    const createConnection = () => {
        if (!form.issuer.trim() || !form.client_id.trim()) { toast.error("Issuer and Client ID are required"); return; }
        api.post(`${base()}/connection`, {
            name: form.name.trim() || activePreset.label || "OIDC provider",
            protocol: "oidc",
            issuer: form.issuer.trim(),
            tenant_id: form.tenant_id.trim() || null,
            client_id: form.client_id.trim(),
            client_secret: form.client_secret || null,
            enabled: true,
        }, hdr)
            .then(() => { toast.success("Connection created"); setShowForm(false); setForm({ ...blankForm }); loadConnections(); })
            .catch(() => toast.error("Failed to create connection"));
    };

    const toggleEnabled = (c: Connection) => {
        api.put(`${base()}/connection/${c.id}`, { name: c.name, issuer: c.issuer, tenant_id: c.tenant_id || null, client_id: c.client_id, enabled: !c.enabled }, hdr)
            .then(loadConnections).catch(() => toast.error("Failed to update"));
    };
    const deleteConnection = (c: Connection) => {
        api.delete(`${base()}/connection/${c.id}`, hdr).then(() => { toast.success("Connection deleted"); loadConnections(); }).catch(() => toast.error("Failed to delete"));
    };
    const addDomain = (connID: string) => {
        const d = (newDomain[connID] || "").trim().toLowerCase();
        if (!d) return;
        api.post(`${base()}/connection/${connID}/domain`, { domain: d }, hdr)
            .then(r => { setTxtHint({ name: r.data.record_name, value: r.data.record_value }); setNewDomain(p => ({ ...p, [connID]: "" })); loadDomains(connID); })
            .catch(() => toast.error("Domain already claimed, or invalid"));
    };
    const verifyDomain = (connID: string, dom: Domain) => {
        api.post(`${base()}/connection/${connID}/domain/${dom.id}/verify`, null, hdr)
            .then(r => { r.data?.verified ? toast.success("Domain verified") : toast.error("TXT record not found yet — DNS can take a while"); loadDomains(connID); })
            .catch(() => toast.error("Verification failed"));
    };
    const deleteDomain = (connID: string, dom: Domain) => {
        api.delete(`${base()}/connection/${connID}/domain/${dom.id}`, hdr).then(() => loadDomains(connID)).catch(() => toast.error("Failed to delete domain"));
    };

    const CopyField = ({ label, value }: { label?: string; value: string }) => (
        <div className="sso-copy">
            {label ? <span className="sso-copy-label">{label}</span> : null}
            <code className="sso-copy-value">{value || "—"}</code>
            <button className="sso-btn" disabled={!value} onClick={() => copy(value)}><Icon name="copy" /> Copy</button>
        </div>
    );

    return (
        <Container help={SSO_HELP}>
            <ProtectedRoute permissions={[PERMISSIONS.ORGANISATION_MANAGE]}>
                <div className="header">Single Sign-On</div>

                {!currentOrg && <div className="sso-empty">SSO is configured per organisation — switch to an organisation to set it up.</div>}

                {currentOrg && (
                    <>
                        <div className="sso-actions">
                            <button className="sso-btn sso-btn--primary" onClick={() => { setForm({ ...blankForm }); setShowForm(v => !v); }}>
                                <Icon name="plus" /> New connection
                            </button>
                        </div>

                        {showForm && (
                            <div className="sso-card sso-form">
                                <label className="sso-label">Provider</label>
                                <div className="sso-presets">
                                    {Object.entries(PRESETS).map(([key, p]) => (
                                        <button key={key} className={`sso-preset ${form.preset === key ? "sso-preset--active" : ""}`} onClick={() => applyPreset(key)}>
                                            {p.label || "Generic OIDC"}
                                        </button>
                                    ))}
                                </div>
                                {activePreset.docs && (
                                    <a className="sso-docs-link" href={activePreset.docs} target="_blank" rel="noopener noreferrer">
                                        <Icon name="book" /> {activePreset.docsLabel || "Provider setup guide"} <Icon name="arrow-up-right-from-square" className="sso-docs-ext" />
                                    </a>
                                )}

                                <div className="sso-form-redirect">
                                    <label className="sso-label">Redirect URI <span className="sso-label-note">— register this in your provider (must match exactly)</span></label>
                                    <CopyField value={redirectUri} />
                                </div>

                                <label className="sso-label">Display name</label>
                                <input className="sso-input" placeholder="e.g. Okta" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />

                                <label className="sso-label">Issuer URL</label>
                                <input className="sso-input" placeholder={activePreset.issuerHint} value={form.issuer} onChange={e => setForm({ ...form, issuer: e.target.value })} />

                                {activePreset.tenant && (
                                    <>
                                        <label className="sso-label">Tenant ID <span className="sso-label-note">(Microsoft Entra only — pins the tenant)</span></label>
                                        <input className="sso-input" placeholder="00000000-0000-0000-0000-000000000000" value={form.tenant_id} onChange={e => setForm({ ...form, tenant_id: e.target.value })} />
                                    </>
                                )}

                                <label className="sso-label">Application (client) ID</label>
                                <input className="sso-input" value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })} />

                                <label className="sso-label">Client secret</label>
                                <input className="sso-input" type="password" value={form.client_secret} onChange={e => setForm({ ...form, client_secret: e.target.value })} />

                                {activePreset.note && <div className="sso-hint">{activePreset.note}</div>}

                                <div className="sso-form-actions">
                                    <button className="sso-btn" onClick={() => { setShowForm(false); setForm({ ...blankForm }); }}>Cancel</button>
                                    <button className="sso-btn sso-btn--primary" onClick={createConnection}>Create</button>
                                </div>
                            </div>
                        )}

                        {txtHint && (
                            <div className="sso-card sso-txt">
                                <div className="sso-txt-title"><Icon name="circle-info" /> Add this DNS TXT record, then click Verify</div>
                                <CopyField label="Host" value={txtHint.name} />
                                <CopyField label="Value" value={txtHint.value} />
                                <button className="sso-btn" onClick={() => setTxtHint(null)}>Dismiss</button>
                            </div>
                        )}

                        {connections.length === 0 && !showForm && (
                            <div className="sso-empty">No SSO connections yet. Add one to let your team sign in with your identity provider.</div>
                        )}

                        {connections.map(c => (
                            <div key={c.id} className="sso-card">
                                <div className="sso-conn-head">
                                    <Icon name="lock" className="sso-conn-icon" />
                                    <div className="sso-conn-title">
                                        <div className="sso-conn-name">{c.name || "OIDC provider"}</div>
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
                                        <input className="sso-input" placeholder="example.gov.uk" value={newDomain[c.id] || ""} onChange={e => setNewDomain(p => ({ ...p, [c.id]: e.target.value }))} />
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
