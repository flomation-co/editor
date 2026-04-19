import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import "./index.css";

export type VariableItem = {
    name: string;
    category: "secrets" | "env" | "input" | "flow" | "var";
    /** Optional label shown in autocomplete (e.g. parent node name) */
    source?: string;
};

type VariableInputProps = {
    nodeId: string;
    name: string;
    placeholder: string;
    label: string;
    value: string;
    required?: boolean;
    multiline?: boolean;
    variables: VariableItem[];
    onValueChange?: (property: string, value: any) => void;
};

type ParsedSegment = {
    type: "text" | "variable";
    value: string;
    category?: string;
    varName?: string;
    valid?: boolean;
};

function parseSegments(text: string, variables: VariableItem[]): ParsedSegment[] {
    const segments: ParsedSegment[] = [];
    // Match ${secrets.NAME}, ${env.NAME}, or ${bare_name} (parent outputs)
    const regex = /\$\{([\w.-]+)}/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            segments.push({ type: "text", value: text.slice(lastIndex, match.index) });
        }

        const inner = match[1];
        const dotIndex = inner.indexOf(".");
        let category: string;
        let varName: string;

        if (dotIndex >= 0) {
            category = inner.slice(0, dotIndex);
            varName = inner.slice(dotIndex + 1);
            // Normalise "secret" → "secrets" to match the variable items
            if (category === "secret") category = "secrets";
        } else {
            // Bare name — parent output
            category = "input";
            varName = inner;
        }

        const valid = variables.some(
            (v) => v.category === category && v.name === varName
        );

        segments.push({
            type: "variable",
            value: match[0],
            category,
            varName,
            valid,
        });

        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
        segments.push({ type: "text", value: text.slice(lastIndex) });
    }

    return segments;
}

type AutocompleteState = {
    visible: boolean;
    x: number;
    y: number;
    filter: string;
    insertStart: number;
};

