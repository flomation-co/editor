import React, { useEffect, useState, useCallback } from "react";
import useConfig from "~/components/config";
import type { Trigger } from "~/types";
import "./index.css";
import { Icon } from "~/components/icons/Icon";

type Account = {
    email: string;
    label?: string;
    purpose: string;
};

type Props = {
    nodeId: string;
    triggers?: Trigger[];
    nodeLabel?: string;
};

const PURPOSE_LABELS: Record<string, { label: string; icon: any }> = {
    email_read: { label: "Email read", icon: "envelope" },
    email_send: { label: "Email send", icon: "paper-plane" },
    calendar: { label: "Calendar", icon: "calendar" },
};

const GoogleAccountsProperty = (props: Props) => {
    const config = useConfig();
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [authURLs, setAuthURLs] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);

    const apiUrl = config("AUTOMATE_API_URL");

    // Resolve the trigger ID for this node from the flow's triggers
    const typeName = (props.nodeLabel || "").replace("trigger/", "").replace(/_/g, "-");
    const trigger = props.triggers?.find(t => t.type_name === typeName);
    const triggerID = trigger?.id;

    const fetchAccounts = useCallback(() => {
        if (!triggerID || !apiUrl) {
            setLoading(false);
            return;
        }

        setLoading(true);
        fetch(`${apiUrl}/api/v1/internal/trigger/${triggerID}/google-accounts`)
            .then(res => res.json())
            .then(data => {
                setAccounts(data.accounts || []);
                setAuthURLs(data.auth_urls || {});
            })
            .catch(() => {
                setAccounts([]);
                setAuthURLs({});
            })
            .finally(() => setLoading(false));
    }, [triggerID, apiUrl]);

    useEffect(() => {
        fetchAccounts();
    }, [fetchAccounts]);

    // Listen for OAuth popup completion
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data === "google-oauth-complete") {
                fetchAccounts();
            }
        };
        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, [fetchAccounts]);

    const openOAuth = (purpose: string) => {
        const url = authURLs[purpose];
        if (!url) return;

        const popup = window.open(url, "google-oauth", "width=500,height=700,scrollbars=yes");

        // Poll for popup close (OAuth redirects back and closes)
        if (popup) {
            const timer = setInterval(() => {
                if (popup.closed) {
                    clearInterval(timer);
                    // Refresh accounts after popup closes
                    setTimeout(() => fetchAccounts(), 1000);
                }
            }, 500);
        }
    };

    const removeAccount = (email: string, purpose: string) => {
        if (!triggerID || !apiUrl) return;

        fetch(`${apiUrl}/api/v1/internal/trigger/${triggerID}/google-account/${encodeURIComponent(email)}?purpose=${purpose}`, {
            method: "DELETE",
        })
            .then(() => fetchAccounts())
            .catch(console.error);
    };

    if (!triggerID) {
        return (
            <div className="property-menu-input-row">
                <div className="google-accounts-empty">
                    Save this flow first to configure Google accounts
                </div>
            </div>
        );
    }

    return (
        <div className="property-menu-input-row">
            <div className="google-accounts-section">
                <div className="google-accounts-header">
                    <h4>Connected Accounts</h4>
                    <button
                        className="google-account-remove"
                        onClick={fetchAccounts}
                        title="Refresh"
                        style={{ color: "rgba(255,255,255,0.4)" }}
                    >
                        <Icon name="refresh" />
                    </button>
                </div>

                {loading ? (
                    <div className="google-accounts-loading">Loading accounts...</div>
                ) : accounts.length === 0 ? (
                    <div className="google-accounts-empty">
                        No accounts connected yet. Add one below.
                    </div>
                ) : (
                    <div className="google-accounts-list">
                        {accounts.map((acct, i) => (
                            <div className="google-account-item" key={`${acct.email}-${acct.purpose}-${i}`}>
                                <div className="google-account-info">
                                    <span className="google-account-email">{acct.email}</span>
                                    <div className="google-account-meta">
                                        {acct.label && (
                                            <span className="google-account-label">{acct.label}</span>
                                        )}
                                        <span className="google-account-purpose">
                                            {PURPOSE_LABELS[acct.purpose]?.label || acct.purpose}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    className="google-account-remove"
                                    onClick={() => removeAccount(acct.email, acct.purpose)}
                                    title="Remove"
                                >
                                    <Icon name="trash" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="google-accounts-add-buttons">
                    {Object.entries(PURPOSE_LABELS).map(([purpose, { label, icon }]) => (
                        <button
                            key={purpose}
                            className="google-accounts-add-btn"
                            onClick={() => openOAuth(purpose)}
                            disabled={!authURLs[purpose]}
                        >
                            <Icon name="plus" />
                            <Icon name={icon} />
                            Add {label} Account
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default GoogleAccountsProperty;