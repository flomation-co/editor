import {useEffect, useState, useCallback, useRef, useMemo} from "react";
import {useParams, useNavigate} from "react-router";
import Container from "~/components/container";
import api from "~/lib/api";
import useConfig from "~/components/config";
import useCookieToken from "~/components/cookie";
import {useToast} from "~/components/toast";
import type {Dashboard, DashboardWidget, Flo} from "~/types";
import "./index.css";
import { Icon } from "~/components/icons/Icon";

const cfgFn = useConfig();
const API_URL = cfgFn("AUTOMATE_API_URL");

const WIDGET_TYPES = [
    {type: "stat", label: "Stat", icon: "hashtag"},
    {type: "chart_line", label: "Line", icon: "chart-line"},
    {type: "chart_area", label: "Area", icon: "chart-area"},
    {type: "chart_bar", label: "Bar", icon: "chart-bar"},
    {type: "chart_pie", label: "Pie", icon: "chart-pie"},
    {type: "chart_doughnut", label: "Doughnut", icon: "circle-dot"},
    {type: "table", label: "Table", icon: "table"},
    {type: "text", label: "Text", icon: "align-left"},
    {type: "gauge", label: "Gauge", icon: "gauge"},
    {type: "status", label: "Status", icon: "circle-dot"},
];

export function meta() {
    return [
        {title: "Flomation - Edit Dashboard"},
        {name: "description", content: "Edit dashboard"},
    ];
}

type PanelConfigPanelProps = {
    widget: DashboardWidget;
    flows: Flo[];
    flowOutputKeys: string[];
    executionOutputKeys: string[];
    tableColumnKeys: string[];
    isLoadingColumns: boolean;
    onFlowSelected: (floId: string) => void;
    onUpdate: (updates: Partial<DashboardWidget>) => void;
    onDelete: () => void;
    onClose: () => void;
};

