import React, { useCallback } from "react";
import { Link } from "react-router";
import { useAuth } from "~/context/auth/use";
import useConfig from "~/components/config";
import useCookieToken from "~/components/cookie";
import api from "~/lib/api";
import { Icon } from "~/components/icons/Icon";
import "./checklist-widget.css";

// Bitmask flags — must match API
const FLAG_PROFILE_NAME   = 1;
const FLAG_CREATE_FLOW    = 2;
const FLAG_EXECUTE_FLOW   = 4;
const FLAG_CONFIGURE_ENV  = 8;
const FLAG_SHARE          = 16;

const ALL_FLAGS = FLAG_PROFILE_NAME | FLAG_CREATE_FLOW | FLAG_EXECUTE_FLOW | FLAG_CONFIGURE_ENV | FLAG_SHARE;

interface ChecklistItem {
    flag: number;
    label: string;
    description: string;
    link?: string;
    linkLabel?: string;
    icon: string;
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
        flag: FLAG_SHARE,
        label: "Share with Colleagues",
        description: "Invite a colleague or share a flow with your team.",
        icon: "user-group",
    },
];

export default function ChecklistWidget() {
    const { user, setUser, token } = useAuth();
    const config = useConfig();
    const cookieToken = useCookieToken();

    const flags = user?.checklist_flags ?? 0;
    const completed = ITEMS.filter(item => (flags & item.flag) !== 0).length;
    const allDone = flags === ALL_FLAGS;

    const markDone = useCallback((flag: number) => {
        if ((flags & flag) !== 0) return; // already done

        const url = config("AUTOMATE_API_URL");
        const tkn = cookieToken || token;
        api.post(url + "/api/v1/user/checklist", { flag }, {
            headers: { Authorization: "Bearer " + tkn },
        }).then(() => {
            if (user) {
                setUser({ ...user, checklist_flags: (user.checklist_flags ?? 0) | flag });
            }
        }).catch(() => {});
    }, [flags, user, config, cookieToken, token, setUser]);

    if (allDone) return null;

    return (
        <div className="checklist-widget">
            <div className="checklist-header">
                <div className="checklist-header-left">
                    <Icon name="clipboard-list" className="checklist-header-icon" />
                    <h3>Getting Started</h3>
                </div>
                <span className="checklist-progress">{completed} / {ITEMS.length}</span>
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
                                onClick={() => markDone(item.flag)}
                                disabled={done}
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
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
