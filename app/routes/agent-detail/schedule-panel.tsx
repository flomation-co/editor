import { useCallback, useEffect, useState } from "react";
import type { AgentSchedule } from "~/types";
import { Icon } from "~/components/icons/Icon";
import dayjs from "dayjs";

type Props = {
    baseUrl: string;
    headers: Record<string, string>;
};

function formatMode(sched: AgentSchedule): string {
    const tz = sched.timezone && sched.timezone !== "UTC" ? ` (${sched.timezone})` : "";
    switch (sched.schedule_mode) {
        case "interval":
            return `Every ${sched.interval_val || "?"} ${sched.unit || "?"}${tz}`;
        case "daily":
            return `Daily at ${sched.time_of_day || "00:00"}${tz}`;
        case "weekly": {
            const days = sched.days_of_week
                ? sched.days_of_week.split(",").map(d => d.trim().charAt(0).toUpperCase() + d.trim().slice(1)).join(", ")
                : "?";
            return `Weekly on ${days} at ${sched.time_of_day || "00:00"}${tz}`;
        }
        default:
            return sched.schedule_mode;
    }
}

export default function AgentSchedulePanel({ baseUrl, headers }: Props) {
    const [schedules, setSchedules] = useState<AgentSchedule[]>([]);
    const [loading, setLoading] = useState(true);

    const loadSchedules = useCallback(() => {
        setLoading(true);
        fetch(`${baseUrl}/schedule`, { headers })
            .then(res => res.json())
            .then(data => setSchedules(Array.isArray(data) ? data : []))
            .catch(() => setSchedules([]))
            .finally(() => setLoading(false));
    }, [baseUrl, headers]);

    useEffect(() => { loadSchedules(); }, [loadSchedules]);

    if (loading) {
        return (
            <div style={{ textAlign: "center", padding: 32, color: "rgba(255,255,255,0.3)" }}>
                <Icon name="spinner" spin />
            </div>
        );
    }

    if (schedules.length === 0) {
        return (
            <div className="agent-empty-state">
                <Icon name="clock" style={{ fontSize: 24, marginBottom: 8, opacity: 0.3 }} />
                <div>No schedules configured.</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>
                    Ask the agent to set up a recurring task — e.g. "Check my tasks every morning at 8am"
                </div>
            </div>
        );
    }

    return (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <span style={{ fontSize: 14, color: "rgba(255,255,255,0.5)" }}>
                    Recurring schedules managed by the agent
                </span>
                <button
                    type="button"
                    onClick={loadSchedules}
                    style={{
                        background: "none", border: "none", color: "rgba(255,255,255,0.3)",
                        cursor: "pointer", padding: 4,
                    }}
                    title="Refresh"
                >
                    <Icon name="refresh" />
                </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {schedules.map(sched => (
                    <div
                        key={sched.id}
                        style={{
                            padding: "12px 16px",
                            background: "rgba(255,255,255,0.03)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            borderRadius: 8,
                        }}
                    >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <Icon
                                    name="clock"
                                    style={{ color: sched.enabled ? "#00aa9c" : "rgba(255,255,255,0.2)", fontSize: 14 }}
                                />
                                <span style={{
                                    fontWeight: 500,
                                    color: sched.enabled ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)",
                                }}>
                                    {sched.name}
                                </span>
                            </div>
                            <span style={{
                                fontSize: 11,
                                padding: "2px 8px",
                                borderRadius: 4,
                                background: sched.enabled ? "rgba(0,170,156,0.1)" : "rgba(255,255,255,0.05)",
                                color: sched.enabled ? "#00aa9c" : "rgba(255,255,255,0.3)",
                            }}>
                                {sched.enabled ? "Active" : "Disabled"}
                            </span>
                        </div>

                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 6 }}>
                            {sched.description}
                        </div>

                        <div style={{
                            display: "flex", gap: 16, marginTop: 8, fontSize: 11,
                            color: "rgba(255,255,255,0.3)",
                        }}>
                            <span>
                                <Icon name="repeat" style={{ marginRight: 4 }} />
                                {formatMode(sched)}
                            </span>
                            {sched.last_fired_at && (
                                <span>
                                    Last fired: {dayjs.utc(sched.last_fired_at).local().format("D MMM HH:mm")}
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
