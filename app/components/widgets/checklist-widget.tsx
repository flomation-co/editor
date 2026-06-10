import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "~/context/auth/use";
import { useOrganisation } from "~/context/organisation/use";
import useConfig from "~/components/config";
import useCookieToken from "~/components/cookie";
import api from "~/lib/api";
import { Icon } from "~/components/icons/Icon";
import ShareModal from "~/components/shareModal";
import "./checklist-widget.css";

// Bitmask flags — must match the API's catalogue in onboarding.go.
// Split into two scopes:
//
//   GLOBAL bits track properties of the human (profile name, MFA) —
//   one value across every org context.
//
//   ORG-SCOPED bits track work the user has done in a specific
//   (user, org) context (created a flow, executed one, configured an
//   environment, invited their team) — these are per-org and reset
//   when the user switches between Personal mode and an organisation.
const FLAG_PROFILE_NAME   = 1;
const FLAG_CREATE_FLOW    = 2;
const FLAG_EXECUTE_FLOW   = 4;
const FLAG_CONFIGURE_ENV  = 8;
const FLAG_INVITE_TEAM    = 16;
const FLAG_ENABLE_MFA     = 32;

const GLOBAL_MASK = FLAG_PROFILE_NAME | FLAG_ENABLE_MFA;
const ALL_FLAGS = FLAG_PROFILE_NAME | FLAG_CREATE_FLOW | FLAG_EXECUTE_FLOW | FLAG_CONFIGURE_ENV | FLAG_INVITE_TEAM | FLAG_ENABLE_MFA;

interface ChecklistItem {
    flag: number;
    label: string;
    description: string;
    link?: string;
    linkLabel?: string;
    icon: string;
    action?: "share";
}

const ITEMS: ChecklistItem[] = [
    {
        flag: FLAG_PROFILE_NAME,
        label: "Update Your Profile Name",
        description: "Set your display name so your team knows who you are.",
        link: "/profile",
        linkLabel: "Go to Profile",
        icon: "user",
    },
    {
        flag: FLAG_CREATE_FLOW,
        label: "Create Your First Flow",
        description: "Build an automation by connecting nodes together.",
        link: "/flow",
        linkLabel: "Go to Flows",
        icon: "arrows-split-up-and-left",
    },
    {
        flag: FLAG_EXECUTE_FLOW,
        label: "Execute a Flow",
        description: "Run a flow and see it in action.",
        icon: "play",
    },
    {
        flag: FLAG_CONFIGURE_ENV,
        label: "Configure an Environment",
        description: "Set up variables and secrets for your flows.",
        link: "/environments",
        linkLabel: "Go to Environments",
        icon: "layer-group",
    },
    {
        flag: FLAG_INVITE_TEAM,
        label: "Invite Your Team",
        description: "Share Flomation with your colleagues and start collaborating.",
        icon: "user-group",
        action: "share",
    },
    {
        flag: FLAG_ENABLE_MFA,
        label: "Enable MFA",
        description: "Add an authenticator app to protect your account with additional security",
        // Linked to Sentinel rather than the editor — MFA setup is owned
        // by the identity service. The link is rewritten at render time
        // using config(\"LOGIN_URL\") below.
        link: "/mfa",
        linkLabel: "Set up MFA",
        icon: "shield-halved",
    },
];

// dismissalKey returns the localStorage key used to remember a
// dismissed widget. Per-org so dismissing in Personal mode doesn't
// suppress the widget in an org context, and vice versa.
function dismissalKey(orgID: string | null | undefined): string {
    return `flomation-checklist-dismissed:${orgID ?? "personal"}`;
}

