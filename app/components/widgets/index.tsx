import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faSpinner} from "@fortawesome/free-solid-svg-icons";
import type {DashboardWidget, DashboardWidgetData} from "~/types";

import {Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler} from "chart.js";
import {Line, Bar, Pie, Doughnut} from "react-chartjs-2";
import ReactMarkdown from "react-markdown";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler);

// Safely extract widget data as an object. Handles base64 strings (legacy), parsed objects, or arrays.
export function safeWidgetData(data?: DashboardWidgetData): Record<string, any> {
    const raw = data?.data;
    if (!raw) return {};
    if (Array.isArray(raw)) return {_array: raw, rows: raw};
    if (typeof raw === "object") return raw as Record<string, any>;
    if (typeof raw === "string") {
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return {_array: parsed, rows: parsed};
            if (typeof parsed === "object" && parsed !== null) return parsed;
        } catch {}
        try {
            const parsed = JSON.parse(atob(raw));
            if (Array.isArray(parsed)) return {_array: parsed, rows: parsed};
            if (typeof parsed === "object" && parsed !== null) return parsed;
        } catch {}
    }
    return {};
}

const CHART_COLOURS = [
    "rgba(0, 170, 156, 0.8)", "rgba(70, 0, 112, 0.8)", "rgba(34, 197, 94, 0.8)",
    "rgba(59, 130, 246, 0.8)", "rgba(249, 115, 22, 0.8)", "rgba(236, 72, 153, 0.8)",
    "rgba(168, 85, 247, 0.8)", "rgba(234, 179, 8, 0.8)",
];
const CHART_COLOURS_BG = CHART_COLOURS.map(c => c.replace("0.8)", "0.15)"));

function StatWidget({widget, data}: {widget: DashboardWidget; data?: DashboardWidgetData}) {
    const cfg = widget.config || {};
    const wd = safeWidgetData(data);
    const rawValue = wd[cfg.value_key || "value"];
    const value = rawValue !== undefined ? String(rawValue) : "--";
    const delta = wd[cfg.delta_key || "delta"];
    const deltaNum = delta !== undefined ? Number(delta) : undefined;
    const colour = cfg.colour || "#00aa9c";

    return (
        <div className="widget-stat" style={{background: `linear-gradient(135deg, ${colour}40, ${colour}15)`}}>
            <div className="widget-stat-value">
                {cfg.prefix && <span className="widget-stat-prefix">{cfg.prefix}</span>}
                {value}
                {cfg.suffix && <span className="widget-stat-suffix">{cfg.suffix}</span>}
            </div>
            {deltaNum !== undefined && (
                <div className={`widget-stat-delta ${deltaNum > 0 ? "widget-stat-delta--positive" : deltaNum < 0 ? "widget-stat-delta--negative" : "widget-stat-delta--neutral"}`}>
                    {deltaNum > 0 ? "+" : ""}{deltaNum}%
                </div>
            )}
            {cfg.subtitle && <div className="widget-stat-subtitle">{cfg.subtitle}</div>}
        </div>
    );
}

function buildChartData(widget: DashboardWidget, data?: DashboardWidgetData, fill?: boolean) {
    const cfg = widget.config || {};
    const wd = safeWidgetData(data);
    const labels = wd.labels || cfg.labels || [];
    const datasets = wd.datasets || cfg.datasets || [];
    return {
        labels,
        datasets: (Array.isArray(datasets) ? datasets : []).map((ds: any, i: number) => ({
            label: ds.label || `Series ${i + 1}`,
            data: ds.data || [],
            borderColor: ds.color || CHART_COLOURS[i % CHART_COLOURS.length],
            backgroundColor: fill ? (ds.bg_color || CHART_COLOURS_BG[i % CHART_COLOURS_BG.length]) : (ds.color || CHART_COLOURS[i % CHART_COLOURS.length]),
            fill: fill || false, tension: 0.3, pointRadius: 3, pointHoverRadius: 5, borderWidth: 2,
        })),
    };
}

