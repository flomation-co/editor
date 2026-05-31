import { useState } from "react";
import { Icon } from "~/components/icons/Icon";

type Check = {
    name: string;
    passed: boolean;
    detail: string;
};

type Result = {
    ok: boolean;
    error?: string;
    account_name?: string;
    account_status?: string;
    checks: Check[];
};

type Props = {
    baseUrl: string;
    headers: Record<string, string>;
};

export default function TwilioStatusChecker({ baseUrl, headers }: Props) {
    const [result, setResult] = useState<Result | null>(null);
    const [loading, setLoading] = useState(false);

    const checkStatus = () => {
        setLoading(true);
        setResult(null);
        fetch(`${baseUrl}/twilio-verify`, { headers })
            .then(res => res.json())
            .then(data => setResult(data as Result))
            .catch(() => setResult({ ok: false, error: "Failed to connect to API", checks: [] }))
            .finally(() => setLoading(false));
    };

    return (
        <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <label className="agent-form-label" style={{ margin: 0 }}>Twilio Configuration</label>
                <button
                    type="button"
                    onClick={checkStatus}
                    disabled={loading}
                    style={{
                        display: "flex", alignItems: "center", gap: 6,
                        padding: "4px 12px",
                        background: "rgba(242,47,70,0.08)",
                        border: "1px solid rgba(242,47,70,0.2)",
                        borderRadius: 6,
                        color: "#F22F46",
                        fontSize: 11,
                        cursor: loading ? "wait" : "pointer",
                    }}
                >
                    {loading ? <Icon name="spinner" spin /> : <Icon name="phone" />}
                    {loading ? "Checking..." : "Verify Setup"}
                </button>
            </div>

            {result && !result.ok && result.error && (
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

            {result && result.checks && result.checks.length > 0 && (
                <div style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 8,
                    padding: "10px 14px",
                    fontSize: 12,
                }}>
                    {result.account_name && (
                        <div style={{
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                            marginBottom: 10, paddingBottom: 8,
                            borderBottom: "1px solid rgba(255,255,255,0.06)",
                        }}>
                            <div style={{ color: "rgba(255,255,255,0.6)" }}>
                                <strong>{result.account_name}</strong>
                                <span style={{
                                    marginLeft: 8,
                                    padding: "1px 6px",
                                    borderRadius: 4,
                                    fontSize: 10,
                                    background: result.account_status === "active"
                                        ? "rgba(0,170,156,0.1)" : "rgba(245,158,11,0.1)",
                                    color: result.account_status === "active"
                                        ? "#00aa9c" : "rgba(245,158,11,0.9)",
                                }}>
                                    {result.account_status}
                                </span>
                            </div>
                            <a
                                href="https://console.twilio.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    color: "rgba(255,255,255,0.2)",
                                    fontSize: 10,
                                    textDecoration: "none",
                                    display: "flex", alignItems: "center", gap: 4,
                                }}
                            >
                                <Icon name="arrow-up-right-from-square" /> Twilio Console
                            </a>
                        </div>
                    )}

                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {result.checks.map((check, i) => (
                            <div key={i} style={{
                                display: "flex", alignItems: "center", gap: 8,
                                padding: "4px 0",
                            }}>
                                <Icon
                                    name={check.passed ? "check-circle" : "times-circle"}
                                    style={{
                                        color: check.passed ? "#00aa9c" : "rgba(239,68,68,0.7)",
                                        fontSize: 13,
                                        flexShrink: 0,
                                    }}
                                />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <span style={{
                                        fontSize: 11,
                                        fontWeight: 500,
                                        color: check.passed ? "rgba(255,255,255,0.7)" : "rgba(239,68,68,0.9)",
                                    }}>
                                        {check.name}
                                    </span>
                                    <span style={{
                                        marginLeft: 8,
                                        color: "rgba(255,255,255,0.3)",
                                        fontSize: 11,
                                    }}>
                                        {check.detail}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}