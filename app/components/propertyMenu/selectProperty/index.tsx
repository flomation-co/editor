import React, {useEffect, useRef, useState} from "react";
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

function isVariableRef(val: string): boolean {
    return typeof val === "string" && /^\$\{[\w.-]+}$/.test(val);
}

const SelectProperty = (props: PropertyProps) => {
    const [value, setValue] = useState<string>(props.value);
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (props.onValueChange) {
            props.onValueChange(props.name, value);
        }
    }, [value]);

    useEffect(() => {
        setValue(props.value);
    }, [props.nodeId]);

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

    const showPicker = isVariableRef(value);
    const selectedOption = props.options.find(o => o.value === value);

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
                            <span className={selectedOption ? "" : "property-menu-select-placeholder"}>
                                {selectedOption ? selectedOption.name : "Select..."}
                            </span>
                            <svg className="property-menu-select-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none">
                                <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </button>
                        {open && (
                            <div className="property-menu-select-list">
                                {props.options && props.options.map(opt => (
                                    <div
                                        key={opt.value}
                                        className={`property-menu-select-option ${opt.value === value ? "active" : ""}`}
                                        onMouseDown={() => { setValue(opt.value); setOpen(false); }}
                                    >
                                        {opt.name}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <VariablePicker
                        value={value}
                        variables={props.variables ?? []}
                        onSelect={(ref) => setValue(ref)}
                        onClear={() => setValue("")}
                    />
                </div>
            )}
        </div>
    );
};

export default SelectProperty;