function buildChartOptions() {
    return {
        responsive: true, maintainAspectRatio: false,
        plugins: {
            legend: {display: true, labels: {color: "rgba(255,255,255,0.5)", font: {size: 11}}},
            tooltip: {backgroundColor: "rgba(26,26,46,0.95)", titleColor: "#e5e7eb", bodyColor: "rgba(255,255,255,0.7)", borderColor: "rgba(255,255,255,0.1)", borderWidth: 1, cornerRadius: 8, padding: 10},
        },
        scales: {
            x: {grid: {color: "rgba(255,255,255,0.05)"}, ticks: {color: "rgba(255,255,255,0.35)", font: {size: 10}}},
            y: {grid: {color: "rgba(255,255,255,0.05)"}, ticks: {color: "rgba(255,255,255,0.35)", font: {size: 10}}},
        },
    };
}

function buildPieOptions() {
    return {
        responsive: true, maintainAspectRatio: false,
        plugins: {
            legend: {position: "bottom" as const, labels: {color: "rgba(255,255,255,0.5)", font: {size: 11}, padding: 12}},
            tooltip: {backgroundColor: "rgba(26,26,46,0.95)", titleColor: "#e5e7eb", bodyColor: "rgba(255,255,255,0.7)", borderColor: "rgba(255,255,255,0.1)", borderWidth: 1, cornerRadius: 8, padding: 10},
        },
    };
}

function ChartWidget({widget, data, type}: {widget: DashboardWidget; data?: DashboardWidgetData; type: string}) {
    const chartData = buildChartData(widget, data, type === "chart_area");
    return (
        <div className="widget-chart">
            {type === "chart_bar" ? <Bar data={chartData} options={buildChartOptions()}/> : <Line data={chartData} options={buildChartOptions()}/>}
        </div>
    );
}

function PieWidget({widget, data, type}: {widget: DashboardWidget; data?: DashboardWidgetData; type: string}) {
    const cfg = widget.config || {};
    const wd = safeWidgetData(data);
    const labels = wd.labels || cfg.labels || [];
    const values = wd.values || cfg.values || [];
    const chartData = {labels, datasets: [{data: values, backgroundColor: cfg.colours || CHART_COLOURS.slice(0, labels.length), borderColor: "rgba(10,10,16,0.8)", borderWidth: 2}]};
    return (
        <div className="widget-chart">
            {type === "chart_doughnut" ? <Doughnut data={chartData} options={buildPieOptions()}/> : <Pie data={chartData} options={buildPieOptions()}/>}
        </div>
    );
}

function formatColumnHeader(key: string): string {
    return key.replace(/[_-]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function formatCellValue(value: any): string {
    if (value === null || value === undefined) return "";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
}

// Try to coerce a value to an array — handles actual arrays and JSON strings
function coerceArray(val: any): any[] | null {
    if (Array.isArray(val)) return val;
    if (typeof val === "string") {
        const trimmed = val.trim();
        if (trimmed.startsWith("[")) {
            try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed)) return parsed;
            } catch { /* not JSON */ }
        }
    }
    return null;
}

function findArrayInData(wd: Record<string, any>, preferredKey?: string): any[] {
    // Try the preferred key first
    if (preferredKey) {
        const arr = coerceArray(wd[preferredKey]);
        if (arr) return arr;
    }
    // Try common keys
    for (const key of ["rows", "data", "items", "results", "_array"]) {
        const arr = coerceArray(wd[key]);
        if (arr) return arr;
    }
    // Scan for any array value (actual arrays of objects)
    for (const key of Object.keys(wd)) {
        const arr = coerceArray(wd[key]);
        if (arr && arr.length > 0 && typeof arr[0] === "object") return arr;
    }
    return [];
}

