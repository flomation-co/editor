import type {Route} from "../+types/home";
import Container from "~/components/container";
import React, {useEffect, useState} from "react";
import {useAuth} from "~/context/auth/use";
import {useOrganisation} from "~/context/organisation/use";
import type {AuthUser} from "~/types";
import api from "~/lib/api";
import useConfig from "~/components/config";
import useCookieToken from "~/components/cookie";
import {useToast} from "~/components/toast";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";
import "./index.css";
import { Icon } from "~/components/icons/Icon";

dayjs.extend(relativeTime);
dayjs.extend(utc);

type Tab = "account" | "security" | "identities";

type UserIdentity = {
    user_id: string;
    organisation_id: string | null;
    channel_type: string;
    external_id: string;
    display_name?: string | null;
    verified_at?: string | null;
    created_at: string;
};

// Channel types that an end-user can sensibly declare an identity for.
// Drives the dropdown in the "Add identity" form and the per-row icon.
//
// The `oauth` field, when set, names the OAuth provider that resolves
// this channel's external_id via a popup flow instead of a typed input.
// Channels without oauth still use the typed external_id input.
// (R3 Phase 2 lands Google; the others come in follow-up commits.)
const CHANNEL_OPTIONS: { value: string; label: string; icon: string; oauth?: { provider: string; label: string } }[] = [
    { value: "slack", label: "Slack", icon: "slack", oauth: { provider: "slack", label: "Connect with Slack" } },
    { value: "telegram", label: "Telegram", icon: "telegram" },
    { value: "teams", label: "Microsoft Teams", icon: "microsoft", oauth: { provider: "microsoft", label: "Connect with Microsoft" } },
    { value: "email", label: "Google", icon: "google", oauth: { provider: "google", label: "Connect with Google" } },
    { value: "facebook_messenger", label: "Facebook Messenger", icon: "facebook" },
    { value: "mobile", label: "Mobile", icon: "phone" },
    { value: "phone", label: "Phone", icon: "phone-volume" },
    { value: "linkedin", label: "LinkedIn", icon: "linkedin" },
];

type LoginEntry = {
    id: string;
    ip_address: string | null;
    device: string | null;
    location: string | null;
    first_seen_at: string;
    last_seen_at: string;
};

export function meta({}: Route.MetaArgs) {
    return [
        { title: "Flomation - Profile" },
        { name: "description", content: "Manage your profile" },
    ];
}

function parseUserAgent(ua: string | null): string {
    if (!ua) return "Unknown device";

    let browser = "Unknown browser";
    if (ua.includes("Firefox/")) browser = "Firefox";
    else if (ua.includes("Edg/")) browser = "Edge";
    else if (ua.includes("Chrome/")) browser = "Chrome";
    else if (ua.includes("Safari/") && !ua.includes("Chrome")) browser = "Safari";
    else if (ua.includes("curl/")) browser = "curl";

    let os = "Unknown OS";
    if (ua.includes("Windows")) os = "Windows";
    else if (ua.includes("Macintosh") || ua.includes("Mac OS")) os = "macOS";
    else if (ua.includes("Linux")) os = "Linux";
    else if (ua.includes("Android")) os = "Android";
    else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";

    return `${browser} on ${os}`;
}

