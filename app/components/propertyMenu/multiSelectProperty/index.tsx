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

    const showPicker = isVariableRef(value);

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
                        {props.options.map(opt => {
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
