import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import type { VariableItem } from "~/components/propertyMenu/variableInput";
import { VariableCreateFooter } from "~/components/propertyMenu/VariableCreateFooter";
import "./index.css";

type VariablePickerProps = {
    value: string;
    variables: VariableItem[];
    onSelect: (variableRef: string) => void;
    onClear: () => void;
    /** When true, never switch to the chip-mode "selected variable" display —
     *  used for text inputs where the picker is an insertion tool rather than a
     *  full-value replacement. */
    alwaysButton?: boolean;
    /** When true, the toggle is rendered as a free-standing pill — rounded on
     *  all corners, separate from any field. Used for inputs (like checkbox
     *  groups) where there's no field edge to merge into. */
    standalone?: boolean;
};

// KNOWN_NAMESPACES is the closed set of namespace prefixes the editor
// recognises as first-class. Anything else falls into the "bare"
// reference bucket and is treated as an input (parent node output).
//
// "secret" and "credential" (singular) are accepted as aliases of
// their plural counterparts because both forms exist in older saved
// flows and the runtime substitution layer accepts both — see
// CLAUDE.md's "Variable substitution" note.
const KNOWN_NAMESPACES = "secrets|secret|env|flow|var|user|credentials|credential|loop|trigger";
// PREFIXED_RE captures namespace + everything else (including dots
// and brackets). The "everything else" is allowed to contain path
// segments — ${flow.user.profile.email} parses with name="user.profile.email"
// just fine since .+ is greedy.
const PREFIXED_RE = new RegExp(`^\\$\\{(${KNOWN_NAMESPACES})\\.(.+)}$`);

function parseVariableRef(val: string): { category: string; name: string } | null {
    if (typeof val !== "string") return null;
    const prefixed = val.match(PREFIXED_RE);
    if (prefixed) {
        let cat = prefixed[1];
        // Normalise the singular aliases to the canonical plural
        // category names used everywhere in the editor.
        if (cat === "secret") cat = "secrets";
        if (cat === "credential") cat = "credentials";
        return { category: cat, name: prefixed[2] };
    }
    // Bare reference (parent-node output, ${nodeId.field[.path...]}).
    // Allow brackets so ${nodeId.body[0].id} parses to the chip form
    // rather than falling back to the button mode.
    const bare = val.match(/^\$\{([\w.\-\[\]]+)}$/);
    if (bare) return { category: "input", name: bare[1] };
    return null;
}

const VariablePicker = (props: VariablePickerProps) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [dropdownPos, setDropdownPos] = useState<{top: number, left: number}>({top: 0, left: 0});
    const containerRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);
    const toggleRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

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
        const ref = v.category === "input"
            ? `\${${v.name}}`
            : `\${${v.category}.${v.name}}`;
        props.onSelect(ref);
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

    // Measure the trigger button and recompute dropdown position so it stays
    // glued to the button when the user scrolls or resizes. Capture-phase
    // listener catches scrolls on nested scroll containers (e.g. the property
    // menu's own scroll area) that wouldn't otherwise reach window.
    const computePosition = useCallback(() => {
        if (!toggleRef.current) return;
        const rect = toggleRef.current.getBoundingClientRect();
        const dropdownWidth = dropdownRef.current?.offsetWidth || 280;
        const dropdownHeight = dropdownRef.current?.offsetHeight || 350;

        let left = rect.right - dropdownWidth;
        if (left < 8) left = 8;
        if (left + dropdownWidth > window.innerWidth - 8) {
            left = window.innerWidth - dropdownWidth - 8;
        }

        let top = rect.bottom + 4;
        if (top + dropdownHeight > window.innerHeight - 8) {
            const above = rect.top - dropdownHeight - 4;
            if (above >= 8) top = above;
            else top = Math.max(8, window.innerHeight - dropdownHeight - 8);
        }

        setDropdownPos({top, left});
    }, []);

    useEffect(() => {
        if (!open) return;
        computePosition();
        // Re-measure after the dropdown has rendered (first measurement may
        // have used the 280px fallback before the actual content rendered).
        const raf = requestAnimationFrame(computePosition);
        const onScrollOrResize = () => computePosition();
        window.addEventListener("scroll", onScrollOrResize, true);
        window.addEventListener("resize", onScrollOrResize);
        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener("scroll", onScrollOrResize, true);
            window.removeEventListener("resize", onScrollOrResize);
        };
    }, [open, computePosition]);

    if (isVariable && !props.alwaysButton) {
        const pillClass = isValid
            ? `vp-pill vp-pill--${parsed!.category}`
            : "vp-pill vp-pill--invalid";

        // Display the full ${namespace.name} form so the chip reads
        // as a complete reference at a glance — consistent with the
        // inline VariableInput pill, which has always shown the
        // ${...} wrapping. We deliberately don't try to share the
        // inline pill's CSS here: that surface depends on zero
        // padding/margin to keep the textarea cursor aligned with
        // the visible characters (see CLAUDE.md memory on variable
        // pill layout). The chip is a free-standing component with
        // no cursor to align to, so it can carry the more polished
        // border/background look.
        return (
            <div className="vp-selected">
                <span className={pillClass}>
                    {`\${${parsed!.category}.${parsed!.name}}`}
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
                ref={toggleRef}
                type="button"
                className={`variable-mode-toggle ${props.standalone ? "variable-mode-toggle--standalone" : ""}`}
                onClick={() => setOpen(!open)}
                title="Use a variable"
            >
                {"$"}
            </button>
            {open && (
                <div ref={dropdownRef} className="vp-dropdown" style={{top: dropdownPos.top, left: dropdownPos.left}}>
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
                                {/* Lifecycle badge for credentials in a
                                    non-active state. Lets the user see
                                    at the point of choice that the
                                    credential they're about to pick
                                    isn't yet usable — without hiding
                                    it altogether. */}
                                {v.status && v.status !== "active" && (
                                    <span
                                        className={`vp-status vp-status--${v.status}`}
                                        title={
                                            v.status === "pending"
                                                ? "OAuth handshake not yet completed — finish the connection on the Credentials page before this credential can be used."
                                                : "The credential failed to refresh — check the Credentials page for the error."
                                        }
                                    >
                                        {v.status}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                    <VariableCreateFooter filter={search} />
                </div>
            )}
        </div>
    );
};

export default VariablePicker;
