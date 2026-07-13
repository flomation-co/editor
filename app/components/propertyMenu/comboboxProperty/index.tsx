import React, {useEffect, useRef, useState} from "react";
import type {ParameterOption} from "~/types";
import VariableInput, {type VariableItem} from "~/components/propertyMenu/variableInput";
import VariablePicker from "~/components/propertyMenu/variablePicker";

type PropertyProps = {
    nodeId: string;
    name: string;
    label: string;
    value: string;
    options: ParameterOption[];
    placeholder?: string;
    required?: boolean;
    variables?: VariableItem[];
    onValueChange?: (property: string, value: any) => void;
};

// ComboboxProperty is a text field whose value can be typed freely OR chosen
// from a shortlist of suggestions. It renders for inputs of type "combobox":
// open-ended fields that still benefit from a suggested list — the embedding
// Model, say, where the common models are worth offering but any model name is
// valid. A strict SelectProperty would trap anyone on a model not in the list;
// a plain StringProperty gives no help at all. This is the middle ground.
const ComboboxProperty = (props: PropertyProps) => {
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

    const options = props.options ?? [];

    return (
        <div className={"property-menu-input-row"} key={props.name}>
            <div className={"property-menu-input-name"}>
                {props.label ? props.label : props.name}
                {props.required && <span className="property-menu-required"> *</span>}
            </div>
            <div className="variable-mode-row" ref={ref}>
                <div className="property-menu-combobox">
                    <div className="property-menu-combobox-field">
                        <VariableInput
                            nodeId={props.nodeId}
                            name={props.name}
                            placeholder={props.placeholder ?? ""}
                            label={props.label}
                            value={value}
                            required={props.required}
                            multiline={false}
                            variables={props.variables ?? []}
                            onValueChange={(_, v) => setValue(v)}
                        />
                        {options.length > 0 && (
                            <button
                                type="button"
                                className={`property-menu-combobox-toggle ${open ? "open" : ""}`}
                                title="Suggested values"
                                onClick={() => setOpen(o => !o)}
                            >
                                <svg className="property-menu-select-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none">
                                    <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                            </button>
                        )}
                    </div>
                    {open && options.length > 0 && (
                        <div className="property-menu-select-list property-menu-combobox-list">
                            {options.map(opt => (
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
                    onSelect={(refValue) => setValue((prev) => prev + refValue)}
                    onClear={() => setValue("")}
                    alwaysButton={true}
                />
            </div>
        </div>
    );
};

export default ComboboxProperty;
