import type {Route} from "../+types/home";
import Container from "~/components/container";
import React, {useEffect, useRef, useState} from "react";
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

type Tab = "account" | "security" | "identities" | "communications";

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
const CHANNEL_OPTIONS: { value: string; label: string; description: string; icon: string; inputPlaceholder?: string; oauth?: { provider: string; label: string } }[] = [
    { value: "slack", label: "Slack", description: "Workspace messages, mentions, and DMs", icon: "slack", oauth: { provider: "slack", label: "Connect with Slack" } },
    { value: "telegram", label: "Telegram", description: "Telegram bot conversations", icon: "telegram", inputPlaceholder: "@yourhandle or numeric chat ID (e.g. 123456789)" },
    { value: "microsoft", label: "Microsoft", description: "Teams, Outlook, and other Microsoft surfaces", icon: "microsoft", oauth: { provider: "microsoft", label: "Connect with Microsoft" } },
    { value: "email", label: "Google", description: "Email-based interactions via your Google account", icon: "google", oauth: { provider: "google", label: "Connect with Google" } },
    { value: "facebook_messenger", label: "Facebook", description: "Facebook Messenger conversations", icon: "facebook", oauth: { provider: "facebook", label: "Connect with Facebook" } },
    { value: "mobile", label: "Mobile", description: "SMS or voice — your choice at verification time", icon: "phone", inputPlaceholder: "Phone number in international format (e.g. +447700900123)" },
    { value: "phone", label: "Phone", description: "Voice calls only (typically a landline)", icon: "phone-volume", inputPlaceholder: "Phone number in international format (e.g. +442079460000)" },
    { value: "linkedin", label: "LinkedIn", description: "LinkedIn messages, posts, and comments", icon: "linkedin", oauth: { provider: "linkedin", label: "Connect with LinkedIn" } },
];

type ChannelOption = typeof CHANNEL_OPTIONS[number];

