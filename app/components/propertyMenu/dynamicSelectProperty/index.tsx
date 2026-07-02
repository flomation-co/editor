import React, {useEffect, useRef, useState} from "react";
import type {ParameterOption} from "~/types";
import type {VariableItem} from "~/components/propertyMenu/variableInput";
import VariablePicker from "~/components/propertyMenu/variablePicker";
import api from "~/lib/api";
import useConfig from "~/components/config";
import useCookieToken from "~/components/cookie";
import "./index.css";

// DynamicSelectProperty is SelectProperty with its option list fetched from
// an api endpoint at edit time (declared per input via dynamic_options in
// the served action definition). The input's static options are the
// fallback when the fetch fails, so the dropdown degrades gracefully
// offline. Because fetched lists can be large (OpenRouter serves 300+
// models), the dropdown adds a search box, and unmatched search text can be
// committed verbatim so brand-new upstream values are never stranded.
type PropertyProps = {
    nodeId: string;
    name: string;
    label: string;
    value: string;
    endpoint: string;
    options: ParameterOption[];
    required?: boolean;
    variables?: VariableItem[];
    onValueChange?: (property: string, value: any) => void;
}

function isVariableRef(val: string): boolean {
    return typeof val === "string" && /^\$\{[\w.-]+}$/.test(val);
}

const DynamicSelectProperty = (props: PropertyProps) => {
    const config = useConfig();
    const token = useCookieToken();

    // The parent keys this component on node id + input name, so a node
    // switch remounts it and useState re-initialises from props — no sync
    // effect needed. The saved value only ever changes through the
    // user-interaction handlers below, never from an effect, so mounting
    // can never overwrite a stored value.
    const [value, setValue] = useState<string>(props.value);
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [fetched, setFetched] = useState<ParameterOption[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const ref = useRef<HTMLDivElement>(null);

    const commit = (val: string) => {
        setValue(val);
        if (props.onValueChange) {
            props.onValueChange(props.name, val);
        }
    };

    // Fetch on mount (and again if the endpoint ever changes) so a saved
    // value resolves to its display name immediately. Failures only set
    // the error banner — the static options keep the dropdown usable and
    // the value is untouched.
    useEffect(() => {
        let cancelled = false;
        setFetched(null);
        setLoading(true);
        setError("");
        const url = config("AUTOMATE_API_URL");
        api.get(`${url}${props.endpoint}`, {
            headers: {Authorization: "Bearer " + token},
        })
            .then(res => {
                if (cancelled) return;
                if (res?.data?.error || !Array.isArray(res?.data?.options)) {
                    setError(res?.data?.error || "Failed to load options");
                    return;
                }
                setFetched(res.data.options);
            })
            .catch(() => {
                if (!cancelled) setError("Failed to load options");
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [props.endpoint]);

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
    // An empty fetched list is treated as a failed fetch — the static
    // options are the documented fallback and must re-engage rather than
    // leaving the dropdown with nothing but the search box.
    const options = (fetched && fetched.length > 0) ? fetched : (props.options ?? []);
    const selectedOption = options.find(o => o.value === value);

    const query = search.trim().toLowerCase();
    const filtered = query
        ? options.filter(o =>
            o.name.toLowerCase().includes(query) || o.value.toLowerCase().includes(query))
        : options;
    // Offer a commit-verbatim row when the search text matches no option
    // value — the escape hatch for values newer than the fetched list (or
    // for endpoints that are temporarily down). The comparison is
    // case-insensitive like the filter above: model ids are case-sensitive
    // upstream, so a wrong-case variant of a listed id must not be
    // committable next to the canonical option.
    const exactMatch = options.some(o => o.value.toLowerCase() === query);
    const showFreeText = query !== "" && !exactMatch;

    const choose = (val: string) => {
        commit(val);
        setOpen(false);
        setSearch("");
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
                    onSelect={(ref) => commit(ref)}
                    onClear={() => commit("")}
                />
            ) : (
                <div className="variable-mode-row">
                    <div className="property-menu-select" ref={ref}>
                        <button
                            type="button"
                            className={`property-menu-select-trigger ${open ? "open" : ""}`}
                            onClick={() => setOpen(o => !o)}
                        >
                            <span className={(selectedOption || value) ? "" : "property-menu-select-placeholder"}>
                                {selectedOption
                                    ? selectedOption.name
                                    : value
                                        ? value
                                        : (loading ? "Loading..." : "Select...")}
                            </span>
                            <svg className="property-menu-select-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none">
                                <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </button>
                        {open && (
                            <div className="property-menu-select-list">
                                <input
                                    type="text"
                                    className="property-menu-select-search"
                                    placeholder="Search..."
                                    value={search}
                                    autoFocus
                                    onChange={e => setSearch(e.target.value)}
                                    onMouseDown={e => e.stopPropagation()}
                                />
                                {filtered.map(opt => (
                                    <div
                                        key={opt.value}
                                        className={`property-menu-select-option ${opt.value === value ? "active" : ""}`}
                                        onMouseDown={() => choose(opt.value)}
                                    >
                                        {opt.name}
                                        {opt.name !== opt.value && (
                                            <span className="property-menu-select-option-id">{opt.value}</span>
                                        )}
                                    </div>
                                ))}
                                {showFreeText && (
                                    <div
                                        className="property-menu-select-option property-menu-select-freetext"
                                        onMouseDown={() => choose(search.trim())}
                                    >
                                        Use "{search.trim()}"
                                    </div>
                                )}
                                {filtered.length === 0 && !showFreeText && (
                                    <div className="property-menu-select-empty">No matches</div>
                                )}
                            </div>
                        )}
                    </div>
                    <VariablePicker
                        value={value}
                        variables={props.variables ?? []}
                        onSelect={(ref) => commit(ref)}
                        onClear={() => commit("")}
                    />
                </div>
            )}
            {error && (
                <div className="property-menu-select-error">{error}</div>
            )}
        </div>
    );
};

export default DynamicSelectProperty;
