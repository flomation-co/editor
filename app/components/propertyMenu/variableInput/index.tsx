import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { Icon } from "~/components/icons/Icon";
import { detectSecret } from "~/lib/secretDetection";
import { VariableCreateFooter } from "~/components/propertyMenu/VariableCreateFooter";
// Prism import sequence matters: the core must come first, then any
// languages that depend on `clike` (JavaScript, Bash) before the
// language files themselves. Importing each language file registers
// its grammar on the shared Prism.languages object via side-effect.
import Prism from "prismjs";
import "prismjs/components/prism-clike";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-python";
import "prismjs/components/prism-bash";
// Pre-stub support — registering the grammars now so adding a SQL
// or YAML code-typed input later is a zero-line editor change.
import "prismjs/components/prism-sql";
import "prismjs/components/prism-yaml";
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
    /** When true, the input/textarea uses a monospace stack. Highlight
     *  overlay also switches to monospace so the inline variable pills
     *  stay aligned with the underlying characters. Used by
     *  ConnectionTypeCode-typed inputs (script source). */
    monospace?: boolean;
    /** Prism grammar identifier (python / javascript / bash / sql /
     *  yaml). When set, plain-text segments between ${...} variable
     *  references are tokenised and colour-rendered into the
     *  highlight overlay. Variable pill rendering is unchanged. */
    language?: string;
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
    // pathLen is the number of characters in this segment's path
    // suffix (".products" or "[0].id" — the part after the
    // namespace+name root). Identical between display and raw
    // because the path bytes themselves are unchanged in the
    // friendly rendering. Used by the cursor-position mapping to
    // do 1:1 translation within the path region — so editing
    // (typing / backspacing) into the path doesn't get warped by
    // the prefix-length difference between friendly and raw.
    pathLen?: number;
};

// rootAndPath splits a reference body into a (root, pathSuffix) pair.
// The root is the "namespace.name" or "nodeId.outputKey" prefix the
// editor can validate against the known variables list; pathSuffix is
// the deeper JSON/array navigation the executor resolves at runtime
// via ParseReference + ResolvePath. We preserve the original
// characters (dots + brackets) in pathSuffix so the rendered chip
// reads as the user typed it: ${parent > response_body.data[0].id}.
//
// Examples:
//   "nodeUUID.body"         -> root="nodeUUID.body", path=""
//   "nodeUUID.body.data"    -> root="nodeUUID.body", path=".data"
//   "nodeUUID.body[0].id"   -> root="nodeUUID.body", path="[0].id"
//   "flow.user_name"        -> root="flow.user_name", path=""
//   "secrets.API_KEY"       -> root="secrets.API_KEY", path=""
function rootAndPath(inner: string): { root: string; path: string } {
    // Boundary = second dot OR first bracket, whichever is earlier.
    // Everything before is the validatable root; everything from
    // there on is the opaque runtime-resolved path.
    const firstDot = inner.indexOf(".");
    if (firstDot < 0) return { root: inner, path: "" };
    const secondDot = inner.indexOf(".", firstDot + 1);
    const firstBracket = inner.indexOf("[");
    const candidates = [secondDot, firstBracket].filter(i => i >= 0);
    if (candidates.length === 0) return { root: inner, path: "" };
    const boundary = Math.min(...candidates);
    return { root: inner.slice(0, boundary), path: inner.slice(boundary) };
}

function parseSegments(text: string, variables: VariableItem[]): ParsedSegment[] {
    const segments: ParsedSegment[] = [];
    // Allow bracket-index segments inside ${...} so path references
    // like ${node.body[0].id} render as a pill rather than raw text.
    // The captured inner still parses cleanly via rootAndPath.
    const regex = /\$\{([\w.\-\[\]]+)}/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            const t = text.slice(lastIndex, match.index);
            segments.push({ type: "text", value: t, display: t });
        }

        const inner = match[1];

        // Split inner into root + path so we can look up the root
        // against known variables and preserve the path segments
        // verbatim in both the underlying value and the display
        // label.
        const { root, path } = rootAndPath(inner);

        const scopedMatch = variables.find(
            (v) => v.category === "input" && v.insertName === root
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
                displayLabel = "${" + scopedMatch.source + " > " + scopedMatch.name + path + "}";
            }
        } else {
            const dotIndex = root.indexOf(".");
            if (dotIndex >= 0) {
                category = root.slice(0, dotIndex);
                varName = root.slice(dotIndex + 1);
                if (category === "secret") category = "secrets";
            } else {
                category = "input";
                varName = root;
            }

            valid = variables.some(
                (v) => v.category === category && (v.name === varName || v.insertName === varName)
            );

            // Friendly label on valid parent outputs. Includes the
            // path suffix so the chip reads as the user typed it
            // (e.g. "Parent Node > response_body.data[0].id").
            if (valid && category === "input") {
                const matched = variables.find(
                    (v) => v.category === "input" && v.name === varName && v.source
                );
                if (matched?.source) {
                    displayLabel = "${" + matched.source + " > " + matched.name + path + "}";
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
            pathLen: path.length,
        });

        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
        const t = text.slice(lastIndex);
        segments.push({ type: "text", value: t, display: t });
    }

    return segments;
}