export default function ChecklistWidget() {
    const { user, setUser, token } = useAuth();
    const { currentOrg } = useOrganisation();
    const config = useConfig();
    const cookieToken = useCookieToken();

    // Effective flags are loaded from the API for the current
    // (user, org) context. The widget renders these directly; toggles
    // update both this local copy (for instant feedback) and the API
    // (for persistence).
    const [flags, setFlags] = useState(0);
    const [showShare, setShowShare] = useState(false);
    const [detected, setDetected] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const currentOrgID = currentOrg?.id ?? null;

    // Dismissal state is per-org: dismiss in Personal, still see it
    // when you switch to Org X for the first time. Re-evaluated on
    // every org switch.
    useEffect(() => {
        if (typeof window === "undefined") return;
        setDismissed(localStorage.getItem(dismissalKey(currentOrgID)) === "true");
    }, [currentOrgID]);

    // Load the combined effective flags for the current (user, org).
    // Re-fires on every org switch so the widget reflects the new
    // context immediately — no stale ticked items leaking across.
    useEffect(() => {
        if (!user || !token) return;
        const url = config("AUTOMATE_API_URL");
        const tkn = cookieToken || token;
        const headers = { Authorization: "Bearer " + tkn };
        const params = currentOrgID ? `?organisation_id=${encodeURIComponent(currentOrgID)}` : "";
        api.get(`${url}/api/v1/user/checklist${params}`, { headers })
            .then(res => {
                if (typeof res.data?.checklist_flags === "number") {
                    setFlags(res.data.checklist_flags);
                }
            })
            .catch(() => {
                // Fallback to the user row's global bits so the
                // widget still renders something usable if the new
                // endpoint isn't deployed yet.
                setFlags((user.checklist_flags ?? 0) & GLOBAL_MASK);
            });
        setDetected(false);
    }, [user?.id, currentOrgID, token]);

    // Auto-detect completed items on mount (except invite/share)
    useEffect(() => {
        if (!user || detected) return;
        setDetected(true);

        const url = config("AUTOMATE_API_URL");
        const tkn = cookieToken || token;
        const headers = { Authorization: "Bearer " + tkn };
        const currentFlags = flags;
        let newFlags = currentFlags;

        const checks: Promise<void>[] = [];

        if (!(currentFlags & FLAG_PROFILE_NAME)) {
            if (user.name && user.name !== "" && user.name !== "auto-generate") {
                newFlags |= FLAG_PROFILE_NAME;
            }
        }

        if (!(currentFlags & FLAG_CREATE_FLOW)) {
            checks.push(
                api.get(`${url}/api/v1/flo?limit=1`, { headers })
                    .then(res => {
                        const total = parseInt(res.headers?.["x-total-items"] || "0", 10);
                        if (total > 0 || (Array.isArray(res.data) && res.data.length > 0)) {
                            newFlags |= FLAG_CREATE_FLOW;
                        }
                    })
                    .catch(() => {})
            );
        }

        if (!(currentFlags & FLAG_EXECUTE_FLOW)) {
            checks.push(
                api.get(`${url}/api/v1/dashboard`, { headers })
                    .then(res => {
                        if (res.data && res.data.usage && res.data.usage > 0) {
                            newFlags |= FLAG_EXECUTE_FLOW;
                        }
                    })
                    .catch(() => {})
            );
        }

        if (!(currentFlags & FLAG_CONFIGURE_ENV)) {
            checks.push(
                api.get(`${url}/api/v1/environment`, { headers })
                    .then(res => {
                        if (Array.isArray(res.data) && res.data.length > 0) {
                            newFlags |= FLAG_CONFIGURE_ENV;
                        }
                    })
                    .catch(() => {})
            );
        }

        if (!(currentFlags & FLAG_ENABLE_MFA)) {
            // Sentinel owns MFA state, so the editor calls its
            // /api/mfa/status endpoint with the user's JWT cookie
            // (withCredentials lets the browser send the
            // flomation-token cookie cross-origin).
            const loginURL = config("LOGIN_URL");
            if (loginURL) {
                checks.push(
                    api.get(`${loginURL}/api/mfa/status`, { withCredentials: true })
                        .then(res => {
                            if (res.data && res.data.enabled === true) {
                                newFlags |= FLAG_ENABLE_MFA;
                            }
                        })
                        .catch(() => {})
                );
            }
        }

        Promise.all(checks).then(() => {
            if (newFlags !== currentFlags) {
                setFlags(newFlags);
                const added = newFlags & ~currentFlags;
                for (let bit = 1; bit <= ALL_FLAGS; bit <<= 1) {
                    if (added & bit) {
                        const body: Record<string, unknown> = { flag: bit };
                        // Pass the current org context so org-scoped
                        // bits land on the right row; the API ignores
                        // organisation_id for global bits (profile name
                        // and MFA), so sending it unconditionally is
                        // safe and keeps the client simpler.
                        if (currentOrgID) body.organisation_id = currentOrgID;
                        api.post(`${url}/api/v1/user/checklist`, body, { headers }).catch(() => {});
                    }
                }
                // Mirror the global bits onto the auth user so other
                // components reading user.checklist_flags (e.g. a
                // "you've enabled MFA" badge elsewhere) stay in sync.
                if (user) {
                    const globalNow = newFlags & GLOBAL_MASK;
                    if (globalNow !== ((user.checklist_flags ?? 0) & GLOBAL_MASK)) {
                        setUser({ ...user, checklist_flags: ((user.checklist_flags ?? 0) & ~GLOBAL_MASK) | globalNow });
                    }
                }
            }
        });
    }, [user?.id, currentOrgID, flags]);

    const toggleFlag = useCallback((flag: number) => {
        const url = config("AUTOMATE_API_URL");
        const tkn = cookieToken || token;
        const headers = { Authorization: "Bearer " + tkn };
        const isDone = (flags & flag) !== 0;
        const newFlags = isDone ? (flags & ~flag) : (flags | flag);
        setFlags(newFlags);
        const body: Record<string, unknown> = { flag, clear: isDone };
        if (currentOrgID) body.organisation_id = currentOrgID;
        api.post(`${url}/api/v1/user/checklist`, body, { headers }).catch(() => {});
        // Only the global bits are mirrored onto the auth user; org-
        // scoped bits live entirely in the widget's loaded state for
        // the current context.
        if (user && (flag & GLOBAL_MASK) !== 0) {
            const userFlags = user.checklist_flags ?? 0;
            const updatedGlobal = isDone ? (userFlags & ~flag) : (userFlags | flag);
            setUser({ ...user, checklist_flags: updatedGlobal });
        }
    }, [flags, currentOrgID, user, config, cookieToken, token, setUser]);

    const handleDismiss = () => {
        // Per-org dismissal — see dismissalKey() above.
        localStorage.setItem(dismissalKey(currentOrgID), "true");
        setDismissed(true);
    };

    const completed = ITEMS.filter(item => (flags & item.flag) !== 0).length;

    if (dismissed) return null;

    return (
        <div className="checklist-widget">
            <div className="checklist-header">
                <div className="checklist-header-left">
                    <Icon name="clipboard-list" className="checklist-header-icon" />
                    <h3>Getting Started</h3>
                </div>
                <div className="checklist-header-right">
                    <span className="checklist-progress">{completed} / {ITEMS.length}</span>
                    <button className="checklist-dismiss" onClick={handleDismiss} title="Dismiss">
                        <Icon name="xmark" />
                    </button>
                </div>
            </div>
            <div className="checklist-bar">
                <div className="checklist-bar-fill" style={{ width: `${(completed / ITEMS.length) * 100}%` }} />
            </div>
            <div className="checklist-items">
                {ITEMS.map(item => {
                    const done = (flags & item.flag) !== 0;
                    return (
                        <div key={item.flag} className={`checklist-item ${done ? "done" : ""}`}>
                            <button
                                className={`checklist-check ${done ? "checked" : ""}`}
                                onClick={() => toggleFlag(item.flag)}
                            >
                                {done && <Icon name="check" />}
                            </button>
                            <div className="checklist-item-content">
                                <div className="checklist-item-label">{item.label}</div>
                                <div className="checklist-item-desc">{item.description}</div>
                            </div>
                            {item.link && !done && (
                                // MFA's link points at the Sentinel /mfa
                                // page, which lives on a different origin.
                                // Render an absolute anchor for that case
                                // and a same-origin React Router Link for
                                // every other item.
                                item.flag === FLAG_ENABLE_MFA ? (
                                    <a
                                        href={`${config("LOGIN_URL") || ""}${item.link}`}
                                        className="checklist-item-link"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        {item.linkLabel} →
                                    </a>
                                ) : (
                                    <Link to={item.link} className="checklist-item-link">
                                        {item.linkLabel} →
                                    </Link>
                                )
                            )}
                            {item.action === "share" && !done && (
                                <button className="checklist-item-link checklist-share-btn" onClick={() => setShowShare(!showShare)}>
                                    Share →
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>

            <ShareModal
                visible={showShare}
                onDismiss={() => setShowShare(false)}
            />
        </div>
    );
}