function TableWidget({widget, data}: {widget: DashboardWidget; data?: DashboardWidgetData}) {
    const cfg = widget.config || {};
    const wd = safeWidgetData(data);
    const rawRows = findArrayInData(wd, cfg.rows_key) || cfg.rows || [];
    // Ensure each row is an object — parse JSON strings if needed
    const rows: any[] = (Array.isArray(rawRows) ? rawRows : []).map(row => {
        if (typeof row === "string") {
            try { return JSON.parse(row); } catch { return row; }
        }
        return row;
    }).filter(row => typeof row === "object" && row !== null);
    // Auto-derive columns: use configured columns only if they actually match keys in the row data.
    // This handles cases where the editor auto-populated columns from flow output keys (e.g. "results", "row_count")
    // instead of row field names (e.g. "hour_bucket", "unique_sessions").
    const cfgCols = (cfg.columns || []).filter((c: string) => c && c.trim());
    const rowKeys = rows.length > 0 && typeof rows[0] === "object" ? Object.keys(rows[0]) : [];
    const cfgColsValid = cfgCols.length > 0 && rows.length > 0 ? cfgCols.some((c: string) => rowKeys.includes(c)) : cfgCols.length > 0;
    const columns: string[] = cfgColsValid ? cfgCols : rowKeys;
    const labels: Record<string, string> = cfg.column_labels || {};
    return (
        <div className="widget-table-wrap">
            <table className="widget-table">
                <thead><tr>{columns.map((col, i) => <th key={i}>{labels[col] || formatColumnHeader(col)}</th>)}</tr></thead>
                <tbody>
                    {rows.map((row: any, i: number) => <tr key={i}>{columns.map((col, j) => <td key={j}>{formatCellValue(row[col])}</td>)}</tr>)}
                    {rows.length === 0 && <tr><td colSpan={columns.length || 1} style={{textAlign: "center", color: "rgba(255,255,255,0.2)"}}>No data</td></tr>}
                </tbody>
            </table>
        </div>
    );
}

function TextWidget({widget, data}: {widget: DashboardWidget; data?: DashboardWidgetData}) {
    const wd = safeWidgetData(data);
    return <div className="widget-text"><ReactMarkdown>{wd.content || widget.config?.content || ""}</ReactMarkdown></div>;
}

function GaugeWidget({widget, data}: {widget: DashboardWidget; data?: DashboardWidgetData}) {
    const cfg = widget.config || {};
    const wd = safeWidgetData(data);
    const value = wd[cfg.value_key || "value"] ?? cfg.value ?? 0;
    const min = cfg.min ?? 0; const max = cfg.max ?? 100;
    const pct = Math.min(1, Math.max(0, (Number(value) - min) / (max - min)));
    const angle = pct * 180;
    const colour = pct < 0.33 ? "#22c55e" : pct < 0.66 ? "#f59e0b" : "#ef4444";
    return (
        <div className="widget-gauge">
            <svg viewBox="0 0 200 120" width="180" height="110">
                <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="14" strokeLinecap="round"/>
                <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke={colour} strokeWidth="14" strokeLinecap="round" strokeDasharray={`${(pct * 251.327).toFixed(1)} 251.327`} style={{filter: `drop-shadow(0 0 6px ${colour})`}}/>
                <line x1="100" y1="100" x2={100 + 65 * Math.cos(Math.PI - (angle * Math.PI) / 180)} y2={100 - 65 * Math.sin(Math.PI - (angle * Math.PI) / 180)} stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round"/>
                <circle cx="100" cy="100" r="4" fill="rgba(255,255,255,0.7)"/>
                <text x="100" y="90" textAnchor="middle" fill="#e5e7eb" fontSize="22" fontWeight="700">{Number(value).toLocaleString()}</text>
                <text x="24" y="116" textAnchor="start" fill="rgba(255,255,255,0.25)" fontSize="10">{min}</text>
                <text x="176" y="116" textAnchor="end" fill="rgba(255,255,255,0.25)" fontSize="10">{max}</text>
            </svg>
            {cfg.label && <div className="widget-gauge-label">{cfg.label}</div>}
        </div>
    );
}