/** Build the display string and a mapping from display positions to
 *  raw positions. For variable segments, also records the path
 *  region's boundary on both axes — the path is identical between
 *  display and raw, so the mapping is 1:1 in that region. Only the
 *  prefix region (where friendly labels shorten the display) needs
 *  boundary snapping. */
function buildDisplayMapping(segments: ParsedSegment[]) {
    let displayText = "";
    let rawOffset = 0;
    let displayOffset = 0;
    const toRaw: {
        displayStart: number; displayEnd: number;
        rawStart: number; rawEnd: number;
        // Where the path region BEGINS inside this segment. For
        // segments with no path, equals displayEnd-1 / rawEnd-1
        // (one before the closing brace) — i.e. the path region
        // is empty. For variable segments, the path region runs
        // [displayPathStart, displayEnd-1) ↔ [rawPathStart, rawEnd-1).
        displayPathStart: number;
        rawPathStart: number;
        // Whether this segment is a variable (pill) — text
        // segments map 1:1 throughout.
        isVariable: boolean;
    }[] = [];

    for (const seg of segments) {
        const rawLen = seg.value.length;
        const displayLen = seg.display.length;
        const pathLen = seg.pathLen ?? 0;
        const isVariable = seg.type === "variable";
        // For a variable segment, the path region ends just BEFORE
        // the closing brace. The brace is 1 char (the `}`). Path
        // starts pathLen characters before the brace position.
        const displayPathStart = isVariable
            ? displayOffset + displayLen - pathLen - 1
            : displayOffset;
        const rawPathStart = isVariable
            ? rawOffset + rawLen - pathLen - 1
            : rawOffset;
        toRaw.push({
            displayStart: displayOffset,
            displayEnd: displayOffset + displayLen,
            rawStart: rawOffset,
            rawEnd: rawOffset + rawLen,
            displayPathStart,
            rawPathStart,
            isVariable,
        });
        displayText += seg.display;
        rawOffset += rawLen;
        displayOffset += displayLen;
    }

    return { displayText, toRaw };
}

// displayPosToRaw maps a cursor position in the rendered (friendly-
// label) display space to the equivalent position in the underlying
// raw text. Pills with a shortened friendly label produce a display
// shorter than the raw, so proportional mapping is fundamentally
// lossy: cursor positions inside a pill's display land in the
// middle of the raw pill's characters, which corrupts edits when
// the user types path segments after the pill.
//
// Instead we treat each pill as ATOMIC: positions inside the pill
// snap to one of three boundaries —
//
//   - Just AFTER the opening "${" (rawStart + 2) — for edits at
//     the very start of the pill content.
//   - Just BEFORE the closing "}" (rawEnd - 1) — for edits at the
//     very end of the pill content. THIS is the common case for
//     path appends: the user clicks "after response_body, before }"
//     and types ".items[0].id".
//   - Falls back to the nearer boundary for mid-pill positions
//     (uncommon — pills are usually treated as opaque).
//
// Positions OUTSIDE all pill segments (plain text) map 1:1 between
// display and raw because text segments have display === value
// length.
// displayPosToRaw maps a cursor position in the rendered (friendly-
// label) display space to the equivalent position in the underlying
// raw text.
//
// For TEXT segments, display === raw — straightforward 1:1.
//
// For VARIABLE (pill) segments, the segment is split into:
//
//   [displayStart .. displayPathStart) — the friendly PREFIX
//   (different length on display vs raw because the friendly
//   label shortens the prefix).
//
//   [displayPathStart .. displayEnd - 1) — the PATH region
//   (identical bytes in display and raw — ".products" or "[0].id"
//   render the same in both). Cursor positions here map 1:1.
//
//   The closing brace `}` is treated as the boundary at the end.
//
// This split is the load-bearing insight: edits inside the path
// region of a pill (typing path segments, backspacing characters
// from a path) need byte-accurate mapping, which the path region's
// 1:1 character correspondence provides naturally.
function displayPosToRaw(pos: number, mapping: ReturnType<typeof buildDisplayMapping>["toRaw"]): number {
    for (const m of mapping) {
        if (pos <= m.displayStart) return m.rawStart;
        if (pos >= m.displayEnd) continue;

        if (!m.isVariable) {
            // Text segment — 1:1.
            return m.rawStart + (pos - m.displayStart);
        }

        // Variable segment. Which region is pos in?
        if (pos >= m.displayPathStart) {
            // Inside the path region OR at the closing brace.
            // Both the path region and the brace use 1:1 mapping
            // from displayPathStart onwards because the bytes are
            // identical in display and raw.
            return m.rawPathStart + (pos - m.displayPathStart);
        }

        // Inside the friendly prefix — snap to nearer boundary.
        // The user shouldn't be editing in the friendly-name
        // portion (it's a synthesised label, not real text); we
        // snap to either "before the opening brace" (rawStart) or
        // "start of the path region" (rawPathStart) based on
        // proximity.
        const fromStart = pos - m.displayStart;
        const fromPath = m.displayPathStart - pos;
        return fromStart < fromPath ? m.rawStart : m.rawPathStart;
    }
    const last = mapping[mapping.length - 1];
    return last ? last.rawEnd : pos;
}

