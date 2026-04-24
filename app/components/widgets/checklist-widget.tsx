import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "~/context/auth/use";
import useConfig from "~/components/config";
import useCookieToken from "~/components/cookie";
import api from "~/lib/api";
import { Icon } from "~/components/icons/Icon";
import ShareModal from "~/components/shareModal";
import "./checklist-widget.css";

// Bitmask flags — must match API
const FLAG_PROFILE_NAME   = 1;
const FLAG_CREATE_FLOW    = 2;
const FLAG_EXECUTE_FLOW   = 4;
const FLAG_CONFIGURE_ENV  = 8;
const FLAG_INVITE_TEAM    = 16;

const ALL_FLAGS = FLAG_PROFILE_NAME | FLAG_CREATE_FLOW | FLAG_EXECUTE_FLOW | FLAG_CONFIGURE_ENV | FLAG_INVITE_TEAM;

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
];

export default function ChecklistWidget() {
    const { user, setUser, token } = useAuth();
    const config = useConfig();
    const cookieToken = useCookieToken();

    const [flags, setFlags] = useState(user?.checklist_flags ?? 0);
    const [showShare, setShowShare] = useState(false);
    const [detected, setDetected] = useState(false);
    const [dismissed, setDismissed] = useState(() => typeof window !== "undefined" && localStorage.getItem("flomation-checklist-dismissed") === "true");

    useEffect(() => {
        setFlags(user?.checklist_flags ?? 0);
    }, [user?.checklist_flags]);

    // Auto-detect completed items on mount (except invite/share)
    useEffect(() => {
        if (!user || detected) return;
        setDetected(true);

        const url = config("AUTOMATE_API_URL");
        const tkn = cookieToken || token;
        const headers = { Authorization: "Bearer " + tkn };
        const currentFlags = user.checklist_flags ?? 0;
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

        Promise.all(checks).then(() => {
            if (newFlags !== currentFlags) {
                setFlags(newFlags);
                const added = newFlags & ~currentFlags;
                for (let bit = 1; bit <= 16; bit <<= 1) {
                    if (added & bit) {
                        api.post(`${url}/api/v1/user/checklist`, { flag: bit }, { headers }).catch(() => {});
                    }
                }
                if (user) {
                    setUser({ ...user, checklist_flags: newFlags });
                }
            }
        });
    }, [user?.id]);

    const toggleFlag = useCallback((flag: number) => {
        const url = config("AUTOMATE_API_URL");
        const tkn = cookieToken || token;
        const headers = { Authorization: "Bearer " + tkn };
        const isDone = (flags & flag) !== 0;
        const newFlags = isDone ? (flags & ~flag) : (flags | flag);
        setFlags(newFlags);
        api.post(`${url}/api/v1/user/checklist`, { flag, clear: isDone }, { headers }).catch(() => {});
        if (user) {
            setUser({ ...user, checklist_flags: newFlags });
        }
    }, [flags, user, config, cookieToken, token, setUser]);

    const handleDismiss = () => {
        localStorage.setItem("flomation-checklist-dismissed", "true");
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
                                <Link to={item.link} className="checklist-item-link">
                                    {item.linkLabel} →
                                </Link>
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
