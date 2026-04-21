import type {Route} from "../+types/home";
import Container from "~/components/container";
import React, {useEffect, useState} from "react";
import {useAuth} from "~/context/auth/use";
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

type Tab = "account" | "security";

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
    const token = useCookieToken();
    const { showToast } = useToast();

    const [user, setUser] = useState<AuthUser | null>();
    const [name, setName] = useState<string>("");
    const [activeTab, setActiveTab] = useState<Tab>("account");
    const [loginHistory, setLoginHistory] = useState<LoginEntry[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

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

    const openMFA = () => {
        window.location.replace(config("LOGIN_URL") + "/mfa");
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
            </div>
        </Container>
    );
}
