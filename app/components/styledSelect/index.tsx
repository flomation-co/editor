import React, { useEffect, useRef, useState } from "react";
import { Icon } from "~/components/icons/Icon";
import "./index.css";

export type StyledSelectOption = {
    value: string;
    label: string;
    description?: string;
};

/**
 * StyledSelect is a dark-themed, accessible dropdown that replaces the native
 * <select>. It manages its own open/close state, closes on outside-click and
 * Escape, and supports an optional per-option description and a placeholder for
 * the unselected state.
 */
export default function StyledSelect({
    value,
    options,
    onChange,
    placeholder = "Select…",
    id,
}: {
    value: string;
    options: StyledSelectOption[];
    onChange: (value: string) => void;
    placeholder?: string;
    id?: string;
}) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const selected = options.find(o => o.value === value);

    useEffect(() => {
        if (!open) return;
        const onDocMouseDown = (e: MouseEvent) => {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("mousedown", onDocMouseDown);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDocMouseDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    return (
        <div className="styled-select" ref={rootRef}>
            <button
                type="button"
                id={id}
                className={`styled-select__trigger${selected ? "" : " styled-select__trigger--placeholder"}`}
                onClick={() => setOpen(o => !o)}
                aria-haspopup="listbox"
                aria-expanded={open}
            >
                <span className="styled-select__trigger-label">
                    {selected ? selected.label : placeholder}
                </span>
                <Icon name={open ? "chevron-up" : "chevron-down"} />
            </button>
            {open && (
                <div className="styled-select__panel" role="listbox">
                    {options.map(o => (
                        <button
                            key={o.value}
                            type="button"
                            role="option"
                            aria-selected={o.value === value}
                            className={`styled-select__option${o.value === value ? " styled-select__option--selected" : ""}`}
                            onClick={() => { onChange(o.value); setOpen(false); }}
                        >
                            <span className="styled-select__option-text">
                                <span className="styled-select__option-label">{o.label}</span>
                                {o.description && (
                                    <span className="styled-select__option-description">{o.description}</span>
                                )}
                            </span>
                            {o.value === value && (
                                <span className="styled-select__option-check"><Icon name="check" /></span>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