const VariableInput = (props: VariableInputProps) => {
    const [value, setValue] = useState<string>(props.value || "");
    const [autocomplete, setAutocomplete] = useState<AutocompleteState>({
        visible: false,
        x: 0,
        y: 0,
        filter: "",
        insertStart: -1,
    });
    const [selectedIndex, setSelectedIndex] = useState(0);

    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
    const highlightRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const autocompleteRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (props.onValueChange) {
            props.onValueChange(props.name, value);
        }
    }, [value]);

    useEffect(() => {
        setValue(props.value || "");
    }, [props.nodeId]);

    // Keep highlight div sized and scrolled to match the input/textarea
    useEffect(() => {
        const input = inputRef.current;
        const highlight = highlightRef.current;
        if (!input || !highlight) return;

        const syncSize = () => {
            highlight.style.height = input.offsetHeight + "px";
            highlight.style.width = input.offsetWidth + "px";
        };
        syncSize();

        const syncScroll = () => {
            highlight.scrollTop = input.scrollTop;
            highlight.scrollLeft = input.scrollLeft;
        };

        input.addEventListener("scroll", syncScroll);
        const observer = new ResizeObserver(syncSize);
        observer.observe(input);
        return () => {
            input.removeEventListener("scroll", syncScroll);
            observer.disconnect();
        };
    }, []);

    const segments = useMemo(
        () => parseSegments(value, props.variables),
        [value, props.variables]
    );

    const filteredVariables = useMemo(() => {
        if (!autocomplete.visible) return [];
        const lower = autocomplete.filter.toLowerCase();
        return props.variables.filter((v) => {
            const full = `${v.category}.${v.name}`.toLowerCase();
            return full.includes(lower) || v.name.toLowerCase().includes(lower);
        });
    }, [autocomplete.visible, autocomplete.filter, props.variables]);

    useEffect(() => {
        setSelectedIndex(0);
    }, [filteredVariables.length]);

    const checkForAutocomplete = useCallback(
        (text: string, cursorPos: number) => {
            // Look backwards from cursor for an unclosed ${
            const before = text.slice(0, cursorPos);
            const openIndex = before.lastIndexOf("${");
            if (openIndex === -1) {
                setAutocomplete((prev) => ({ ...prev, visible: false }));
                return;
            }

            // Check there's no closing } between ${ and cursor
            const between = before.slice(openIndex + 2);
            if (between.includes("}")) {
                setAutocomplete((prev) => ({ ...prev, visible: false }));
                return;
            }

            const filter = between;

            // Position the dropdown using viewport coordinates for fixed positioning
            if (inputRef.current) {
                const inputRect = inputRef.current.getBoundingClientRect();
                const dropdownWidth = 300;
                const dropdownMaxHeight = 350;
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;

                // Clamp horizontal position so dropdown stays within viewport
                let x = inputRect.left;
                if (x + dropdownWidth > viewportWidth) {
                    x = viewportWidth - dropdownWidth - 8;
                }
                if (x < 8) x = 8;

                // If not enough space below, show above
                let y = inputRect.bottom + 4;
                if (y + dropdownMaxHeight > viewportHeight) {
                    y = inputRect.top - dropdownMaxHeight - 4;
                    if (y < 8) y = 8;
                }

                setAutocomplete({
                    visible: true,
                    x,
                    y,
                    filter,
                    insertStart: openIndex,
                });
            }
        },
        []
    );

    const insertVariable = useCallback(
        (variable: VariableItem) => {
            const before = value.slice(0, autocomplete.insertStart);
            const afterCursor = inputRef.current
                ? value.slice(inputRef.current.selectionStart || 0)
                : "";
            // Parent outputs use bare ${name}, secrets/env use ${category.name}
            const insertion = variable.category === "input"
                ? `\${${variable.name}}`
                : `\${${variable.category}.${variable.name}}`;
            const newValue = before + insertion + afterCursor;
            setValue(newValue);
            setAutocomplete((prev) => ({ ...prev, visible: false }));

            // Restore focus and cursor position
            requestAnimationFrame(() => {
                if (inputRef.current) {
                    inputRef.current.focus();
                    const newPos = before.length + insertion.length;
                    inputRef.current.setSelectionRange(newPos, newPos);
                }
            });
        },
        [value, autocomplete.insertStart]
    );

    const handleChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            const newValue = e.target.value;
            setValue(newValue);
            checkForAutocomplete(newValue, e.target.selectionStart || 0);
        },
        [checkForAutocomplete]
    );

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (!autocomplete.visible || filteredVariables.length === 0) return;

            if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelectedIndex((prev) =>
                    prev < filteredVariables.length - 1 ? prev + 1 : 0
                );
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelectedIndex((prev) =>
                    prev > 0 ? prev - 1 : filteredVariables.length - 1
                );
            } else if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                insertVariable(filteredVariables[selectedIndex]);
            } else if (e.key === "Escape") {
                e.preventDefault();
                setAutocomplete((prev) => ({ ...prev, visible: false }));
            }
        },
        [autocomplete.visible, filteredVariables, selectedIndex, insertVariable]
    );

    const handleBlur = useCallback((e: React.FocusEvent) => {
        // Delay to allow click on autocomplete item
        setTimeout(() => {
            if (
                autocompleteRef.current &&
                autocompleteRef.current.contains(document.activeElement)
            ) {
                return;
            }
            setAutocomplete((prev) => ({ ...prev, visible: false }));
        }, 200);
    }, []);

    const handleClick = useCallback(
        (e: React.MouseEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            const target = e.target as HTMLInputElement | HTMLTextAreaElement;
            checkForAutocomplete(value, target.selectionStart || 0);
        },
        [value, checkForAutocomplete]
    );

    const renderHighlight = () => {
        return segments.map((seg, i) => {
            if (seg.type === "variable") {
                const pillClass = seg.valid
                    ? `variable-pill variable-pill--${seg.category}`
                    : "variable-pill variable-pill--invalid";
                return (
                    <span key={i} className={pillClass}>
                        {seg.value}
                    </span>
                );
            }
            // Preserve spaces and newlines
            return <span key={i}>{seg.value}</span>;
        });
    };

    const InputElement = props.multiline ? "textarea" : "input";

    const secretWarning = useMemo(() => {
        if (!value || value.includes('${secrets.') || value.includes('${secret.')) return null;
        const patterns = [
            /^(sk|pk|rk)[-_][a-zA-Z0-9]{20,}/,          // Stripe/API keys
            /^(ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{20,}/,  // GitHub tokens
            /^xox[bpsa]-[a-zA-Z0-9-]+/,                  // Slack tokens
            /^AKIA[A-Z0-9]{16}/,                          // AWS access keys
            /^eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]+/,   // JWT tokens
            /^glpat-[a-zA-Z0-9_-]{20,}/,                 // GitLab tokens
            /^[a-f0-9]{40,64}$/,                          // Long hex strings (API keys/hashes)
            /^-----BEGIN (RSA |EC )?PRIVATE KEY/,          // Private keys
        ];
        const trimmed = value.trim();
        if (trimmed.length < 20) return null;
        for (const p of patterns) {
            if (p.test(trimmed)) return "This value looks like a secret or API key. Consider using ${secrets.name} instead.";
        }
        return null;
    }, [value]);

    return (
        <div className="variable-input-container" ref={containerRef}>
            <div
                ref={highlightRef}
                className={`variable-input-highlight ${props.multiline ? "variable-input-highlight--multiline" : ""}`}
                aria-hidden="true"
            >
                {renderHighlight()}
                {/* Trailing space so highlight div matches input sizing */}
                <span>&nbsp;</span>
            </div>
            <InputElement
                ref={inputRef as any}
                className={`variable-input-field ${props.multiline ? "variable-input-field--multiline" : ""}`}
                placeholder={props.placeholder}
                value={value}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                onClick={handleClick}
                type={props.multiline ? undefined : "text"}
            />
            {secretWarning && (
                <div className="variable-secret-warning">
                    &#x26A0; {secretWarning}
                </div>
            )}
            {autocomplete.visible && filteredVariables.length > 0 && (
                <div
                    ref={autocompleteRef}
                    className="variable-autocomplete"
                    style={{ top: autocomplete.y, left: autocomplete.x }}
                >
                    {filteredVariables.map((v, i) => (
                        <div
                            key={`${v.category}.${v.name}`}
                            className={`variable-autocomplete-item ${i === selectedIndex ? "variable-autocomplete-item--selected" : ""}`}
                            onMouseDown={(e) => {
                                e.preventDefault();
                                insertVariable(v);
                            }}
                            onMouseEnter={() => setSelectedIndex(i)}
                        >
                            <span
                                className={`variable-autocomplete-badge variable-autocomplete-badge--${v.category}`}
                            >
                                {v.category}
                            </span>
                            <span className="variable-autocomplete-name">
                                {v.name}
                            </span>
                            {v.source && (
                                <span className="variable-autocomplete-source">
                                    {v.source}
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default VariableInput;
