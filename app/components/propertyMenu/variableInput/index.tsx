import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { Icon } from "~/components/icons/Icon";
import { detectSecret } from "~/lib/secretDetection";
import "./index.css";

export type VariableItem = {
    name: string;
    category: "secrets" | "env" | "input" | "flow" | "var" | "credentials" | "user";
    /** Optional label shown in autocomplete (e.g. parent node name) */
    source?: string;
    /** If set, this value is inserted instead of name. Used for scoped parent references where the display name is human-readable but the insert value uses node IDs. */
    insertName?: string;
    /** For credentials only — the lifecycle state of the underlying
     *  OAuth credential. "pending" means the user created the row
     *  but hasn't finished the OAuth handshake; "error" means the
     *  refresh poller couldn't exchange the refresh token. Both
     *  states are still selectable in the picker so the user can
     *  see what they have, but the dropdown badges them so the
     *  status is visible at the point of choice. */
    status?: "active" | "pending" | "error";
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
    display: string;
    category?: string;
    varName?: string;
    valid?: boolean;
};

function parseSegments(text: string, variables: VariableItem[]): ParsedSegment[] {
    const segments: ParsedSegment[] = [];
    const regex = /\$\{([\w.-]+)}/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            const t = text.slice(lastIndex, match.index);
            segments.push({ type: "text", value: t, display: t });
        }

        const inner = match[1];

        const scopedMatch = variables.find(
            (v) => v.category === "input" && v.insertName === inner
        );

        let category: string;
        let varName: string;
        let valid: boolean;
        let displayLabel: string | undefined;

        if (scopedMatch) {
            category = "input";
            varName = inner;
            valid = true;
            if (scopedMatch.source) {
                displayLabel = "${" + scopedMatch.source + " > " + scopedMatch.name + "}";
            }
        } else {
            const dotIndex = inner.indexOf(".");
            if (dotIndex >= 0) {
                category = inner.slice(0, dotIndex);
                varName = inner.slice(dotIndex + 1);
                if (category === "secret") category = "secrets";
            } else {
                category = "input";
                varName = inner;
            }

            valid = variables.some(
                (v) => v.category === category && (v.name === varName || v.insertName === varName)
            );

            // Check for friendly label on valid parent outputs
            if (valid && category === "input") {
                const matched = variables.find(
                    (v) => v.category === "input" && v.name === varName && v.source
                );
                if (matched?.source) {
                    displayLabel = "${" + matched.source + " > " + matched.name + "}";
                }
            }
        }

        segments.push({
            type: "variable",
            value: match[0],
            display: displayLabel || match[0],
            category,
            varName,
            valid,
        });

        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
        const t = text.slice(lastIndex);
        segments.push({ type: "text", value: t, display: t });
    }

    return segments;
}

/** Build the display string and a mapping from display positions to raw positions */
function buildDisplayMapping(segments: ParsedSegment[]) {
    let displayText = "";
    let rawOffset = 0;
    let displayOffset = 0;
    // Map from display offset → raw offset for each segment boundary
    const toRaw: { displayStart: number; displayEnd: number; rawStart: number; rawEnd: number }[] = [];

    for (const seg of segments) {
        const rawLen = seg.value.length;
        const displayLen = seg.display.length;
        toRaw.push({
            displayStart: displayOffset,
            displayEnd: displayOffset + displayLen,
            rawStart: rawOffset,
            rawEnd: rawOffset + rawLen,
        });
        displayText += seg.display;
        rawOffset += rawLen;
        displayOffset += displayLen;
    }

    return { displayText, toRaw };
}

function displayPosToRaw(pos: number, mapping: ReturnType<typeof buildDisplayMapping>["toRaw"]): number {
    for (const m of mapping) {
        if (pos <= m.displayStart) return m.rawStart;
        if (pos <= m.displayEnd) {
            // Proportional mapping within segment
            const ratio = (pos - m.displayStart) / (m.displayEnd - m.displayStart || 1);
            return Math.round(m.rawStart + ratio * (m.rawEnd - m.rawStart));
        }
    }
    // Past end
    const last = mapping[mapping.length - 1];
    return last ? last.rawEnd : pos;
}

