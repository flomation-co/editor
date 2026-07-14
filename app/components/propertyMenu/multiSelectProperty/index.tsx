import React, {useEffect, useMemo, useRef, useState} from "react";
import type {ParameterOption} from "~/types";
import type {VariableItem} from "~/components/propertyMenu/variableInput";
import VariablePicker from "~/components/propertyMenu/variablePicker";
import "~/components/propertyMenu/selectProperty/index.css";
import "./index.css";

type PropertyProps = {
    nodeId: string;
    name: string;
    label: string;
    value: string;
    options: ParameterOption[];
    required?: boolean;
    variables?: VariableItem[];
    onValueChange?: (property: string, value: any) => void;
}

function isVariableRef(val: any): boolean {
    return typeof val === "string" && /^\$\{[\w.-]+}$/.test(val);
}

function parseSelected(raw: string): Set<string> {
    if (!raw) return new Set();
    return new Set(raw.split(",").map(s => s.trim()).filter(Boolean));
}

// groupOptions preserves the first-seen order of both groups and options. An
// option with no `group` lands in the leading ungrouped bucket ("").
function groupOptions(options: ParameterOption[]): {group: string; options: ParameterOption[]}[] {
    const order: string[] = [];
    const map = new Map<string, ParameterOption[]>();
    for (const o of options) {
        const g = o.group || "";
        if (!map.has(g)) {
            map.set(g, []);
            order.push(g);
        }
        map.get(g)!.push(o);
    }
    return order.map(g => ({group: g, options: map.get(g)!}));
}

// MultiSelectProperty renders a closed dropdown (matching the single-select
// SelectProperty shell) whose panel holds tick-toggle rows. Selecting an option
// keeps the panel open so several can be picked; the trigger summarises the
// current picks. Grouped options (e.g. webhook event families) stay collapsible
// inside the panel.
const MultiSelectProperty = (props: PropertyProps) => {
    const [value, setValue] = useState<string>(props.value || "");
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (props.onValueChange) {
            props.onValueChange(props.name, value);
        }
    }, [value]);

    useEffect(() => {
        setValue(props.value || "");
    }, [props.nodeId]);

    const selected = useMemo(() => parseSelected(value), [value]);
    const groups = useMemo(() => groupOptions(props.options), [props.options]);
    const hasGroups = useMemo(() => groups.some(g => g.group !== ""), [groups]);

    // Which groups are expanded. Seed open = any group with a current selection,
    // so a returning user sees their picks. Deliberately re-seeds ONLY when the
    // node changes, not on every value/options change: re-seeding on value change
    // would re-open a group the user just collapsed. props.value / props.options
    // are read intentionally with a nodeId-only dependency (hence the disable).
    const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        const sel = parseSelected(props.value || "");
        const openSet = new Set<string>();
        for (const o of props.options) {
            if (o.group && sel.has(o.value)) openSet.add(o.group);
        }
        setOpenGroups(openSet);
    }, [props.nodeId]);

    // Close the dropdown on an outside click or Escape (mirrors SelectProperty).
    useEffect(() => {
        if (!open) return;
        const onDocClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("mousedown", onDocClick);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDocClick);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    const toggle = (optValue: string) => {
        const next = new Set(selected);
        if (next.has(optValue)) {
            next.delete(optValue);
        } else {
            next.add(optValue);
        }
        const ordered = props.options.filter(o => next.has(o.value)).map(o => o.value);
        setValue(ordered.join(","));
    };

    const toggleGroup = (group: string) => {
        const next = new Set(openGroups);
        next.has(group) ? next.delete(group) : next.add(group);
        setOpenGroups(next);
    };

    const showPicker = isVariableRef(value);

    // Trigger summary: the selected option NAMES in option order (nicer than the
    // stored values), else the placeholder.
    const selectedNames = useMemo(
        () => props.options.filter(o => selected.has(o.value)).map(o => o.name),
        [props.options, selected],
    );
    const summary = selectedNames.join(", ");

    const renderRow = (opt: ParameterOption) => {
        const isSel = selected.has(opt.value);
        return (
            <div
                key={opt.value}
                className={`property-menu-select-option property-menu-multi-option ${isSel ? "active" : ""}`}
                role="checkbox"
                aria-checked={isSel}
                onMouseDown={(e) => { e.preventDefault(); toggle(opt.value); }}
            >
                <span className="property-menu-multi-check" aria-hidden="true">
                    {isSel && (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M2.5 6.5L5 9L9.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                    )}
                </span>
                <span className="property-menu-multi-option-label">{opt.name}</span>
            </div>
        );
    };

    return (
        <div className={"property-menu-input-row"} key={props.name}>
            <div className={"property-menu-input-name"}>
                {props.label ? props.label : props.name}
                {props.required && <span className="property-menu-required"> *</span>}
            </div>
            {showPicker ? (
                <VariablePicker
                    value={value}
                    variables={props.variables || []}
                    onSelect={(ref) => setValue(ref)}
                    onClear={() => setValue("")}
                />
            ) : (
                <div className="variable-mode-row">
                    <div className="property-menu-select" ref={ref}>
                        <button
                            type="button"
                            className={`property-menu-select-trigger ${open ? "open" : ""}`}
                            onClick={() => setOpen(o => !o)}
                        >
                            <span className={summary ? "property-menu-multi-summary" : "property-menu-select-placeholder"}>
                                {summary || "Select..."}
                            </span>
                            <svg className="property-menu-select-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none">
                                <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </button>
                        {open && (
                            <div className="property-menu-select-list">
                                {!hasGroups
                                    ? props.options.map(renderRow)
                                    : groups.map(({group, options}) => {
                                        if (!group) {
                                            return <React.Fragment key="__ungrouped">{options.map(renderRow)}</React.Fragment>;
                                        }
                                        const groupOpen = openGroups.has(group);
                                        const selCount = options.filter(o => selected.has(o.value)).length;
                                        return (
                                            <div key={group} className="property-menu-multi-group">
                                                <button
                                                    type="button"
                                                    className="property-menu-multi-group-header"
                                                    onMouseDown={(e) => { e.preventDefault(); toggleGroup(group); }}
                                                    aria-expanded={groupOpen}
                                                    aria-label={`${group} events`}
                                                >
                                                    <span className="property-menu-multi-group-caret">{groupOpen ? "▾" : "▸"}</span>
                                                    <span className="property-menu-multi-group-name">{group}</span>
                                                    {selCount > 0 && (
                                                        <span className="property-menu-multi-group-count">{selCount}</span>
                                                    )}
                                                </button>
                                                {groupOpen && <div className="property-menu-multi-group-body">{options.map(renderRow)}</div>}
                                            </div>
                                        );
                                    })}
                            </div>
                        )}
                    </div>
                    <VariablePicker
                        value={value}
                        variables={props.variables ?? []}
                        onSelect={(ref) => setValue(ref)}
                        onClear={() => setValue("")}
                        standalone={true}
                    />
                </div>
            )}
        </div>
    );
};

export default MultiSelectProperty;