export default function Profile() {
    const config = useConfig();
    const auth = useAuth();
    const { currentOrg } = useOrganisation();
    const token = useCookieToken();
    const { showToast } = useToast();

    const [user, setUser] = useState<AuthUser | null>();
    const [name, setName] = useState<string>("");
    const [activeTab, setActiveTab] = useState<Tab>("account");
    const [loginHistory, setLoginHistory] = useState<LoginEntry[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [identities, setIdentities] = useState<UserIdentity[]>([]);
    const [loadingIdentities, setLoadingIdentities] = useState(false);
    // Identity declarations target the currently-selected organisation in
    // the header context. Personal mode (currentOrg=null) shows an empty
    // state instead of the form, since identities are inherently org-scoped
    // per migration 83.
    const [newIdentity, setNewIdentity] = useState<{ channel_type: string; external_id: string; display_name: string }>({
        channel_type: "slack",
        external_id: "",
        display_name: "",
    });

    useEffect(() => { setUser(auth.user); }, [auth]);
    useEffect(() => { setName(user?.name || ""); }, [user]);

    useEffect(() => {
        if (activeTab !== "security" || !token) return;
        setLoadingHistory(true);
        const loginUrl = config("LOGIN_URL");
        api.get(loginUrl + "/api/sessions", {
            headers: { Authorization: "Bearer " + token },
        })
            .then(res => setLoginHistory(res.data || []))
            .catch(() => setLoginHistory([]))
            .finally(() => setLoadingHistory(false));
    }, [activeTab, token]);

    const reloadIdentities = () => {
        if (!token) return;
        setLoadingIdentities(true);
        const url = config("AUTOMATE_API_URL");
        api.get(url + "/api/v1/user/identity", {
            headers: { Authorization: "Bearer " + token },
        })
            .then(res => setIdentities(res.data || []))
            .catch(() => setIdentities([]))
            .finally(() => setLoadingIdentities(false));
    };

    useEffect(() => {
        if (activeTab !== "identities" || !token) return;
        reloadIdentities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, token, currentOrg?.id]);

    const addIdentity = () => {
        if (!token) return;
        if (!newIdentity.channel_type || !newIdentity.external_id.trim()) {
            showToast("Channel and external ID are required", "error");
            return;
        }
        const url = config("AUTOMATE_API_URL");
        api.post(url + "/api/v1/user/identity", {
            // currentOrg=null → personal mode (org omitted; backend stores NULL).
            organisation_id: currentOrg?.id ?? null,
            channel_type: newIdentity.channel_type,
            external_id: newIdentity.external_id.trim(),
            display_name: newIdentity.display_name.trim() || undefined,
        }, {
            headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        })
            .then(() => {
                showToast("Identity added", "success");
                setNewIdentity(s => ({ ...s, external_id: "", display_name: "" }));
                reloadIdentities();
            })
            .catch(err => {
                const status = err?.response?.status;
                if (status === 409) {
                    showToast("That identity is already declared", "error");
                } else if (status === 403) {
                    showToast("You are not a member of that organisation", "error");
                } else {
                    showToast("Failed to add identity", "error");
                }
            });
    };

    // Opens the Launch identity OAuth popup for the channel's configured
    // provider. The popup completes the OAuth flow at the provider, Launch
    // writes the resolved user_identity row via its internal API endpoint,
    // and the popup closes — we poll for that closure here and refetch.
    const startOAuthIdentity = (channelType: string, provider: string) => {
        if (!token) return;
        // Prefer the locally-reachable TRIGGER_URL for the popup
        // navigation (browser → Launch is direct, no public DNS needed)
        // and fall back to LAUNCH_URL (the public OAuth callback URL).
        // In production both keys hold the same value; in local dev
        // TRIGGER_URL points at http://localhost:9999 and LAUNCH_URL
        // points at the ngrok tunnel so the OAuth provider can call
        // back. The redirect_uri sent to the OAuth provider is still
        // built server-side from public_url.
        const launchUrl = config("TRIGGER_URL", "") || config("LAUNCH_URL", "");
        if (!launchUrl) {
            showToast("Neither TRIGGER_URL nor LAUNCH_URL is configured — set them in run-config.js", "error");
            return;
        }
        const params = new URLSearchParams({ channel_type: channelType });
        if (currentOrg) {
            params.set("organisation_id", currentOrg.id);
        }
        // Cookie-based auth works in production where editor and Launch
        // share a parent domain. In dev (cross-origin) the cookie can't
        // reach Launch, so we additionally pass the JWT as a query
        // parameter and Launch falls back to it.
        params.set("token", token);
        const url = `${launchUrl}/auth/${provider}/identity?${params.toString()}`;
        const popup = window.open(url, `${provider}-identity-oauth`, "width=500,height=700,scrollbars=yes");
        if (!popup) {
            showToast("Could not open OAuth popup — check your browser's popup blocker", "error");
            return;
        }
        const timer = setInterval(() => {
            if (popup.closed) {
                clearInterval(timer);
                // The popup writes the identity server-side via Launch → API,
                // so we just refetch to surface the new row (or no change if
                // the user cancelled the consent screen).
                setTimeout(() => reloadIdentities(), 500);
            }
        }, 500);
    };

    const deleteIdentity = (i: UserIdentity) => {
        if (!token) return;
        const url = config("AUTOMATE_API_URL");
        // Empty organisation_id query param targets a personal-mode row
        // on the backend (the COALESCE-based WHERE clause treats '' == NULL).
        const qs = new URLSearchParams({
            organisation_id: i.organisation_id ?? "",
            channel_type: i.channel_type,
            external_id: i.external_id,
        }).toString();
        api.delete(url + "/api/v1/user/identity?" + qs, {
            headers: { Authorization: "Bearer " + token },
        })
            .then(() => {
                showToast("Identity removed", "success");
                reloadIdentities();
            })
            .catch(() => showToast("Failed to remove identity", "error"));
    };

    const openMFA = () => {
        window.location.replace(config("LOGIN_URL") + "/mfa");
    };

    const openPasskeys = () => {
        window.location.replace(config("LOGIN_URL") + "/passkeys");
    };

    const saveProfile = () => {
        if (!user) return;
        const url = config("AUTOMATE_API_URL");
        const updatedUser = { ...user, name: name || "" };

        api.post(url + '/api/v1/user/' + updatedUser.id, updatedUser, {
            headers: { 'Content-Type': 'application/json', Authorization: "Bearer " + token }
        })
            .then(response => {
                if (response) {
                    auth.setUser(response.data);
                    showToast("Profile saved", "success");
                }
            })
            .catch(() => showToast("Failed to save profile", "error"));
    };

    return (
        <Container>
            <div className={"header"}>Settings</div>

            <div className="profile-page">
                <div className="profile-tabs">
                    <button
                        className={`profile-tab ${activeTab === "account" ? "active" : ""}`}
                        onClick={() => setActiveTab("account")}
                    >
                        <Icon name="user" /> Account
                    </button>
                    <button
                        className={`profile-tab ${activeTab === "security" ? "active" : ""}`}
                        onClick={() => setActiveTab("security")}
                    >
                        <Icon name="shield-halved" /> Security
                    </button>
                    <button
                        className={`profile-tab ${activeTab === "identities" ? "active" : ""}`}
                        onClick={() => setActiveTab("identities")}
                    >
                        <Icon name="address-card" /> Identities
                    </button>
                </div>

                {activeTab === "account" && (
                    <>
                        <div className="profile-card">
                            <div className="profile-section-label">Account Details</div>

                            <div className="profile-field">
                                <label className="profile-label">Display Name</label>
                                <input
                                    type="text"
                                    className="profile-input"
                                    placeholder="Display Name"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                />
                            </div>

                            <div className="profile-field">
                                <label className="profile-label">Email Address</label>
                                <input
                                    type="email"
                                    className="profile-input profile-input--disabled"
                                    disabled
                                    placeholder="Email Address"
                                    value={user?.email_address || ""}
                                />
                            </div>

                            {user?.created_at && (
                                <div className="profile-meta">
                                    Registered {dayjs.utc(user.created_at).fromNow()}
                                </div>
                            )}

                            <div className="profile-actions">
                                <button className="profile-btn profile-btn--primary" onClick={saveProfile} disabled={!user}>
                                    <Icon name="floppy-disk" /> Save
                                </button>
                            </div>
                        </div>
                    </>
                )}

                {activeTab === "security" && (
                    <>
                        <div className="profile-card">
                            <div className="profile-section-label">Multi-Factor Authentication</div>
                            <div className="profile-field">
                                <div className="profile-security-row">
                                    <div className="profile-security-info">
                                        <div className="profile-security-title">TOTP Authenticator</div>
                                        <div className="profile-security-desc">Add an extra layer of security to your account with a time-based one-time password</div>
                                    </div>
                                    <button className="profile-btn profile-btn--secondary" onClick={openMFA} disabled={!user}>
                                        <Icon name="shield-halved" /> Manage MFA
                                    </button>
                                </div>
                            </div>
                            <div className="profile-field">
                                <div className="profile-security-row">
                                    <div className="profile-security-info">
                                        <div className="profile-security-title">Passkeys</div>
                                        <div className="profile-security-desc">Sign in with your fingerprint, face, or security key — no password required</div>
                                    </div>
                                    <button className="profile-btn profile-btn--secondary" onClick={openPasskeys} disabled={!user}>
                                        <Icon name="key" /> Manage Passkeys
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="profile-card">
                            <div className="profile-section-label">Login History</div>

                            {loadingHistory && (
                                <div className="profile-meta">Loading...</div>
                            )}

                            {!loadingHistory && loginHistory.length === 0 && (
                                <div className="profile-meta">No login history available</div>
                            )}

                            {!loadingHistory && loginHistory.length > 0 && (
                                <div className="login-history">
                                    {loginHistory.map(entry => (
                                        <div key={entry.id} className="login-entry">
                                            <div className="login-entry-icon">
                                                <Icon name="globe" />
                                            </div>
                                            <div className="login-entry-details">
                                                <div className="login-entry-device">
                                                    {parseUserAgent(entry.device)}
                                                </div>
                                                <div className="login-entry-meta">
                                                    <span className="login-entry-location">
                                                        {entry.location || "Unknown location"}
                                                    </span>
                                                    <span className="login-entry-separator">&middot;</span>
                                                    <span className="login-entry-ip">
                                                        {entry.ip_address || "Unknown IP"}
                                                    </span>
                                                </div>
                                                <div className="login-entry-time">
                                                    Last seen {dayjs.utc(entry.last_seen_at).fromNow()}
                                                    {entry.first_seen_at !== entry.last_seen_at && (
                                                        <> &middot; First seen {dayjs.utc(entry.first_seen_at).fromNow()}</>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}

                {activeTab === "identities" && (
                    <>
                        {(() => {
                            const scopeLabel = currentOrg ? currentOrg.name : "your personal account";
                            // Personal-mode rows arrive with organisation_id either explicitly
                            // null (current API) or undefined (older API that omitted the field
                            // via json:",omitempty") — match both so a server version skew
                            // can't hide the row entirely.
                            const visibleIdentities = identities.filter(i =>
                                currentOrg ? i.organisation_id === currentOrg.id : !i.organisation_id
                            );
                            return (
                            <>
                                <div className="profile-card">
                                    <div className="profile-section-label">Declare a Channel Identity in {scopeLabel}</div>
                                    <div className="profile-meta" style={{ marginBottom: 12 }}>
                                        {currentOrg
                                            ? "Agents in this organisation will recognise you by the channel handles you declare here. Switch organisations in the header to manage identities elsewhere."
                                            : "Your personal agents will recognise you by the channel handles you declare here. Switch to an organisation in the header to manage identities there."}
                                    </div>
                                    <div className="profile-field" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                        <select
                                            className="profile-input"
                                            value={newIdentity.channel_type}
                                            onChange={e => setNewIdentity(s => ({ ...s, channel_type: e.target.value }))}
                                        >
                                            {CHANNEL_OPTIONS.map(o => (
                                                <option key={o.value} value={o.value}>{o.label}</option>
                                            ))}
                                        </select>
                                        {(() => {
                                            const channel = CHANNEL_OPTIONS.find(o => o.value === newIdentity.channel_type);
                                            if (channel?.oauth) {
                                                // OAuth channel: external_id + display_name are resolved by the provider, no typed input.
                                                return (
                                                    <button
                                                        className="profile-btn profile-btn--primary"
                                                        onClick={() => startOAuthIdentity(newIdentity.channel_type, channel.oauth!.provider)}
                                                        style={{ alignSelf: "flex-start" }}
                                                    >
                                                        <Icon name={channel.icon} /> {channel.oauth.label}
                                                    </button>
                                                );
                                            }
                                            // Typed flow for channels not yet wired through OAuth.
                                            return (
                                                <>
                                                    <input
                                                        className="profile-input"
                                                        placeholder="External ID (e.g. U01ABC, @yourhandle, you@example.com)"
                                                        value={newIdentity.external_id}
                                                        onChange={e => setNewIdentity(s => ({ ...s, external_id: e.target.value }))}
                                                    />
                                                    <input
                                                        className="profile-input"
                                                        placeholder="Display name (optional)"
                                                        value={newIdentity.display_name}
                                                        onChange={e => setNewIdentity(s => ({ ...s, display_name: e.target.value }))}
                                                    />
                                                    <button
                                                        className="profile-btn profile-btn--primary"
                                                        onClick={addIdentity}
                                                        style={{ alignSelf: "flex-start" }}
                                                    >
                                                        <Icon name="plus" /> Add Identity
                                                    </button>
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>

                                <div className="profile-card">
                                    <div className="profile-section-label">Declared in {scopeLabel}</div>
                                    {loadingIdentities && (
                                        <div className="profile-meta">Loading...</div>
                                    )}
                                    {!loadingIdentities && visibleIdentities.length === 0 && (
                                        <div className="profile-meta">
                                            {currentOrg ? "No identities declared in this organisation yet." : "No personal identities declared yet."}
                                        </div>
                                    )}
                                    {!loadingIdentities && visibleIdentities.length > 0 && (
                                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                            {visibleIdentities.map(i => {
                                                const channel = CHANNEL_OPTIONS.find(o => o.value === i.channel_type);
                                                return (
                                                    <div key={`${i.channel_type}-${i.external_id}`} style={{
                                                        display: "flex", alignItems: "center", justifyContent: "space-between",
                                                        padding: "8px 12px", background: "rgba(255,255,255,0.03)",
                                                        border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6,
                                                    }}>
                                                        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                                                            <Icon name={channel?.icon || "address-card"} />
                                                            <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                                                                <span style={{ fontWeight: 500 }}>{channel?.label || i.channel_type}</span>
                                                                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                                    {i.external_id}
                                                                    {i.display_name && <> &middot; {i.display_name}</>}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <button
                                                            className="profile-btn profile-btn--secondary"
                                                            onClick={() => deleteIdentity(i)}
                                                            title="Remove"
                                                        >
                                                            <Icon name="trash" />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </>
                            );
                        })()}
                    </>
                )}
            </div>
        </Container>
    );
}