function rawPosToDisplay(pos: number, mapping: ReturnType<typeof buildDisplayMapping>["toRaw"]): number {
    for (const m of mapping) {
        if (pos <= m.rawStart) return m.displayStart;
        if (pos <= m.rawEnd) {
            const ratio = (pos - m.rawStart) / (m.rawEnd - m.rawStart || 1);
            return Math.round(m.displayStart + ratio * (m.displayEnd - m.displayStart));
        }
    }
    const last = mapping[mapping.length - 1];
    return last ? last.displayEnd : pos;
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
    const suppressNextChange = useRef(false);

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

    const { displayText, toRaw } = useMemo(
        () => buildDisplayMapping(segments),
        [segments]
    );

    // Sync the input element's value to displayText
    useEffect(() => {
        const input = inputRef.current;
        const highlight = highlightRef.current;
        if (!input) return;
        if (input.value !== displayText) {
            const cursorPos = input.selectionStart ?? 0;
            const rawPos = displayPosToRaw(cursorPos, toRaw);
            suppressNextChange.current = true;
            input.value = displayText;
            const newDisplayPos = rawPosToDisplay(rawPos, toRaw);
            input.setSelectionRange(newDisplayPos, newDisplayPos);
        }
        // Always sync scroll after value changes — setting input.value
        // programmatically doesn't fire the scroll event
        if (highlight) {
            requestAnimationFrame(() => {
                highlight.scrollTop = input.scrollTop;
                highlight.scrollLeft = input.scrollLeft;
            });
        }
    }, [displayText, toRaw]);

    const filteredVariables = useMemo(() => {
        if (!autocomplete.visible) return [];
        const lower = autocomplete.filter.toLowerCase();
        return props.variables.filter((v) => {
            const full = `${v.category}.${v.name}`.toLowerCase();
            const src = (v.source || '').toLowerCase();
            return full.includes(lower) || v.name.toLowerCase().includes(lower) || src.includes(lower);
        });
    }, [autocomplete.visible, autocomplete.filter, props.variables]);

    useEffect(() => {
        setSelectedIndex(0);
    }, [filteredVariables.length]);

    const checkForAutocomplete = useCallback(
        (rawText: string, rawCursorPos: number) => {
            const before = rawText.slice(0, rawCursorPos);
            const openIndex = before.lastIndexOf("${");
            if (openIndex === -1) {
                setAutocomplete((prev) => ({ ...prev, visible: false }));
                return;
            }

            const between = before.slice(openIndex + 2);
            if (between.includes("}")) {
                setAutocomplete((prev) => ({ ...prev, visible: false }));
                return;
            }

            const filter = between;

            if (inputRef.current) {
                const inputRect = inputRef.current.getBoundingClientRect();
                const dropdownWidth = 300;
                const dropdownMaxHeight = 350;
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;

                let x = inputRect.left;
                if (x + dropdownWidth > viewportWidth) {
                    x = viewportWidth - dropdownWidth - 8;
                }
                if (x < 8) x = 8;

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
            // Find raw cursor position from display cursor
            const displayCursorPos = inputRef.current?.selectionStart ?? 0;
            const rawCursorPos = displayPosToRaw(displayCursorPos, toRaw);
            const afterCursor = value.slice(rawCursorPos);
            const varName = variable.insertName || variable.name;
            const insertion = variable.category === "input"
                ? `\${${varName}}`
                : `\${${variable.category}.${varName}}`;
            const newValue = before + insertion + afterCursor;
            setValue(newValue);
            setAutocomplete((prev) => ({ ...prev, visible: false }));

            requestAnimationFrame(() => {
                if (inputRef.current) {
                    inputRef.current.focus();
                    // Position cursor after the inserted variable in display space
                    const newSegments = parseSegments(newValue, props.variables);
                    const newMapping = buildDisplayMapping(newSegments);
                    const rawPos = before.length + insertion.length;
                    const newDisplayPos = rawPosToDisplay(rawPos, newMapping.toRaw);
                    inputRef.current.value = newMapping.displayText;
                    inputRef.current.setSelectionRange(newDisplayPos, newDisplayPos);
                }
            });
        },
        [value, autocomplete.insertStart, toRaw, props.variables]
    );

    const handleChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            if (suppressNextChange.current) {
                suppressNextChange.current = false;
                return;
            }

            const inputEl = e.target;
            const newDisplayValue = inputEl.value;
            const displayCursorPos = inputEl.selectionStart ?? 0;

            // Find what changed: diff the old displayText vs newDisplayValue
            // to determine the edit in raw space
            const oldDisplay = displayText;

            // Find common prefix and suffix
            let prefixLen = 0;
            while (prefixLen < oldDisplay.length && prefixLen < newDisplayValue.length && oldDisplay[prefixLen] === newDisplayValue[prefixLen]) {
                prefixLen++;
            }
            let suffixLen = 0;
            while (
                suffixLen < (oldDisplay.length - prefixLen) &&
                suffixLen < (newDisplayValue.length - prefixLen) &&
                oldDisplay[oldDisplay.length - 1 - suffixLen] === newDisplayValue[newDisplayValue.length - 1 - suffixLen]
            ) {
                suffixLen++;
            }

            const deletedDisplayLen = oldDisplay.length - prefixLen - suffixLen;
            const insertedDisplay = newDisplayValue.slice(prefixLen, newDisplayValue.length - suffixLen);

            // Map the edit range to raw space
            const rawEditStart = displayPosToRaw(prefixLen, toRaw);
            const rawEditEnd = displayPosToRaw(prefixLen + deletedDisplayLen, toRaw);

            // Apply the edit to the raw value
            const newRaw = value.slice(0, rawEditStart) + insertedDisplay + value.slice(rawEditEnd);
            setValue(newRaw);

            // Check autocomplete on the new raw value at the mapped cursor
            const rawCursorPos = rawEditStart + insertedDisplay.length;
            checkForAutocomplete(newRaw, rawCursorPos);
        },
        [displayText, value, toRaw, checkForAutocomplete]
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
            const displayCursorPos = target.selectionStart ?? 0;
            const rawCursorPos = displayPosToRaw(displayCursorPos, toRaw);
            checkForAutocomplete(value, rawCursorPos);
        },
        [value, toRaw, checkForAutocomplete]
    );

    const renderHighlight = () => {
        return segments.map((seg, i) => {
            if (seg.type === "variable") {
                const pillClass = seg.valid
                    ? `variable-pill variable-pill--${seg.category}`
                    : "variable-pill variable-pill--invalid";

                return (
                    <span key={i} className={pillClass}>
                        {seg.display}
                    </span>
                );
            }
            return <span key={i}>{seg.display}</span>;
        });
    };

    const InputElement = props.multiline ? "textarea" : "input";

    // Use the shared detector so this surface and NodeInspector can't
    // drift. See app/lib/secretDetection.ts for the pattern catalogue
    // and the rules about which references are exempt.
    const secretWarning = useMemo(() => detectSecret(value), [value]);

    return (
        <div
            className={`variable-input-container ${secretWarning ? "variable-input-container--has-secret" : ""}`}
            ref={containerRef}
        >
            <div
                ref={highlightRef}
                className={`variable-input-highlight ${props.multiline ? "variable-input-highlight--multiline" : ""}`}
                aria-hidden="true"
            >
                {renderHighlight()}
                <span>&nbsp;</span>
            </div>
            <InputElement
                ref={inputRef as any}
                className={`variable-input-field ${props.multiline ? "variable-input-field--multiline" : ""} ${secretWarning ? "variable-input-field--has-secret" : ""}`}
                placeholder={props.placeholder}
                defaultValue={displayText}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                onClick={handleClick}
                type={props.multiline ? undefined : "text"}
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
            />
            {secretWarning && (
                // Native title attribute is the tooltip — keeps this
                // surface dependency-free. The icon sits inside the
                // input's right padding via absolute positioning so
                // it doesn't disrupt the existing flex layout.
                <span
                    className="variable-input-secret-icon"
                    title={secretWarning}
                    aria-label={secretWarning}
                    role="img"
                >
                    <Icon name="warning" />
                </span>
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
