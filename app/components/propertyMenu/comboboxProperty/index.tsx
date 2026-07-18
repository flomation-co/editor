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
    // hideVariablePicker suppresses the ${...} expression button — for contexts
    // where variable references don't apply (e.g. the credential UI, which has
    // no flow to reference).
    hideVariablePicker?: boolean;
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

    // Mirrors SelectProperty: onValueChange fires whenever the value changes,
    // including once on mount. Kept identical so both option-backed fields
    // behave the same way through the property menu's change plumbing.
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

    // Filter the suggestions by what's been typed (matching the code or label),
    // unless the value already exactly equals an option — so a chosen value
    // shows the full list again rather than a single self-match.
    const q = (value ?? "").trim().toLowerCase();
    const exactMatch = options.some(o => o.value === value);
    const visibleOptions = q && !exactMatch
        ? options.filter(o => `${o.value} ${o.name}`.toLowerCase().includes(q))
        : options;

    return (
        <div className={"property-menu-input-row"} key={props.name}>
            <div className={"property-menu-input-name"}>
                {props.label ? props.label : props.name}
                {props.required && <span className="property-menu-required"> *</span>}
            </div>
            <div className="variable-mode-row" ref={ref}>
                <div className="property-menu-combobox">
                    {/* Open the suggestion list when the field is focused (not on
                        value change — that fires on mount and would open it on
                        load). display:contents keeps the layout unchanged. */}
                    <div style={{ display: "contents" }} onFocusCapture={() => setOpen(true)}>
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
                    </div>
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
                    {open && visibleOptions.length > 0 && (
                        <div className="property-menu-select-list property-menu-combobox-list">
                            {visibleOptions.map(opt => (
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
                {!props.hideVariablePicker && (
                    <VariablePicker
                        value={value}
                        variables={props.variables ?? []}
                        onSelect={(refValue) => setValue((prev) => prev + refValue)}
                        onClear={() => setValue("")}
                        alwaysButton={true}
                    />
                )}
            </div>
        </div>
    );
};

export default ComboboxProperty;