function StatusWidget({widget, data}: {widget: DashboardWidget; data?: DashboardWidgetData}) {
    const cfg = widget.config || {};
    const flowData = safeWidgetData(data);
    const greenValues = (cfg.green_values || "healthy,active,ok,up,running,true,success,yes").split(",").map((s: string) => s.trim().toLowerCase()).filter(Boolean);
    const amberValues = (cfg.amber_values || "busy,degraded,warning,partial,warn").split(",").map((s: string) => s.trim().toLowerCase()).filter(Boolean);
    const labels: Record<string, string> = cfg.labels || {};
    const colours: Record<string, string> = cfg.colours || {};
    const goodColour = cfg.good_colour || "#22c55e";
    const badColour = cfg.bad_colour || "#ef4444";

    const getStatusColour = (key: string, value: string): string => {
        if (colours[key]) return colours[key];
        const v = String(value).toLowerCase();
        if (greenValues.includes(v)) return goodColour;
        if (amberValues.includes(v)) return cfg.warn_colour || "#f59e0b";
        if (v === "" || v === "unknown" || v === "null" || v === "undefined") return "rgba(255,255,255,0.15)";
        return badColour;
    };

    let items: {key: string; label: string; value: string}[] = [];
    const itemsArray = flowData.items;
    if (Array.isArray(itemsArray)) {
        items = itemsArray.map((item: any) => {
            const key = item.key || item.name || "";
            return {key, label: labels[key] || item.label || item.name || key || "Unknown", value: String(item.status || item.value || item.state || "unknown")};
        });
    } else {
        const keysToShow: string[] = cfg.status_keys && cfg.status_keys.length > 0 ? cfg.status_keys : Object.keys(flowData);
        items = keysToShow.filter((k: string) => k in flowData).map((k: string) => ({key: k, label: labels[k] || k, value: String(flowData[k])}));
    }

    // Determine overall health colour for background
    const overallColour = items.length > 0
        ? (items.every(i => greenValues.includes(i.value.toLowerCase())) ? goodColour
            : items.some(i => !greenValues.includes(i.value.toLowerCase()) && !amberValues.includes(i.value.toLowerCase())) ? badColour
            : (cfg.warn_colour || "#f59e0b"))
        : "rgba(255,255,255,0.05)";

    // Single-item mode: show large centred display
    if (items.length <= 2) {
        return (
            <div className="widget-status-hero" style={{background: `linear-gradient(135deg, ${overallColour}30, ${overallColour}10)`}}>
                {items.map((item, i) => {
                    const colour = getStatusColour(item.key, item.value);
                    return (
                        <div key={i} className="widget-status-hero-item">
                            <div className="widget-status-hero-dot" style={{background: colour, boxShadow: `0 0 12px ${colour}66`}}/>
                            <span className="widget-status-hero-label">{item.label}</span>
                        </div>
                    );
                })}
                {items.length === 0 && <div className="widget-empty">No status data</div>}
            </div>
        );
    }

    // Multi-item mode: grid of status indicators
    return (
        <div className="widget-status-grid">
            {items.map((item, i) => {
                const colour = getStatusColour(item.key, item.value);
                return (
                    <div key={i} className="widget-status-item">
                        <div className="widget-status-dot" style={{background: colour, boxShadow: `0 0 6px ${colour}55`}}/>
                        <span className="widget-status-label">{item.label}</span>
                    </div>
                );
            })}
        </div>
    );
}

export function WidgetRenderer({widget, widgetData}: {widget: DashboardWidget; widgetData?: DashboardWidgetData}) {
    const d = widgetData;
    if (d && (d.status === "pending" || d.status === "running") && !d.data) {
        return <div className="widget-loading"><FontAwesomeIcon icon={faSpinner} className="widget-loading-spinner" style={{marginRight: 6}}/>Loading...</div>;
    }
    if (d && d.status === "error" && !d.data) {
        return <div className="widget-error">Failed to load data</div>;
    }
    switch (widget.widget_type) {
        case "stat": return <StatWidget widget={widget} data={d}/>;
        case "chart_line": case "chart_area": return <ChartWidget widget={widget} data={d} type={widget.widget_type}/>;
        case "chart_bar": return <ChartWidget widget={widget} data={d} type="chart_bar"/>;
        case "chart_pie": case "chart_doughnut": return <PieWidget widget={widget} data={d} type={widget.widget_type}/>;
        case "table": return <TableWidget widget={widget} data={d}/>;
        case "text": return <TextWidget widget={widget} data={d}/>;
        case "gauge": return <GaugeWidget widget={widget} data={d}/>;
        case "status": return <StatusWidget widget={widget} data={d}/>;
        default: return <div className="widget-empty">Unknown widget type: {widget.widget_type}</div>;
    }
}