// rawPosToDisplay is the symmetric inverse mapping. Same regional
// split: 1:1 within the path region, boundary-snap within the
// friendly prefix.
function rawPosToDisplay(pos: number, mapping: ReturnType<typeof buildDisplayMapping>["toRaw"]): number {
    for (const m of mapping) {
        if (pos <= m.rawStart) return m.displayStart;
        if (pos >= m.rawEnd) continue;

        if (!m.isVariable) {
            return m.displayStart + (pos - m.rawStart);
        }

        if (pos >= m.rawPathStart) {
            return m.displayPathStart + (pos - m.rawPathStart);
        }

        const fromStart = pos - m.rawStart;
        const fromPath = m.rawPathStart - pos;
        return fromStart < fromPath ? m.displayStart : m.displayPathStart;
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

// renderPrismTokens walks a Prism token tree and emits React spans
// with token-type class names. Each leaf token keeps zero
// padding/margin (enforced in CSS) so character positions in the
// overlay remain byte-for-byte aligned with the textarea cursor —
// the same constraint variable pills already follow.
//
// Prism tokens are either plain strings (no highlighting) or
// objects with a `type` string and a content payload that may
// itself be a string, another token, or a nested array. We recurse
// to preserve nested classifications (e.g. interpolation expressions
// inside a template literal).
function renderPrismTokens(tokens: (string | Prism.Token)[], keyPrefix: string = ""): React.ReactNode {
    return tokens.map((tok, i) => {
        const key = keyPrefix + i;
        if (typeof tok === "string") {
            return <span key={key}>{tok}</span>;
        }
        const types = ([tok.type] as string[])
            .concat(Array.isArray(tok.alias) ? tok.alias : (tok.alias ? [tok.alias] : []))
            .filter(Boolean)
            .map((t) => `code-token--${t}`)
            .join(" ");
        const className = `code-token ${types}`;
        const content = tok.content;
        if (typeof content === "string") {
            return <span key={key} className={className}>{content}</span>;
        }
        const inner = Array.isArray(content) ? content : [content];
        return (
            <span key={key} className={className}>
                {renderPrismTokens(inner as (string | Prism.Token)[], key + ".")}
            </span>
        );
    });
}

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

    // Resolved grammar for the current language. Undefined when no
    // language is set (regular text fields) or when the requested
    // grammar isn't loaded — both cases fall through to plain text.
    const grammar = useMemo(() => {
        if (!props.language) return null;
        return Prism.languages[props.language] ?? null;
    }, [props.language]);

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
            // Plain-text segment. Tokenise with Prism when a grammar
            // is loaded; otherwise fall through to a single span
            // preserving the original whitespace.
            if (grammar) {
                return (
                    <React.Fragment key={i}>
                        {renderPrismTokens(Prism.tokenize(seg.display, grammar))}
                    </React.Fragment>
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
                className={`variable-input-highlight ${props.multiline ? "variable-input-highlight--multiline" : ""} ${props.monospace ? "variable-input-highlight--monospace" : ""}`}
                aria-hidden="true"
            >
                {renderHighlight()}
                <span>&nbsp;</span>
            </div>
            <InputElement
                ref={inputRef as any}
                className={`variable-input-field ${props.multiline ? "variable-input-field--multiline" : ""} ${props.monospace ? "variable-input-field--monospace" : ""} ${secretWarning ? "variable-input-field--has-secret" : ""}`}
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
                <>
                    {/* Inline icon sits inside the input's right
                        padding via absolute positioning so it doesn't
                        disrupt the existing flex layout. The native
                        title attribute provides the tooltip — the
                        message text below carries the same content for
                        users who don't hover. */}
                    <span
                        className="variable-input-secret-icon"
                        title={secretWarning}
                        aria-label={secretWarning}
                        role="img"
                    >
                        <Icon name="warning" />
                    </span>
                    <div className="variable-input-secret-message" role="alert">
                        {secretWarning}
                    </div>
                </>
            )}
            {autocomplete.visible && (
                <div
                    ref={autocompleteRef}
                    className="variable-autocomplete"
                    style={{ top: autocomplete.y, left: autocomplete.x }}
                >
                    {filteredVariables.length === 0 && (
                        <div className="variable-autocomplete-empty">No matches</div>
                    )}
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
                    <VariableCreateFooter filter={autocomplete.filter} />
                </div>
            )}
        </div>
    );
};

export default VariableInput;
