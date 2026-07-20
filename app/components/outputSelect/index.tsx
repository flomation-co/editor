import React, { useState, useEffect, useRef } from "react";
import "~/components/flowSelect/index.css";

type OutputSelectProps = {
    value?: string;
    // Known output keys of the selected flow — offered as suggestions.
    options: string[];
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
};

// OutputSelect is the searchable picker for a flow's output key. It deliberately
// reuses the flow-select CSS (flow-select-input / -dropdown / -option) so the
// "Value flow" and "Value output" rows in the form builder are visually
// identical. Unlike FlowSelect it permits FREE TEXT — the output key can default
// to the field's own name or be a custom key not yet present in the (possibly
// still-loading) outputs list — so typing commits live, and the dropdown just
// surfaces the known outputs as filtered suggestions.
export default function OutputSelect({ value, options, onChange, placeholder = "Flow output to read; defaults to the field name", className }: OutputSelectProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));

    const select = (opt: string) => {
        setOpen(false);
        setSearch("");
        onChange(opt);
    };

    return (
        <div className={`flow-select-wrap ${className ?? ""}`.trim()} ref={ref}>
            <input
                className="flow-select-input"
                value={open ? search : (value || "")}
                onChange={e => { setSearch(e.target.value); setOpen(true); onChange(e.target.value); }}
                onFocus={() => { setSearch(""); setOpen(true); }}
                placeholder={placeholder}
            />
            {open && filtered.length > 0 && (
                <div className="flow-select-dropdown">
                    {filtered.map(o => (
                        <div
                            key={o}
                            className={`flow-select-option ${value === o ? "selected" : ""}`}
                            onMouseDown={(e) => { e.preventDefault(); select(o); }}
                        >
                            <div className="flow-select-dot" />
                            {o}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
