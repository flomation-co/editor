import React, {useEffect, useMemo, useState} from "react";
import type {ParameterOption} from "~/types";
import type {VariableItem} from "~/components/propertyMenu/variableInput";
import VariablePicker from "~/components/propertyMenu/variablePicker";

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

const MultiSelectProperty = (props: PropertyProps) => {
    const [value, setValue] = useState<string>(props.value || "");

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
        const open = new Set<string>();
        for (const o of props.options) {
            if (o.group && sel.has(o.value)) open.add(o.group);
        }
        setOpenGroups(open);
    }, [props.nodeId]);

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

    const renderRow = (opt: ParameterOption) => {
        const id = `${props.nodeId}-${props.name}-${opt.value}`;
        return (
            <div
                key={opt.value}
                className="property-menu-input-inline-row property-menu-multi-select-row"
                style={{margin: 0}}
            >
                <label htmlFor={id} className="property-menu-checkbox-label">
                    <input
                        id={id}
                        type="checkbox"
                        checked={selected.has(opt.value)}
                        onChange={() => toggle(opt.value)}
                    />
                    <span className="property-menu-checkbox"></span>
                    {opt.name}
                </label>
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
                    <div className="property-menu-multi-select">
                        {!hasGroups
                            ? props.options.map(renderRow)
                            : groups.map(({group, options}) => {
                                if (!group) {
                                    return <React.Fragment key="__ungrouped">{options.map(renderRow)}</React.Fragment>;
                                }
                                const open = openGroups.has(group);
                                const selCount = options.filter(o => selected.has(o.value)).length;
                                return (
                                    <div key={group} className="property-menu-multi-select-group" style={{marginBottom: 4}}>
                                        <button
                                            type="button"
                                            onClick={() => toggleGroup(group)}
                                            aria-expanded={open}
                                            aria-label={`${group} events`}
                                            style={{
                                                display: "flex", alignItems: "center", gap: 8, width: "100%",
                                                background: "transparent", border: "none", cursor: "pointer",
                                                padding: "6px 2px", color: "inherit", font: "inherit", textAlign: "left",
                                            }}
                                        >
                                            <span style={{fontSize: 10, opacity: .7, width: 10}}>{open ? "▾" : "▸"}</span>
                                            <span style={{fontWeight: 600}}>{group}</span>
                                            {selCount > 0 && (
                                                <span style={{
                                                    fontSize: 11, fontWeight: 600, borderRadius: 10, padding: "1px 8px",
                                                    background: "#2684ff22", color: "#8fbaff",
                                                }}>{selCount}</span>
                                            )}
                                        </button>
                                        {open && <div style={{paddingLeft: 18}}>{options.map(renderRow)}</div>}
                                    </div>
                                );
                            })}
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