// Rich dropdown for the channel-type picker on the Identities tab. The
// native <select> can't render per-option icons or descriptions, so this
// is a small co-located component: a trigger button showing the
// currently-selected option, and a popover panel rendering icon + label
// + description per row. Click-outside and ESC close the panel.
function ChannelTypeDropdown({ value, options, onChange }: {
    value: string;
    options: ChannelOption[];
    onChange: (v: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const selected = options.find(o => o.value === value) ?? options[0];

    useEffect(() => {
        if (!open) return;
        const onDocMouseDown = (e: MouseEvent) => {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("mousedown", onDocMouseDown);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDocMouseDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    return (
        <div className="rich-dropdown" ref={rootRef}>
            <button
                type="button"
                className="rich-dropdown__trigger"
                onClick={() => setOpen(o => !o)}
                aria-haspopup="listbox"
                aria-expanded={open}
            >
                <Icon name={selected.icon} />
                <span className="rich-dropdown__trigger-label">{selected.label}</span>
                <Icon name={open ? "chevron-up" : "chevron-down"} />
            </button>
            {open && (
                <div className="rich-dropdown__panel" role="listbox">
                    {options.map(o => (
                        <button
                            key={o.value}
                            type="button"
                            role="option"
                            aria-selected={o.value === value}
                            className={`rich-dropdown__option${o.value === value ? " rich-dropdown__option--selected" : ""}`}
                            onClick={() => { onChange(o.value); setOpen(false); }}
                        >
                            <span className="rich-dropdown__option-icon"><Icon name={o.icon} /></span>
                            <span className="rich-dropdown__option-text">
                                <span className="rich-dropdown__option-label">{o.label}</span>
                                <span className="rich-dropdown__option-description">{o.description}</span>
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

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
    // Extended profile fields — surfaced in flows as ${user.X}. State
    // mirrors the AuthUser so the form is editable without round-
    // tripping through auth.setUser on every keystroke.
    const [salutation, setSalutation] = useState<string>("");
    const [firstName, setFirstName] = useState<string>("");
    const [lastName, setLastName] = useState<string>("");
    const [jobTitle, setJobTitle] = useState<string>("");
    const [addressLine1, setAddressLine1] = useState<string>("");
    const [addressLine2, setAddressLine2] = useState<string>("");
    const [city, setCity] = useState<string>("");
    const [region, setRegion] = useState<string>("");
    const [postcode, setPostcode] = useState<string>("");
    const [country, setCountry] = useState<string>("");
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

    // Sync personal-detail state when the user loads or is refreshed
    // (e.g. after saveProfile updates auth.setUser).
    useEffect(() => {
        setSalutation(user?.salutation || "");
        setFirstName(user?.first_name || "");
        setLastName(user?.last_name || "");
        setJobTitle(user?.job_title || "");
        setAddressLine1(user?.address_line_1 || "");
        setAddressLine2(user?.address_line_2 || "");
        setCity(user?.city || "");
        setRegion(user?.region || "");
        setPostcode(user?.postcode || "");
        setCountry(user?.country || "");
    }, [user]);

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
                    // Merge over the existing user rather than replace.
                    // Any field the server omits (omitempty drops nil
                    // pointer timestamps like onboarding_completed_at /
                    // welcome_completed_at) keeps its prior value, so
                    // unrelated client-side state isn't clobbered by a
                    // save that didn't touch those columns.
                    auth.setUser({ ...user, ...response.data });
                    showToast("Profile saved", "success");
                }
            })
            .catch(() => showToast("Failed to save profile", "error"));
    };

    // Personal details + address — separate save path because the
    // server uses a dedicated UpdateUserProfile statement that touches
    // only profile columns. Display name continues to flow through the
    // existing saveProfile/UpdateUser path so we don't conflate writes.
    const savePersonalDetails = () => {
        if (!user) return;
        const url = config("AUTOMATE_API_URL");
        const payload = {
            salutation, first_name: firstName, last_name: lastName,
            job_title: jobTitle,
            address_line_1: addressLine1, address_line_2: addressLine2,
            city, region, postcode, country,
        };

        api.put(url + "/api/v1/user/profile", payload, {
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }
        })
            .then(response => {
                if (response) {
                    // Merge, don't replace — this endpoint re-reads the
                    // user from the DB before returning, so a naive
                    // replace would clobber optimistic client state
                    // (the prime offender being `onboarding_completed_at`
                    // after Skip — see TutorialProvider).
                    auth.setUser({ ...user, ...response.data });
                    showToast("Personal details saved", "success");
                }
            })
            .catch(() => showToast("Failed to save personal details", "error"));
    };

    // Marketing opt-in toggle on the Communications tab. The optimistic
    // update lets the switch flip instantly; on failure we roll back
    // and surface a toast. EmailOctopus sync happens server-side via
    // the retry poller — the user's UI never waits on EO.
    const setMarketingOptIn = (next: boolean) => {
        if (!user || !token) return;
        const previous = user.marketing_opt_in ?? false;
        auth.setUser({ ...user, marketing_opt_in: next });

        const url = config("AUTOMATE_API_URL");
        api.post(
            url + "/api/v1/user/marketing-opt-in",
            { marketing_opt_in: next },
            { headers: { "Content-Type": "application/json", Authorization: "Bearer " + token } }
        )
            .then(() => {
                showToast(
                    next ? "You're subscribed to marketing updates" : "You've unsubscribed",
                    "success"
                );
            })
            .catch(() => {
                auth.setUser({ ...user, marketing_opt_in: previous });
                showToast("Couldn't update preference, please try again", "error");
            });
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
                    <button
                        className={`profile-tab ${activeTab === "communications" ? "active" : ""}`}
                        onClick={() => setActiveTab("communications")}
                    >
                        <Icon name="envelope" /> Communications
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

                        <div className="profile-card">
                            <div className="profile-section-label">Personal Details</div>
                            <div className="profile-section-desc">
                                These fields are available within flows as <code>{"${user.salutation}"}</code>,
                                <code>{" ${user.first_name}"}</code>, <code>{" ${user.full_name}"}</code> etc.
                            </div>

                            <div className="profile-field">
                                <label className="profile-label">Salutation</label>
                                <select
                                    className="profile-input"
                                    value={salutation}
                                    onChange={e => setSalutation(e.target.value)}
                                >
                                    <option value="">—</option>
                                    <option value="Mr">Mr</option>
                                    <option value="Mrs">Mrs</option>
                                    <option value="Ms">Ms</option>
                                    <option value="Mx">Mx</option>
                                    <option value="Dr">Dr</option>
                                    <option value="Prof">Prof</option>
                                </select>
                            </div>

                            <div className="profile-field-row">
                                <div className="profile-field">
                                    <label className="profile-label">First Name</label>
                                    <input
                                        type="text"
                                        className="profile-input"
                                        placeholder="First name"
                                        value={firstName}
                                        onChange={e => setFirstName(e.target.value)}
                                    />
                                </div>
                                <div className="profile-field">
                                    <label className="profile-label">Last Name</label>
                                    <input
                                        type="text"
                                        className="profile-input"
                                        placeholder="Last name"
                                        value={lastName}
                                        onChange={e => setLastName(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="profile-field">
                                <label className="profile-label">Job Title</label>
                                <input
                                    type="text"
                                    className="profile-input"
                                    placeholder="Software Engineer"
                                    value={jobTitle}
                                    onChange={e => setJobTitle(e.target.value)}
                                />
                            </div>

                            <div className="profile-section-label profile-section-label--inline">Address</div>
                            <div className="profile-section-desc">
                                Available individually (e.g. <code>{"${user.city}"}</code>) or pre-formatted
                                as <code>{"${user.full_address}"}</code>.
                            </div>

                            <div className="profile-field">
                                <label className="profile-label">Address Line 1</label>
                                <input
                                    type="text"
                                    className="profile-input"
                                    placeholder="Street and number"
                                    value={addressLine1}
                                    onChange={e => setAddressLine1(e.target.value)}
                                />
                            </div>
                            <div className="profile-field">
                                <label className="profile-label">Address Line 2</label>
                                <input
                                    type="text"
                                    className="profile-input"
                                    placeholder="Apartment, suite, etc. (optional)"
                                    value={addressLine2}
                                    onChange={e => setAddressLine2(e.target.value)}
                                />
                            </div>
                            <div className="profile-field-row">
                                <div className="profile-field">
                                    <label className="profile-label">City</label>
                                    <input
                                        type="text"
                                        className="profile-input"
                                        placeholder="City"
                                        value={city}
                                        onChange={e => setCity(e.target.value)}
                                    />
                                </div>
                                <div className="profile-field">
                                    <label className="profile-label">Region / County</label>
                                    <input
                                        type="text"
                                        className="profile-input"
                                        placeholder="County or state"
                                        value={region}
                                        onChange={e => setRegion(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="profile-field-row">
                                <div className="profile-field">
                                    <label className="profile-label">Postcode</label>
                                    <input
                                        type="text"
                                        className="profile-input"
                                        placeholder="SW1A 2AA"
                                        value={postcode}
                                        onChange={e => setPostcode(e.target.value)}
                                    />
                                </div>
                                <div className="profile-field">
                                    <label className="profile-label">Country</label>
                                    <input
                                        type="text"
                                        className="profile-input"
                                        placeholder="United Kingdom"
                                        value={country}
                                        onChange={e => setCountry(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="profile-actions">
                                <button className="profile-btn profile-btn--primary" onClick={savePersonalDetails} disabled={!user}>
                                    <Icon name="floppy-disk" /> Save Personal Details
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
                                        <ChannelTypeDropdown
                                            value={newIdentity.channel_type}
                                            options={CHANNEL_OPTIONS}
                                            onChange={v => setNewIdentity(s => ({ ...s, channel_type: v }))}
                                        />
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
                                                        placeholder={channel.inputPlaceholder ?? "External ID"}
                                                        value={newIdentity.external_id}
                                                        onChange={e => setNewIdentity(s => ({ ...s, external_id: e.target.value }))}
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

                {activeTab === "communications" && (
                    <div className="profile-card">
                        <div className="profile-section-label">Marketing Emails</div>
                        <div className="profile-meta" style={{ marginBottom: 16 }}>
                            Occasional product updates and tips. We'll never share your email with anyone, and you can unsubscribe at any time.
                        </div>
                        <div
                            className="profile-field"
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 16,
                            }}
                        >
                            <div>
                                <div style={{ fontSize: 14, color: "rgba(255,255,255,0.85)" }}>
                                    {user?.marketing_opt_in
                                        ? "You're subscribed to marketing updates"
                                        : "You're not subscribed"}
                                </div>
                                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 4 }}>
                                    {user?.email_address || "—"}
                                </div>
                            </div>
                            <label style={{ display: "inline-flex", alignItems: "center", cursor: "pointer", gap: 8 }}>
                                <input
                                    type="checkbox"
                                    checked={user?.marketing_opt_in ?? false}
                                    onChange={(e) => setMarketingOptIn(e.target.checked)}
                                    style={{ width: 18, height: 18, accentColor: "#c084fc", cursor: "pointer" }}
                                />
                                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.8)" }}>
                                    {user?.marketing_opt_in ? "Subscribed" : "Subscribe"}
                                </span>
                            </label>
                        </div>
                    </div>
                )}
            </div>
        </Container>
    );
}
