import { useState } from "react";
import { Icon } from "~/components/icons/Icon";

type ScopeCheck = {
    scope: string;
    description: string;
    actions: string;
    granted: boolean;
};

type PermissionResult = {
    ok: boolean;
    error?: string;
    team?: string;
    bot_user?: string;
    scopes?: ScopeCheck[];
    all_granted?: boolean;
    oauth_url?: string;
};

type Props = {
    baseUrl: string;
    headers: Record<string, string>;
};

export default function SlackPermissionChecker({ baseUrl, headers }: Props) {
    const [result, setResult] = useState<PermissionResult | null>(null);
    const [loading, setLoading] = useState(false);

    const checkPermissions = () => {
        setLoading(true);
        setResult(null);
        fetch(`${baseUrl}/slack-permissions`, { headers })
            .then(res => res.json())
            .then(data => setResult(data as PermissionResult))
            .catch(() => setResult({ ok: false, error: "Failed to connect to API" }))
            .finally(() => setLoading(false));
    };

    return (
        <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <label className="agent-form-label" style={{ margin: 0 }}>Bot Token Permissions</label>
                <button
                    type="button"
                    onClick={checkPermissions}
                    disabled={loading}
                    style={{
                        display: "flex", alignItems: "center", gap: 6,
                        padding: "4px 12px",
                        background: "rgba(0,170,156,0.08)",
                        border: "1px solid rgba(0,170,156,0.2)",
                        borderRadius: 6,
                        color: "#00aa9c",
                        fontSize: 11,
                        cursor: loading ? "wait" : "pointer",
                    }}
                >
                    {loading ? <Icon name="spinner" spin /> : <Icon name="shield-check" />}
                    {loading ? "Checking..." : "Check Permissions"}
                </button>
            </div>

            {result && !result.ok && (
                <div style={{
                    padding: "8px 12px",
                    background: "rgba(239,68,68,0.08)",
                    border: "1px solid rgba(239,68,68,0.2)",
                    borderRadius: 6,
                    fontSize: 12,
                    color: "rgba(239,68,68,0.9)",
                    marginBottom: 8,
                }}>
                    <Icon name="exclamation-triangle" style={{ marginRight: 6 }} />
                    {result.error}
                </div>
            )}

            {result && result.ok && (
                <div style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 8,
                    padding: "10px 14px",
                    fontSize: 12,
                }}>
                    <div style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        marginBottom: 10, paddingBottom: 8,
                        borderBottom: "1px solid rgba(255,255,255,0.06)",
                    }}>
                        <div style={{ color: "rgba(255,255,255,0.6)" }}>
                            <strong>{result.team}</strong>
                            <span style={{ marginLeft: 8, color: "rgba(255,255,255,0.3)" }}>
                                Bot: {result.bot_user}
                            </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {result.oauth_url && !result.all_granted && (
                                <a
                                    href={result.oauth_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        padding: "2px 8px",
                                        borderRadius: 4,
                                        fontSize: 11,
                                        background: "rgba(0,170,156,0.08)",
                                        border: "1px solid rgba(0,170,156,0.2)",
                                        color: "#00aa9c",
                                        textDecoration: "none",
                                        display: "flex", alignItems: "center", gap: 4,
                                    }}
                                >
                                    <Icon name="arrow-up-right-from-square" /> Manage Scopes
                                </a>
                            )}
                            {result.oauth_url && result.all_granted && (
                                <a
                                    href={result.oauth_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        color: "rgba(255,255,255,0.2)",
                                        fontSize: 10,
                                        textDecoration: "none",
                                        display: "flex", alignItems: "center", gap: 4,
                                    }}
                                >
                                    <Icon name="arrow-up-right-from-square" /> Slack Admin
                                </a>
                            )}
                            <span style={{
                                padding: "2px 8px",
                                borderRadius: 4,
                                fontSize: 11,
                                fontWeight: 500,
                                background: result.all_granted ? "rgba(0,170,156,0.1)" : "rgba(245,158,11,0.1)",
                                color: result.all_granted ? "#00aa9c" : "rgba(245,158,11,0.9)",
                            }}>
                                {result.all_granted ? "All permissions granted" : "Missing permissions"}
                            </span>
                        </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {result.scopes?.map(scope => (
                            <div key={scope.scope} style={{
                                display: "flex", alignItems: "center", gap: 8,
                                padding: "4px 0",
                            }}>
                                <Icon
                                    name={scope.granted ? "check-circle" : "times-circle"}
                                    style={{
                                        color: scope.granted ? "#00aa9c" : "rgba(239,68,68,0.7)",
                                        fontSize: 13,
                                        flexShrink: 0,
                                    }}
                                />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <span style={{
                                        fontFamily: "'Courier New', monospace",
                                        fontSize: 11,
                                        color: scope.granted ? "rgba(255,255,255,0.7)" : "rgba(239,68,68,0.9)",
                                    }}>
                                        {scope.scope}
                                    </span>
                                    <span style={{
                                        marginLeft: 8,
                                        color: "rgba(255,255,255,0.3)",
                                        fontSize: 11,
                                    }}>
                                        {scope.description}
                                    </span>
                                </div>
                                <span style={{
                                    color: "rgba(255,255,255,0.2)",
                                    fontSize: 10,
                                    whiteSpace: "nowrap",
                                }}>
                                    {scope.actions}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