function PanelConfigPanel({widget, flows, flowOutputKeys, executionOutputKeys, tableColumnKeys, isLoadingColumns, onFlowSelected, onUpdate, onDelete, onClose}: PanelConfigPanelProps) {
    const [title, setTitle] = useState(widget.title || "New Panel");
    const [widgetType, setWidgetType] = useState(widget.widget_type || "stat");
    const [floId, setFloId] = useState(widget.flo_id || "");
    const [flowSearch, setFlowSearch] = useState("");
    const [showFlowDropdown, setShowFlowDropdown] = useState(false);
    const flowDropdownRef = useRef<HTMLDivElement>(null);

    // Unified config state — all fields live here, type-specific rendering decides what to show
    const [config, setConfig] = useState<Record<string, any>>(widget.config || {});

    const setConfigField = (key: string, value: any) => {
        setConfig(prev => ({...prev, [key]: value}));
    };

    // Reset all state when widget changes
    useEffect(() => {
        setTitle(widget.title || "New Panel");
        setWidgetType(widget.widget_type || "stat");
        setFloId(widget.flo_id || "");
        setFlowSearch("");
        setConfig(widget.config || {});
    }, [widget.id]);

    // Auto-populate config when flow output keys change
    const prevKeysRef = useRef<string[]>([]);
    useEffect(() => {
        if (flowOutputKeys.length === 0 || flowOutputKeys === prevKeysRef.current) return;
        prevKeysRef.current = flowOutputKeys;

        setConfig(prev => {
            const updated = {...prev};
            // Auto-populate value_key if empty or default
            if ((!updated.value_key || updated.value_key === "value") && flowOutputKeys.length > 0) {
                updated.value_key = flowOutputKeys[0];
            }
            // Auto-populate x_key and y_keys for charts
            if (!updated.x_key && flowOutputKeys.includes("labels")) {
                updated.x_key = "labels";
            }
            if ((!updated.y_keys || updated.y_keys.length === 0) && flowOutputKeys.length > 0) {
                updated.y_keys = flowOutputKeys.filter(k => k !== "labels" && k !== "x" && k !== "time").slice(0, 3);
            }
            // Auto-populate rows_key for tables — try common array output keys
            if (!updated.rows_key) {
                for (const key of ["rows", "data", "results", "items"]) {
                    if (flowOutputKeys.includes(key)) { updated.rows_key = key; break; }
                }
            }
            // Don't auto-populate table columns — they are auto-derived from the row data at render time
            // Auto-populate labels_key/values_key for pie/doughnut
            if (!updated.labels_key && flowOutputKeys.includes("labels")) {
                updated.labels_key = "labels";
            }
            if (!updated.values_key && flowOutputKeys.includes("values")) {
                updated.values_key = "values";
            }
            return updated;
        });
    }, [flowOutputKeys]);

    // Close flow dropdown on click outside
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (flowDropdownRef.current && !flowDropdownRef.current.contains(e.target as Node)) {
                setShowFlowDropdown(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const selectedFlow = flows.find(f => f.id === floId);
    const filteredFlows = flows.filter(f =>
        f.name.toLowerCase().includes(flowSearch.toLowerCase())
    );

    const handleApply = () => {
        onUpdate({
            title,
            widget_type: widgetType,
            flo_id: floId || undefined,
            config,
        });
        onClose();
    };

    // Prefer execution-derived keys over static analysis
    const keys = executionOutputKeys.length > 0 ? executionOutputKeys : flowOutputKeys;

    // Inline helpers — these are plain functions returning JSX, NOT component functions.
    // This prevents React from unmounting/remounting inputs on every state change.
    const renderKeyField = (label: string, hint: string, value: string, onChange: (v: string) => void) => (
        <div className="panel-config-section">
            <div className="panel-config-section-label">
                {label}
                {isLoadingColumns && keys.length === 0 && <Icon name="spinner" spin style={{marginLeft: 6, fontSize: 10, opacity: 0.4}} />}
            </div>
            {keys.length > 0 ? (
                <select className="panel-config-select" value={value} onChange={(e) => onChange(e.target.value)}>
                    <option value="">Select a key...</option>
                    {keys.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
            ) : (
                <input className="panel-config-input" value={value} onChange={(e) => onChange(e.target.value)} placeholder={hint}/>
            )}
        </div>
    );

    // Reorderable multi-key selector with drag/drop
    const renderMultiKeyField = (label: string, hint: string, value: string[], onChange: (v: string[]) => void) => {
        const available = keys.filter(k => !value.includes(k));

        const onDragStartMulti = (e: React.DragEvent, idx: number) => {
            e.dataTransfer.setData("text/plain", String(idx));
            e.dataTransfer.effectAllowed = "move";
            (e.currentTarget as HTMLElement).classList.add("dragging");
        };
        const onDragEndMulti = (e: React.DragEvent) => {
            (e.currentTarget as HTMLElement).classList.remove("dragging");
            e.currentTarget.parentElement?.querySelectorAll(".drag-over").forEach(el => el.classList.remove("drag-over"));
        };
        const onDropMulti = (e: React.DragEvent, targetIdx: number) => {
            e.preventDefault();
            (e.currentTarget as HTMLElement).classList.remove("drag-over");
            const src = parseInt(e.dataTransfer.getData("text/plain"), 10);
            if (isNaN(src) || src === targetIdx) return;
            const newVal = [...value];
            const [moved] = newVal.splice(src, 1);
            newVal.splice(targetIdx, 0, moved);
            onChange(newVal);
        };
        const onDragOverMulti = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };
        const onDragEnterMulti = (e: React.DragEvent) => { (e.currentTarget as HTMLElement).classList.add("drag-over"); };
        const onDragLeaveMulti = (e: React.DragEvent) => { (e.currentTarget as HTMLElement).classList.remove("drag-over"); };

        return (
            <div className="panel-config-section">
                <div className="panel-config-section-label">
                    {label}
                    {isLoadingColumns && keys.length === 0 && <Icon name="spinner" spin style={{marginLeft: 6, fontSize: 10, opacity: 0.4}} />}
                </div>
                {keys.length > 0 ? (
                    <div className="table-column-config">
                        {/* Selected — draggable */}
                        {value.map((k, idx) => (
                            <div key={k} className="table-column-row table-column-row--selected"
                                draggable onDragStart={(e) => onDragStartMulti(e, idx)} onDragEnd={onDragEndMulti}
                                onDragOver={onDragOverMulti} onDragEnter={onDragEnterMulti} onDragLeave={onDragLeaveMulti}
                                onDrop={(e) => onDropMulti(e, idx)}
                            >
                                <Icon name="grip-vertical" className="table-column-grip" />
                                <input type="checkbox" className="table-column-checkbox" checked onChange={() => onChange(value.filter(v => v !== k))}/>
                                <div className="table-column-info">
                                    <span className="table-column-name">{k}</span>
                                </div>
                            </div>
                        ))}
                        {/* Available */}
                        {available.map(k => (
                            <div key={k} className="table-column-row">
                                <input type="checkbox" className="table-column-checkbox" checked={false} onChange={() => onChange([...value, k])}/>
                                <div className="table-column-info">
                                    <span className="table-column-name">{k}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <input
                        className="panel-config-input"
                        value={value.join(", ")}
                        onChange={(e) => onChange(e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
                        placeholder={hint}
                    />
                )}
            </div>
        );
    };

    // Type-specific configuration fields
    const renderTypeConfig = () => {
        switch (widgetType) {
            case "stat":
                return (
                    <>
                        <div className="panel-config-divider"/>
                        <div className="panel-config-type-hint">
                            Displays a single number from your flow's output.
                        </div>
                        {renderKeyField("Value Key", "e.g. count, total", config.value_key || "", v => setConfigField("value_key", v))}
                        {renderKeyField("Delta Key (optional)", "e.g. change_percent", config.delta_key || "", v => setConfigField("delta_key", v))}
                        <div className="panel-config-row">
                            <div className="panel-config-section" style={{flex: 1}}>
                                <div className="panel-config-section-label">Prefix</div>
                                <input className="panel-config-input" value={config.prefix || ""} onChange={(e) => setConfigField("prefix", e.target.value)} placeholder="e.g. $"/>
                            </div>
                            <div className="panel-config-section" style={{flex: 1}}>
                                <div className="panel-config-section-label">Suffix</div>
                                <input className="panel-config-input" value={config.suffix || ""} onChange={(e) => setConfigField("suffix", e.target.value)} placeholder="e.g. ms"/>
                            </div>
                        </div>
                        <div className="panel-config-section">
                            <div className="panel-config-section-label">Subtitle</div>
                            <input className="panel-config-input" value={config.subtitle || ""} onChange={(e) => setConfigField("subtitle", e.target.value)} placeholder="e.g. across 3 environments"/>
                        </div>
                        <div className="panel-config-section">
                            <div className="panel-config-section-label">Colour</div>
                            <div className="status-colour-picker">
                                {["#00aa9c", "#460070", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#ef4444"].map(c => (
                                    <div
                                        key={c}
                                        className={`status-colour-swatch ${(config.colour || "#00aa9c") === c ? "status-colour-swatch--active" : ""}`}
                                        style={{background: c}}
                                        onClick={() => setConfigField("colour", c)}
                                    />
                                ))}
                            </div>
                        </div>
                    </>
                );

            case "chart_line":
            case "chart_area":
            case "chart_bar":
                return (
                    <>
                        <div className="panel-config-divider"/>
                        <div className="panel-config-type-hint">
                            {widgetType === "chart_bar" ? "Renders a bar chart." : widgetType === "chart_area" ? "Renders an area chart." : "Renders a line chart."} Your flow should output arrays for labels and data series.
                        </div>
                        {renderKeyField("X-Axis Labels Key", "e.g. labels, time, dates", config.x_key || "", v => setConfigField("x_key", v))}
                        {renderMultiKeyField("Data Series Keys", "e.g. success, failed", config.y_keys || [], v => setConfigField("y_keys", v))}
                    </>
                );

            case "chart_pie":
            case "chart_doughnut":
                return (
                    <>
                        <div className="panel-config-divider"/>
                        <div className="panel-config-type-hint">
                            {widgetType === "chart_pie" ? "Renders a pie chart." : "Renders a doughnut chart."} Your flow should output arrays of labels and values.
                        </div>
                        {renderKeyField("Labels Key", "e.g. labels, categories", config.labels_key || "", v => setConfigField("labels_key", v))}
                        {renderKeyField("Values Key", "e.g. values, counts", config.values_key || "", v => setConfigField("values_key", v))}
                    </>
                );

            case "table": {
                const selectedCols: string[] = config.columns || [];
                const allCols = tableColumnKeys.length > 0 ? tableColumnKeys : [];
                // Columns that are available but not selected
                const unselectedCols = allCols.filter(c => !selectedCols.includes(c));

                const handleDragStart = (e: React.DragEvent, idx: number) => {
                    e.dataTransfer.setData("text/plain", String(idx));
                    e.dataTransfer.effectAllowed = "move";
                    (e.currentTarget as HTMLElement).classList.add("dragging");
                };

                const handleDragEnd = (e: React.DragEvent) => {
                    (e.currentTarget as HTMLElement).classList.remove("dragging");
                    // Remove drag-over from all siblings
                    e.currentTarget.parentElement?.querySelectorAll(".drag-over").forEach(el => el.classList.remove("drag-over"));
                };

                const handleDrop = (e: React.DragEvent, targetIdx: number) => {
                    e.preventDefault();
                    (e.currentTarget as HTMLElement).classList.remove("drag-over");
                    const sourceIdx = parseInt(e.dataTransfer.getData("text/plain"), 10);
                    if (isNaN(sourceIdx) || sourceIdx === targetIdx) return;
                    const newCols = [...selectedCols];
                    const [moved] = newCols.splice(sourceIdx, 1);
                    newCols.splice(targetIdx, 0, moved);
                    setConfigField("columns", newCols);
                };

                const handleDragOver = (e: React.DragEvent) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                };

                const handleDragEnter = (e: React.DragEvent) => {
                    (e.currentTarget as HTMLElement).classList.add("drag-over");
                };

                const handleDragLeave = (e: React.DragEvent) => {
                    (e.currentTarget as HTMLElement).classList.remove("drag-over");
                };

                const toggleColumn = (col: string, checked: boolean) => {
                    if (checked) {
                        setConfigField("columns", [...selectedCols, col]);
                    } else {
                        setConfigField("columns", selectedCols.filter(c => c !== col));
                    }
                };

                const selectAll = () => setConfigField("columns", [...allCols]);
                const clearAll = () => setConfigField("columns", []);

                return (
                    <>
                        <div className="panel-config-divider"/>
                        <div className="panel-config-type-hint">
                            Renders a data table. Your flow should output an array of row objects.
                        </div>
                        {renderKeyField("Rows Key", "e.g. rows, results, data", config.rows_key || "", v => setConfigField("rows_key", v))}

                        <div className="panel-config-section">
                            <div className="panel-config-section-label">
                                Columns
                                {isLoadingColumns && <Icon name="spinner" spin style={{marginLeft: 6, fontSize: 10, opacity: 0.4}} />}
                            </div>

                            {allCols.length > 0 ? (
                                <div className="table-column-config">
                                    <div className="table-column-actions">
                                        <button type="button" className="table-column-action-btn" onClick={selectAll}>Select All</button>
                                        <button type="button" className="table-column-action-btn" onClick={clearAll}>Clear</button>
                                    </div>

                                    {/* Selected columns — drag to reorder */}
                                    {selectedCols.map((col, idx) => (
                                        <div
                                            key={col}
                                            className="table-column-row table-column-row--selected"
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, idx)}
                                            onDragEnd={handleDragEnd}
                                            onDragOver={handleDragOver}
                                            onDragEnter={handleDragEnter}
                                            onDragLeave={handleDragLeave}
                                            onDrop={(e) => handleDrop(e, idx)}
                                        >
                                            <Icon name="grip-vertical" className="table-column-grip" />
                                            <input type="checkbox" className="table-column-checkbox" checked onChange={() => toggleColumn(col, false)}/>
                                            <div className="table-column-info">
                                                <span className="table-column-name">{col}</span>
                                                <input
                                                    className="table-column-label-input"
                                                    value={(config.column_labels || {})[col] || ""}
                                                    onChange={(e) => {
                                                        const labels = {...(config.column_labels || {}), [col]: e.target.value};
                                                        setConfigField("column_labels", labels);
                                                    }}
                                                    placeholder={col.replace(/[_-]/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                                                />
                                            </div>
                                        </div>
                                    ))}

                                    {/* Unselected columns */}
                                    {unselectedCols.map(col => (
                                        <div key={col} className="table-column-row">
                                            <input type="checkbox" className="table-column-checkbox" checked={false} onChange={() => toggleColumn(col, true)}/>
                                            <div className="table-column-info">
                                                <span className="table-column-name">{col}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="panel-config-type-hint" style={{marginTop: 4}}>
                                    {isLoadingColumns ? "Inspecting last execution..." : (floId ? "Run the flow first to discover column names." : "Select a flow to discover columns.")}
                                </div>
                            )}
                        </div>
                    </>
                );
            }

            case "text":
                return (
                    <>
                        <div className="panel-config-divider"/>
                        <div className="panel-config-type-hint">
                            Renders static markdown text. No data source needed.
                        </div>
                        <div className="panel-config-section">
                            <div className="panel-config-section-label">Markdown Content</div>
                            <textarea className="panel-config-textarea" value={config.content || ""} onChange={(e) => setConfigField("content", e.target.value)} placeholder={"# Heading\nSome **bold** text..."} rows={8}/>
                        </div>
                    </>
                );

            case "gauge":
                return (
                    <>
                        <div className="panel-config-divider"/>
                        <div className="panel-config-type-hint">
                            Renders a gauge dial. Your flow should output a numeric value.
                        </div>
                        {renderKeyField("Value Key", "e.g. cpu, memory, progress", config.value_key || "", v => setConfigField("value_key", v))}
                        <div className="panel-config-row">
                            <div className="panel-config-section" style={{flex: 1}}>
                                <div className="panel-config-section-label">Min</div>
                                <input className="panel-config-input" type="number" value={config.min ?? 0} onChange={(e) => setConfigField("min", Number(e.target.value))}/>
                            </div>
                            <div className="panel-config-section" style={{flex: 1}}>
                                <div className="panel-config-section-label">Max</div>
                                <input className="panel-config-input" type="number" value={config.max ?? 100} onChange={(e) => setConfigField("max", Number(e.target.value))}/>
                            </div>
                        </div>
                        <div className="panel-config-section">
                            <div className="panel-config-section-label">Unit Label</div>
                            <input className="panel-config-input" value={config.label || ""} onChange={(e) => setConfigField("label", e.target.value)} placeholder="e.g. %"/>
                        </div>
                    </>
                );

            case "status": {
                const statusKeys: string[] = config.status_keys || [];
                const statusLabels: Record<string, string> = config.labels || {};
                const COLOUR_PRESETS = ["#22c55e", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6", "#ec4899", "#00aa9c", "rgba(255,255,255,0.15)"];

                return (
                    <>
                        <div className="panel-config-divider"/>
                        <div className="panel-config-type-hint">
                            Shows status indicators with coloured dots. Your flow should output key-value pairs where values are status strings (e.g. "healthy", "down").
                        </div>
                        {renderMultiKeyField("Status Keys", "e.g. api, database, runner", statusKeys, v => setConfigField("status_keys", v))}

                        {statusKeys.length > 0 && (
                            <div className="panel-config-section">
                                <div className="panel-config-section-label">Display Labels</div>
                                <div className="panel-config-type-hint" style={{marginBottom: 4}}>
                                    Rename how each key appears. Leave blank to use the key name.
                                </div>
                                <div className="status-key-config-list">
                                    {statusKeys.map(k => (
                                        <div key={k} className="status-key-label-row">
                                            <span className="status-key-config-name">{k}</span>
                                            <input
                                                className="panel-config-input status-key-label-input"
                                                value={statusLabels[k] || ""}
                                                onChange={(e) => setConfigField("labels", {...statusLabels, [k]: e.target.value})}
                                                placeholder={k}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="panel-config-section">
                            <div className="panel-config-section-label">Good State</div>
                            <div className="status-state-config">
                                <div className="status-state-colour-row">
                                    <span className="status-state-label-text">Colour</span>
                                    <div className="status-colour-picker">
                                        {COLOUR_PRESETS.map(c => (
                                            <div
                                                key={"good-"+c}
                                                className={`status-colour-swatch ${(config.good_colour || "#22c55e") === c ? "status-colour-swatch--active" : ""}`}
                                                style={{background: c}}
                                                onClick={() => setConfigField("good_colour", c)}
                                            />
                                        ))}
                                    </div>
                                </div>
                                <div className="status-state-field">
                                    <span className="status-state-label-text">Values</span>
                                    <input className="panel-config-input" value={config.green_values || "healthy,active,ok,up,running,true,success,yes"} onChange={(e) => setConfigField("green_values", e.target.value)} placeholder="healthy, ok, up, true"/>
                                </div>
                            </div>
                        </div>

                        <div className="panel-config-section">
                            <div className="panel-config-section-label">Warning State</div>
                            <div className="status-state-config">
                                <div className="status-state-colour-row">
                                    <span className="status-state-label-text">Colour</span>
                                    <div className="status-colour-picker">
                                        {COLOUR_PRESETS.map(c => (
                                            <div
                                                key={"warn-"+c}
                                                className={`status-colour-swatch ${(config.warn_colour || "#f59e0b") === c ? "status-colour-swatch--active" : ""}`}
                                                style={{background: c}}
                                                onClick={() => setConfigField("warn_colour", c)}
                                            />
                                        ))}
                                    </div>
                                </div>
                                <div className="status-state-field">
                                    <span className="status-state-label-text">Values</span>
                                    <input className="panel-config-input" value={config.amber_values || "busy,degraded,warning,partial,warn"} onChange={(e) => setConfigField("amber_values", e.target.value)} placeholder="busy, degraded, warning"/>
                                </div>
                            </div>
                        </div>

                        <div className="panel-config-section">
                            <div className="panel-config-section-label">Bad State</div>
                            <div className="status-state-config">
                                <div className="status-state-colour-row">
                                    <span className="status-state-label-text">Colour</span>
                                    <div className="status-colour-picker">
                                        {COLOUR_PRESETS.map(c => (
                                            <div
                                                key={"bad-"+c}
                                                className={`status-colour-swatch ${(config.bad_colour || "#ef4444") === c ? "status-colour-swatch--active" : ""}`}
                                                style={{background: c}}
                                                onClick={() => setConfigField("bad_colour", c)}
                                            />
                                        ))}
                                    </div>
                                </div>
                                <div className="panel-config-type-hint" style={{marginTop: 2}}>
                                    Any value not matching Good or Warning is treated as Bad.
                                </div>
                            </div>
                        </div>
                    </>
                );
            }

            default:
                return null;
        }
    };

    return (
        <div className="panel-config-panel">
            <div className="panel-config-header">
                <div className="panel-config-header-title">Panel Settings</div>
                <button className="panel-config-close-btn" onClick={onClose}>&times;</button>
            </div>

            <div className="panel-config-body">
                <div className="panel-config-section">
                    <div className="panel-config-section-label">Panel Type</div>
                    <div className="panel-type-grid">
                        {WIDGET_TYPES.map(t => (
                            <button
                                key={t.type}
                                className={`panel-type-option ${widgetType === t.type ? "panel-type-option--selected" : ""}`}
                                onClick={() => setWidgetType(t.type)}
                            >
                                <Icon name={t.icon} className="panel-type-icon" />
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="panel-config-section">
                    <div className="panel-config-section-label">Title</div>
                    <input
                        className="panel-config-input"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Panel title..."
                    />
                </div>

                {widgetType !== "text" && (
                    <div className="panel-config-section" ref={flowDropdownRef}>
                        <div className="panel-config-section-label">Data Source</div>
                        <div className="flow-autocomplete">
                            <input
                                className="panel-config-input"
                                value={showFlowDropdown ? flowSearch : (selectedFlow?.name || "")}
                                onChange={(e) => {
                                    setFlowSearch(e.target.value);
                                    setShowFlowDropdown(true);
                                }}
                                onFocus={() => {
                                    setFlowSearch("");
                                    setShowFlowDropdown(true);
                                }}
                                placeholder="Search flows..."
                            />
                            {showFlowDropdown && (
                                <div className="flow-autocomplete-dropdown">
                                    <div
                                        className={`flow-autocomplete-option ${!floId ? "flow-autocomplete-option--selected" : ""}`}
                                        onClick={() => {
                                            setFloId("");
                                            setShowFlowDropdown(false);
                                            onFlowSelected("");
                                        }}
                                    >
                                        <span style={{color: "rgba(255,255,255,0.3)", fontStyle: "italic"}}>None (static data)</span>
                                    </div>
                                    {filteredFlows.map(f => (
                                        <div
                                            key={f.id}
                                            className={`flow-autocomplete-option ${floId === f.id ? "flow-autocomplete-option--selected" : ""}`}
                                            onClick={() => {
                                                setFloId(f.id);
                                                setShowFlowDropdown(false);
                                                onFlowSelected(f.id);
                                            }}
                                        >
                                            <div className="flow-autocomplete-dot"/>
                                            {f.name}
                                        </div>
                                    ))}
                                    {filteredFlows.length === 0 && (
                                        <div className="flow-autocomplete-empty">No flows found</div>
                                    )}
                                </div>
                            )}
                        </div>
                        {keys.length > 0 && (
                            <div className="flow-keys-indicator">
                                <span className="flow-keys-label">Available outputs:</span>
                                {keys.map(k => <span key={k} className="flow-key-tag">{k}</span>)}
                            </div>
                        )}
                    </div>
                )}

                {renderTypeConfig()}

                <button className="panel-apply-btn" onClick={handleApply}>
                    <Icon name="save" />
                    Apply Changes
                </button>
            </div>

            <div className="panel-config-footer">
                <button className="panel-config-footer-btn panel-config-footer-btn--danger" onClick={onDelete}>
                    <Icon name="trash" />
                    Delete Panel
                </button>
            </div>
        </div>
    );
}

function EditorGrid({widgets, selectedWidgetId, onSelect, onAddWidget, onReorder}: {
    widgets: DashboardWidget[];
    selectedWidgetId: string | null;
    onSelect: (id: string) => void;
    onAddWidget: () => void;
    onReorder: (fromIdx: number, toIdx: number) => void;
}) {
    const handleDragStart = (e: React.DragEvent, idx: number) => {
        e.dataTransfer.setData("application/widget-index", String(idx));
        e.dataTransfer.effectAllowed = "move";
        (e.currentTarget as HTMLElement).classList.add("widget-card--dragging");
    };

    const handleDragEnd = (e: React.DragEvent) => {
        (e.currentTarget as HTMLElement).classList.remove("widget-card--dragging");
        document.querySelectorAll(".widget-card--drag-over").forEach(el => el.classList.remove("widget-card--drag-over"));
    };

    const handleDragOver = (e: React.DragEvent) => {
        if (e.dataTransfer.types.includes("application/widget-index")) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
        }
    };

    const handleDragEnter = (e: React.DragEvent) => {
        if (e.dataTransfer.types.includes("application/widget-index")) {
            (e.currentTarget as HTMLElement).classList.add("widget-card--drag-over");
        }
    };

    const handleDragLeave = (e: React.DragEvent) => {
        (e.currentTarget as HTMLElement).classList.remove("widget-card--drag-over");
    };

    const handleDrop = (e: React.DragEvent, targetIdx: number) => {
        e.preventDefault();
        (e.currentTarget as HTMLElement).classList.remove("widget-card--drag-over");
        const sourceIdx = parseInt(e.dataTransfer.getData("application/widget-index"), 10);
        if (!isNaN(sourceIdx) && sourceIdx !== targetIdx) {
            onReorder(sourceIdx, targetIdx);
        }
    };

    return (
        <div className="editor-simple-grid">
            {widgets.map((w, idx) => (
                <div
                    key={w.id}
                    className={`widget-card widget-card--editable ${selectedWidgetId === w.id ? "widget-card--selected" : ""}`}
                    onClick={() => onSelect(w.id)}
                    draggable
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragEnd={handleDragEnd}
                    onDragOver={handleDragOver}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, idx)}
                    style={{gridColumn: `span ${Math.min(w.grid_w || 4, 12)}`, gridRow: `span ${w.grid_h || 3}`}}
                >
                    <div className="widget-card-header">
                        <Icon name="grip-vertical" className="widget-card-drag-handle" />
                        <div className="widget-card-title">{w.title || "Untitled"}</div>
                    </div>
                    <div className="widget-card-body">
                        <div style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            height: "100%",
                            color: "rgba(255,255,255,0.15)",
                            fontSize: 12,
                            gap: 6,
                        }}>
                            <Icon name={WIDGET_TYPES.find(t => t.type === w.widget_type)?.icon || "hashtag"} />
                            {w.widget_type || "stat"}
                        </div>
                    </div>
                </div>
            ))}
            <div className="ghost-add-panel" onClick={onAddWidget}>
                <Icon name="plus" />
                <span>Add Panel</span>
            </div>
        </div>
    );
}

export default function BoardEditor() {
    const {id} = useParams();
    const navigate = useNavigate();
    const token = useCookieToken();
    const {showToast} = useToast();

    const isNewBoard = !id;
    const [board, setBoard] = useState<Dashboard | null>(null);
    const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
    const [isLoading, setIsLoading] = useState(!isNewBoard);
    const [isSaving, setIsSaving] = useState(false);
    const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
    const [flows, setFlows] = useState<Flo[]>([]);
    const [flowOutputKeys, setFlowOutputKeys] = useState<string[]>([]);
    const [executionOutputKeys, setExecutionOutputKeys] = useState<string[]>([]);
    const [tableColumnKeys, setTableColumnKeys] = useState<string[]>([]);
    const [isLoadingColumns, setIsLoadingColumns] = useState(false);
    const [showActionsMenu, setShowActionsMenu] = useState(false);

    const [boardName, setBoardName] = useState("");
    const [boardDescription, setBoardDescription] = useState("");
    const [boardIsPublic, setBoardIsPublic] = useState(false);
    const [boardRefreshInterval, setBoardRefreshInterval] = useState(0);

    const actionsMenuRef = useRef<HTMLDivElement>(null);

    const fetchBoard = useCallback(() => {
        if (!id || !token) return;
        api.get(API_URL + "/api/v1/board/" + id, {
            headers: {Authorization: "Bearer " + token}
        })
            .then(res => {
                const b = res.data as Dashboard;
                setBoard(b);
                setBoardName(b.name);
                setBoardDescription(b.description || "");
                setBoardIsPublic(b.is_public);
                setBoardRefreshInterval(b.refresh_interval || 0);
                setWidgets(b.widgets || []);
            })
            .catch(() => showToast("Failed to load dashboard", "error"))
            .finally(() => setIsLoading(false));
    }, [id, token]);

    const fetchFlows = useCallback(() => {
        if (!token) return;
        api.get(API_URL + "/api/v1/flo?limit=200", {
            headers: {Authorization: "Bearer " + token}
        })
            .then(res => {
                const data = res.data;
                setFlows(Array.isArray(data) ? data : data?.flos || []);
            })
            .catch(() => {});
    }, [token]);

    useEffect(() => {
        if (!isNewBoard) fetchBoard();
        fetchFlows();
    }, [fetchBoard, fetchFlows, isNewBoard]);

    useEffect(() => {
        if (isNewBoard && token) {
            api.post(API_URL + "/api/v1/board", {
                name: "Untitled Dashboard",
                description: "",
                is_public: false,
            }, {
                headers: {Authorization: "Bearer " + token}
            })
                .then(res => {
                    const b = res.data as Dashboard;
                    navigate("/board/" + b.id + "/edit", {replace: true});
                })
                .catch(() => {
                    showToast("Failed to create dashboard", "error");
                    navigate("/board");
                });
        }
    }, [isNewBoard, token]);

    // When a widget's flow changes, inspect that flow's outputs
    const selectedWidget = useMemo(
        () => widgets.find(w => w.id === selectedWidgetId) || null,
        [widgets, selectedWidgetId]
    );

    const fetchFlowKeys = useCallback((floId: string) => {
        if (!floId || !token) {
            setFlowOutputKeys([]);
            return;
        }
        api.get(API_URL + "/api/v1/flo/" + floId, {
            headers: {Authorization: "Bearer " + token}
        })
            .then(res => {
                const flo = res.data;
                const keys: string[] = [];
                if (flo?.revision?.data?.nodes) {
                    for (const node of flo.revision.data.nodes) {
                        const label = node?.data?.label || node?.type || "";

                        // "Set Output" — the "name" input's value is the output key
                        if (label === "output/set" && node?.data?.config?.inputs) {
                            for (const input of node.data.config.inputs) {
                                if (input?.name === "name" && input?.value && !keys.includes(input.value)) {
                                    keys.push(input.value);
                                }
                            }
                        }

                        // "Set Outputs" — passes all parent inputs through as outputs
                        // We can't know the exact keys statically, but we can look at
                        // connected parent nodes' outputs for hints
                        if (label === "output/set_outputs") {
                            // Find parent nodes via edges
                            const parentIds = (flo.revision.data.edges || [])
                                .filter((e: any) => e.target === node.id)
                                .map((e: any) => e.source);
                            for (const pid of parentIds) {
                                const parent = flo.revision.data.nodes.find((n: any) => n.id === pid);
                                if (parent?.data?.config?.outputs) {
                                    for (const output of parent.data.config.outputs) {
                                        if (output?.name && !keys.includes(output.name)) {
                                            keys.push(output.name);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                setFlowOutputKeys(keys);
            })
            .catch(() => setFlowOutputKeys([]));
    }, [token]);

    // Fetch table column keys from last execution output
    // Inspect the last execution to discover actual output keys and nested row keys
    const fetchExecutionKeys = useCallback((floId: string) => {
        if (!floId || !token) {
            setExecutionOutputKeys([]);
            setTableColumnKeys([]);
            return;
        }
        setIsLoadingColumns(true);
        api.get(API_URL + "/api/v1/execution?flo_id=" + floId + "&limit=1", {
            headers: {Authorization: "Bearer " + token}
        })
            .then(res => {
                const executions = res.data?.executions || res.data || [];
                if (!Array.isArray(executions) || executions.length === 0) {
                    setExecutionOutputKeys([]);
                    setTableColumnKeys([]);
                    return;
                }
                return api.get(API_URL + "/api/v1/execution/" + executions[0].id, {
                    headers: {Authorization: "Bearer " + token}
                });
            })
            .then(res => {
                if (!res) return;
                const result = res.data?.result;
                if (!result) { setExecutionOutputKeys([]); setTableColumnKeys([]); return; }

                const outputs = result.outputs || result;
                if (typeof outputs !== "object") { setExecutionOutputKeys([]); setTableColumnKeys([]); return; }

                // Top-level output keys (for stat, gauge, chart, status widgets)
                setExecutionOutputKeys(Object.keys(outputs));

                // Find nested array row keys (for table widget)
                const findArray = (obj: any): any[] | null => {
                    if (Array.isArray(obj)) return obj;
                    if (typeof obj === "string") {
                        try { const p = JSON.parse(obj); if (Array.isArray(p)) return p; } catch {}
                    }
                    if (typeof obj === "object" && obj !== null) {
                        for (const key of ["rows", "data", "results", "items"]) {
                            if (obj[key]) { const arr = findArray(obj[key]); if (arr) return arr; }
                        }
                        for (const key of Object.keys(obj)) {
                            const arr = findArray(obj[key]); if (arr) return arr;
                        }
                    }
                    return null;
                };
                const rows = findArray(outputs);
                setTableColumnKeys(rows && rows.length > 0 && typeof rows[0] === "object" && rows[0] !== null ? Object.keys(rows[0]) : []);
            })
            .catch(() => { setExecutionOutputKeys([]); setTableColumnKeys([]); })
            .finally(() => setIsLoadingColumns(false));
    }, [token]);

    // Fetch keys when a widget with a flow is selected
    useEffect(() => {
        if (selectedWidget?.flo_id) {
            fetchFlowKeys(selectedWidget.flo_id);
            fetchExecutionKeys(selectedWidget.flo_id);
        } else {
            setFlowOutputKeys([]);
            setExecutionOutputKeys([]);
            setTableColumnKeys([]);
        }
    }, [selectedWidget?.flo_id, fetchFlowKeys, fetchExecutionKeys]);

    // Close actions menu on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (actionsMenuRef.current && !actionsMenuRef.current.contains(e.target as Node)) {
                setShowActionsMenu(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const handleSave = useCallback(() => {
        if (!id || !token) return;
        setIsSaving(true);
        api.post(API_URL + "/api/v1/board/" + id, {
            name: boardName,
            description: boardDescription,
            is_public: boardIsPublic,
            refresh_interval: boardRefreshInterval,
        }, {
            headers: {Authorization: "Bearer " + token}
        })
            .then(() => showToast("Dashboard saved", "success"))
            .catch(() => showToast("Failed to save dashboard", "error"))
            .finally(() => setIsSaving(false));
    }, [id, token, boardName, boardDescription, boardIsPublic, boardRefreshInterval]);

    const handleAddWidget = useCallback(() => {
        if (!id || !token) return;
        const maxOrdering = widgets.reduce((max, w) => Math.max(max, w.ordering || 0), 0);
        const newWidget = {
            title: "New Panel",
            widget_type: "stat",
            config: {value_key: "value"},
            grid_x: 0,
            grid_y: Infinity,
            grid_w: 4,
            grid_h: 3,
            ordering: maxOrdering + 1,
        };

        api.post(API_URL + "/api/v1/board/" + id + "/widget", newWidget, {
            headers: {Authorization: "Bearer " + token}
        })
            .then(res => {
                // Re-fetch the full board to get proper widget data
                fetchBoard();
                showToast("Panel added", "success");
            })
            .catch(() => showToast("Failed to add panel", "error"));
    }, [id, token, fetchBoard]);

    const handleUpdateWidget = useCallback((widgetId: string, updates: Partial<DashboardWidget>) => {
        if (!id || !token) return;
        api.post(API_URL + "/api/v1/board/" + id + "/widget/" + widgetId, updates, {
            headers: {Authorization: "Bearer " + token}
        })
            .then(() => {
                setWidgets(prev => prev.map(w => w.id === widgetId ? {...w, ...updates} : w));
                showToast("Panel updated", "success");
            })
            .catch(() => showToast("Failed to update panel", "error"));
    }, [id, token]);

    const handleReorderWidgets = useCallback((fromIdx: number, toIdx: number) => {
        if (!id || !token) return;
        setWidgets(prev => {
            const newWidgets = [...prev];
            const [moved] = newWidgets.splice(fromIdx, 1);
            newWidgets.splice(toIdx, 0, moved);

            // Save new ordering to API
            const positions = newWidgets.map((w, i) => ({
                id: w.id,
                grid_x: w.grid_x || 0,
                grid_y: w.grid_y || 0,
                grid_w: w.grid_w || 4,
                grid_h: w.grid_h || 3,
                ordering: i,
            }));
            api.post(API_URL + "/api/v1/board/" + id + "/layout", {positions}, {
                headers: {Authorization: "Bearer " + token}
            }).catch(() => showToast("Failed to save layout", "error"));

            return newWidgets;
        });
    }, [id, token]);

    const handleDeleteWidget = useCallback((widgetId: string) => {
        if (!id || !token) return;
        api.delete(API_URL + "/api/v1/board/" + id + "/widget/" + widgetId, {
            headers: {Authorization: "Bearer " + token}
        })
            .then(() => {
                setWidgets(prev => prev.filter(w => w.id !== widgetId));
                if (selectedWidgetId === widgetId) setSelectedWidgetId(null);
                showToast("Panel removed", "success");
            })
            .catch(() => showToast("Failed to remove panel", "error"));
    }, [id, token, selectedWidgetId]);

    if (isLoading) {
        return (
            <Container>
                <div style={{display: "flex", alignItems: "center", justifyContent: "center", padding: 80, color: "rgba(255,255,255,0.3)", fontSize: 13}}>
                    <Icon name="spinner" spin style={{marginRight: 8}} />
                    Loading dashboard...
                </div>
            </Container>
        );
    }

    const REFRESH_OPTIONS = [
        {value: 0, label: "Disabled"},
        {value: 10, label: "Every 10s"},
        {value: 30, label: "Every 30s"},
        {value: 60, label: "Every 1m"},
        {value: 300, label: "Every 5m"},
        {value: 600, label: "Every 10m"},
    ];

    return (
        <Container noPadding>
            <div style={{display: "flex", flexDirection: "column", height: "100%", overflow: "hidden"}}>
                <div className="board-editor-topbar">
                    <div className="board-editor-title-wrap">
                        <button className="board-editor-btn" onClick={() => navigate(id ? "/board/" + id : "/board")} title="Back">
                            <Icon name="arrow-left" />
                        </button>
                        <input
                            className="board-editor-title-input"
                            value={boardName}
                            onChange={(e) => setBoardName(e.target.value)}
                            placeholder="Dashboard name..."
                        />
                    </div>
                    <div className="board-editor-controls">
                        {/* Actions dropdown for refresh interval + visibility */}
                        <div className="board-editor-actions-wrap" ref={actionsMenuRef}>
                            <button className="board-editor-btn" onClick={() => setShowActionsMenu(!showActionsMenu)}>
                                <Icon name="ellipsis-vertical" />
                            </button>
                            {showActionsMenu && (
                                <div className="board-editor-actions-menu">
                                    <div className="actions-menu-section">
                                        <div className="actions-menu-label">
                                            <Icon name="clock" style={{marginRight: 6}} />
                                            Auto-Refresh
                                        </div>
                                        {REFRESH_OPTIONS.map(opt => (
                                            <button
                                                key={opt.value}
                                                className={`actions-menu-item ${boardRefreshInterval === opt.value ? "actions-menu-item--active" : ""}`}
                                                onClick={() => setBoardRefreshInterval(opt.value)}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="actions-menu-divider"/>
                                    <div className="actions-menu-section">
                                        <div className="actions-menu-label">
                                            <Icon name={boardIsPublic? "globe" : "lock"} style={{marginRight: 6}} />
                                            Visibility
                                        </div>
                                        <button
                                            className={`actions-menu-item ${!boardIsPublic ? "actions-menu-item--active" : ""}`}
                                            onClick={() => setBoardIsPublic(false)}
                                        >
                                            <Icon name="lock" style={{marginRight: 6, opacity: 0.5}} /> Private
                                        </button>
                                        <button
                                            className={`actions-menu-item ${boardIsPublic ? "actions-menu-item--active" : ""}`}
                                            onClick={() => setBoardIsPublic(true)}
                                        >
                                            <Icon name="globe" style={{marginRight: 6, opacity: 0.5}} /> Public
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                        <button className="board-editor-btn board-editor-btn--discard" onClick={() => navigate(id ? "/board/" + id : "/board")}>
                            Discard
                        </button>
                        <button className="board-editor-btn board-editor-btn--save" onClick={handleSave} disabled={isSaving}>
                            <Icon name={isSaving? "spinner" : "save"} spin={isSaving} />
                            Save
                        </button>
                    </div>
                </div>

                {boardDescription && (
                    <div className="board-editor-description">
                        <textarea
                            className="board-editor-description-input"
                            value={boardDescription}
                            onChange={(e) => setBoardDescription(e.target.value)}
                            placeholder="Dashboard description..."
                            rows={1}
                        />
                    </div>
                )}

                <div className="board-editor-body">
                    <div className="board-editor-grid-area">
                        <EditorGrid
                            widgets={widgets}
                            selectedWidgetId={selectedWidgetId}
                            onSelect={setSelectedWidgetId}
                            onAddWidget={handleAddWidget}
                            onReorder={handleReorderWidgets}
                        />
                    </div>

                    {selectedWidget && (
                        <PanelConfigPanel
                            widget={selectedWidget}
                            flows={flows}
                            flowOutputKeys={flowOutputKeys}
                            executionOutputKeys={executionOutputKeys}
                            tableColumnKeys={tableColumnKeys}
                            isLoadingColumns={isLoadingColumns}
                            onFlowSelected={(floId) => { fetchFlowKeys(floId); fetchExecutionKeys(floId); }}
                            onUpdate={(updates) => handleUpdateWidget(selectedWidget.id, updates)}
                            onDelete={() => handleDeleteWidget(selectedWidget.id)}
                            onClose={() => setSelectedWidgetId(null)}
                        />
                    )}
                </div>
            </div>
        </Container>
    );
}
