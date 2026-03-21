import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import type { VariableItem } from "~/components/propertyMenu/variableInput";
import "./index.css";

type VariablePickerProps = {
    value: string;
    variables: VariableItem[];
    onSelect: (variableRef: string) => void;
    onClear: () => void;
};

function parseVariableRef(val: string): { category: string; name: string } | null {
    const match = typeof val === "string" && val.match(/^\$\{(secrets|env)\.(.+)}$/);
    if (!match) return null;
    return { category: match[1], name: match[2] };
}

const VariablePicker = (props: VariablePickerProps) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    const parsed = parseVariableRef(props.value);
    const isVariable = parsed !== null;
    const isValid = isVariable && props.variables.some(
        (v) => v.category === parsed!.category && v.name === parsed!.name
    );

    const filtered = useMemo(() => {
        if (!open) return [];
        const lower = search.toLowerCase();
        return props.variables.filter((v) => {
            const full = `${v.category}.${v.name}`.toLowerCase();
            return !lower || full.includes(lower) || v.name.toLowerCase().includes(lower);
        });
    }, [open, search, props.variables]);

    useEffect(() => {
        setSelectedIndex(0);
    }, [filtered.length]);

    useEffect(() => {
        if (open && searchRef.current) {
            searchRef.current.focus();
        }
    }, [open]);

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
                setSearch("");
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    const handleSelect = useCallback((v: VariableItem) => {
        props.onSelect(`\${${v.category}.${v.name}}`);
        setOpen(false);
        setSearch("");
    }, [props.onSelect]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (filtered.length === 0) return;
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setSelectedIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : 0));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filtered.length - 1));
        } else if (e.key === "Enter") {
            e.preventDefault();
            handleSelect(filtered[selectedIndex]);
        } else if (e.key === "Escape") {
            e.preventDefault();
            setOpen(false);
            setSearch("");
        }
    }, [filtered, selectedIndex, handleSelect]);

    if (isVariable) {
        const pillClass = isValid
            ? `vp-pill vp-pill--${parsed!.category}`
            : "vp-pill vp-pill--invalid";

        return (
            <div className="vp-selected">
                <span className={pillClass}>
                    {parsed!.category}.{parsed!.name}
                </span>
                <button
                    type="button"
                    className="vp-clear"
                    onClick={props.onClear}
                    title="Remove variable"
                >
                    &times;
                </button>
            </div>
        );
    }

    return (
        <div className="vp-container" ref={containerRef}>
            <button
                type="button"
                className="variable-mode-toggle"
                onClick={() => setOpen(!open)}
                title="Use a variable"
            >
                {"{x}"}
            </button>
            {open && (
                <div className="vp-dropdown">
                    <input
                        ref={searchRef}
                        className="vp-search"
                        type="text"
                        placeholder="Search variables..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                    <div className="vp-list">
                        {filtered.length === 0 && (
                            <div className="vp-empty">No variables found</div>
                        )}
                        {filtered.map((v, i) => (
                            <div
                                key={`${v.category}.${v.name}`}
                                className={`vp-item ${i === selectedIndex ? "vp-item--selected" : ""}`}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    handleSelect(v);
                                }}
                                onMouseEnter={() => setSelectedIndex(i)}
                            >
                                <span className={`vp-badge vp-badge--${v.category}`}>
                                    {v.category}
                                </span>
                                <span className="vp-name">{v.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default VariablePicker;
