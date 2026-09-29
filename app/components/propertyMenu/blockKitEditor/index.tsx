import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {Icon} from "~/components/icons/Icon";
import CodeArea from "~/components/codeArea";
import VariableInput, {type VariableItem} from "~/components/propertyMenu/variableInput";
import {
    BLOCK_ICONS,
    BLOCK_LABELS,
    EDITABLE_TYPES,
    type BlockKitDoc,
    type EditableType,
    blockKitBuilderURL,
    describeProblems,
    isEditable,
    newBlock,
    parseBlocks,
    serialiseBlocks,
} from "./model";
import "./index.css";

type Props = {
    nodeId: string;
    value: string;
    onChange: (value: string) => void;
    variables?: VariableItem[];
    onClose: () => void;
};

/**
 * BKText adapts VariableInput to the shape this editor wants.
 *
 * VariableInput is built for a node property — it takes a nodeId and a property
 * name and reports back as (property, value). Here the value lives inside a
 * JSON document, not a named input, so the property name is only an identity
 * for the field and the callback is narrowed to the value. Using it rather than
 * a bare textarea is the point: ${...} keeps its pills and its picker, which
 * the field this replaces never offered.
 */
function BKText({nodeId, name, label, value, onChange, variables, multiline}: {
    nodeId: string;
    name: string;
    label: string;
    value: string;
    onChange: (v: string) => void;
    variables?: VariableItem[];
    multiline?: boolean;
}) {
    return (
        <label className="bk-field">
            <span className="bk-field-label">{label}</span>
            <VariableInput
                nodeId={nodeId}
                name={name}
                label={label}
                placeholder=""
                value={value ?? ""}
                multiline={multiline}
                variables={variables ?? []}
                onValueChange={(_property, v) => onChange(String(v ?? ""))}
            />
        </label>
    );
}

/**
 * A Block Kit editor that opens full-screen, with a visual mode and a JSON mode.
 *
 * The field this replaces was a textarea whose label had to explain the whole
 * format — accepted shapes, block types and a worked example — because there
 * was nowhere else to put any of it.
 *
 * Two rules shape the whole component:
 *
 *  1. JSON is the source of truth. The visual mode is a view over it. Switching
 *     modes re-reads rather than converting, so the two can never disagree.
 *
 *  2. Nothing is ever silently dropped. Blocks the visual mode cannot lay out
 *     are shown as raw cards — reorderable, deletable, editable as JSON — so a
 *     message pasted from Slack's own builder survives being opened here. An
 *     editor that quietly discarded what it did not understand would lose
 *     somebody's work with no error at all.
 */
export default function BlockKitEditor({nodeId, value, onChange, variables, onClose}: Props) {
    const [mode, setMode] = useState<"visual" | "json">("visual");

    // Raw JSON text is what we hold and emit. The parsed document is derived.
    const [text, setText] = useState(value || "");

    // Distinguishes our own echo from an external change, exactly as the form
    // builder does — without it, emitting would re-seed us mid-keystroke.
    const lastEmitted = useRef<string>(value || "");

    useEffect(() => {
        if (value === lastEmitted.current) return;
        lastEmitted.current = value || "";
        setText(value || "");
    }, [value]);

    const emit = useCallback((next: string) => {
        lastEmitted.current = next;
        setText(next);
        onChange(next);
    }, [onChange]);

    const parsed = useMemo(() => parseBlocks(text), [text]);
    const doc: BlockKitDoc = parsed.ok ? parsed.doc : {blocks: [], wrapped: false};
    const problems = useMemo(() => (parsed.ok ? describeProblems(doc) : []), [parsed.ok, doc]);

    // Every visual edit goes through here: mutate a copy, reserialise, emit.
    const update = useCallback((mutate: (blocks: any[]) => any[]) => {
        if (!parsed.ok) return;
        const next = {...parsed.doc, blocks: mutate([...parsed.doc.blocks])};
        emit(serialiseBlocks(next));
    }, [parsed, emit]);

    const patchBlock = useCallback((index: number, patch: any) => {
        update(bs => bs.map((b, i) => (i === index ? {...b, ...patch} : b)));
    }, [update]);

    const move = useCallback((index: number, delta: number) => {
        update(bs => {
            const to = index + delta;
            if (to < 0 || to >= bs.length) return bs;
            const copy = [...bs];
            const [item] = copy.splice(index, 1);
            copy.splice(to, 0, item);
            return copy;
        });
    }, [update]);

    const remove = useCallback((index: number) => {
        update(bs => bs.filter((_, i) => i !== index));
    }, [update]);

    const add = useCallback((type: EditableType) => {
        update(bs => [...bs, newBlock(type)]);
    }, [update]);

    // Escape closes, which is what a full-screen surface is expected to do.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    return (
        <div className="bk-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="bk-modal">
                <div className="bk-header">
                    <div className="bk-title">
                        <Icon name="slack" /> Block Kit message
                    </div>

                    <div className="bk-modes" role="tablist" aria-label="Editor mode">
                        <button
                            role="tab"
                            aria-selected={mode === "visual"}
                            className={mode === "visual" ? "bk-mode bk-mode--on" : "bk-mode"}
                            onClick={() => setMode("visual")}
                            // A message the visual mode cannot read is one the
                            // author has to repair in JSON first.
                            disabled={!parsed.ok}
                            title={parsed.ok ? "" : "Fix the JSON before switching to the visual editor"}
                        >
                            <Icon name="list" /> Visual
                        </button>
                        <button
                            role="tab"
                            aria-selected={mode === "json"}
                            className={mode === "json" ? "bk-mode bk-mode--on" : "bk-mode"}
                            onClick={() => setMode("json")}
                        >
                            <Icon name="code" /> JSON
                        </button>
                    </div>

                    <div className="bk-header-actions">
                        {parsed.ok && doc.blocks.length > 0 && (
                            <a
                                className="bk-link"
                                href={blockKitBuilderURL(doc)}
                                target="_blank"
                                rel="noreferrer noopener"
                                title="Open this message in Slack's own Block Kit Builder"
                            >
                                <Icon name="arrow-up-right-from-square" /> Slack builder
                            </a>
                        )}
                        <button className="bk-close" onClick={onClose} aria-label="Close">
                            <Icon name="xmark" />
                        </button>
                    </div>
                </div>

                {!parsed.ok && (
                    <div className="bk-banner bk-banner--error">
                        <Icon name="circle-exclamation" />
                        <span>This is not valid Block Kit JSON: {parsed.error}</span>
                    </div>
                )}

                {parsed.ok && problems.length > 0 && (
                    <div className="bk-banner bk-banner--warn">
                        <Icon name="circle-exclamation" />
                        <div>
                            {problems.map((p, i) => <div key={i}>{p}</div>)}
                        </div>
                    </div>
                )}

                <div className="bk-body">
                    {mode === "json" ? (
                        <div className="bk-json">
                            <CodeArea value={text} onChange={emit} rows={26} />
                        </div>
                    ) : (
                        <div className="bk-visual">
                            {doc.blocks.length === 0 && (
                                <div className="bk-empty">
                                    Nothing in this message yet. Add a block below.
                                </div>
                            )}

                            {doc.blocks.map((block, i) => (
                                <BlockCard
                                    key={i}
                                    block={block}
                                    index={i}
                                    total={doc.blocks.length}
                                    nodeId={nodeId}
                                    variables={variables}
                                    onPatch={patch => patchBlock(i, patch)}
                                    onReplace={next => update(bs => bs.map((b, j) => (j === i ? next : b)))}
                                    onMove={delta => move(i, delta)}
                                    onRemove={() => remove(i)}
                                />
                            ))}

                            <div className="bk-add">
                                <span className="bk-add-label">Add</span>
                                {EDITABLE_TYPES.map(t => (
                                    <button key={t} className="bk-add-btn" onClick={() => add(t)}>
                                        <Icon name={BLOCK_ICONS[t]} /> {BLOCK_LABELS[t]}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="bk-footer">
                    <span className="bk-count">
                        {parsed.ok ? `${doc.blocks.length} block${doc.blocks.length === 1 ? "" : "s"}` : "unparsed"}
                    </span>
                    <button className="bk-done" onClick={onClose}>Done</button>
                </div>
            </div>
        </div>
    );
}

type CardProps = {
    block: any;
    index: number;
    total: number;
    nodeId: string;
    variables?: VariableItem[];
    onPatch: (patch: any) => void;
    onReplace: (next: any) => void;
    onMove: (delta: number) => void;
    onRemove: () => void;
};

function BlockCard({block, index, total, nodeId, variables, onPatch, onReplace, onMove, onRemove}: CardProps) {
    const editable = isEditable(block);
    const type = block?.type ?? "unknown";
    const label = editable ? BLOCK_LABELS[type] : type;

    return (
        <div className={editable ? "bk-card" : "bk-card bk-card--raw"}>
            <div className="bk-card-head">
                <span className="bk-card-type">
                    <Icon name={BLOCK_ICONS[type] ?? "code"} /> {label}
                </span>
                {!editable && (
                    <span className="bk-card-note" title="This editor does not lay out this block type; it is kept exactly as it is and can be edited as JSON.">
                        kept as JSON
                    </span>
                )}
                <span className="bk-card-tools">
                    <button onClick={() => onMove(-1)} disabled={index === 0} aria-label="Move up">
                        <Icon name="chevron-up" />
                    </button>
                    <button onClick={() => onMove(1)} disabled={index === total - 1} aria-label="Move down">
                        <Icon name="chevron-down" />
                    </button>
                    <button onClick={onRemove} aria-label="Remove block">
                        <Icon name="trash" />
                    </button>
                </span>
            </div>

            <div className="bk-card-body">
                <BlockFields block={block} nodeId={nodeId} index={index} variables={variables} onPatch={onPatch} onReplace={onReplace} />
            </div>
        </div>
    );
}

function BlockFields({block, nodeId, index, variables, onPatch, onReplace}: {
    block: any;
    nodeId: string;
    index: number;
    variables?: VariableItem[];
    onPatch: (patch: any) => void;
    onReplace: (next: any) => void;
}) {
    // Field identities are per-block so two blocks' inputs never collide.
    const textField = (key: string, label: string, val: string, set: (v: string) => void, multiline = false) => (
        <BKText
            key={key}
            nodeId={nodeId}
            name={`bk_${index}_${key}`}
            label={label}
            value={val}
            onChange={set}
            variables={variables}
            multiline={multiline}
        />
    );

    switch (block?.type) {
        case "header":
            // Slack only accepts plain_text in a header, so the type is fixed
            // rather than offered as a choice that would be rejected.
            return textField("heading", "Heading", block.text?.text ?? "", v =>
                onPatch({text: {type: "plain_text", text: v}}));

        case "section":
            return (
                <>
                    {textField("text", "Text (Slack markdown)", block.text?.text ?? "", v =>
                        onPatch({text: {type: "mrkdwn", text: v}}), true)}
                    {Array.isArray(block.fields) && block.fields.length > 0 && (
                        <div className="bk-subfields">
                            <span className="bk-field-label">Columns</span>
                            {block.fields.map((f: any, i: number) => (
                                textField(`field_${i}`, `Column ${i + 1}`, f?.text ?? "", (v: string) => onPatch({
                                    fields: block.fields.map((g: any, j: number) =>
                                        j === i ? {type: "mrkdwn", text: v} : g),
                                }))
                            ))}
                            <button className="bk-inline-btn" onClick={() =>
                                onPatch({fields: block.fields.filter((_: any, i: number) => i !== block.fields.length - 1)})}>
                                Remove last column
                            </button>
                        </div>
                    )}
                    <button className="bk-inline-btn" onClick={() =>
                        onPatch({fields: [...(block.fields ?? []), {type: "mrkdwn", text: ""}]})}>
                        Add column
                    </button>
                </>
            );

        case "divider":
            return <div className="bk-note">A horizontal rule. Nothing to configure.</div>;

        case "context":
            return (
                <>
                    {(block.elements ?? []).map((el: any, i: number) => (
                        <div key={i}>
                            {textField(`ctx_${i}`, `Item ${i + 1}`, el?.text ?? "", v =>
                                onPatch({
                                    elements: block.elements.map((g: any, j: number) =>
                                        j === i ? {type: "mrkdwn", text: v} : g),
                                }))}
                        </div>
                    ))}
                    <button className="bk-inline-btn" onClick={() =>
                        onPatch({elements: [...(block.elements ?? []), {type: "mrkdwn", text: ""}]})}>
                        Add item
                    </button>
                </>
            );

        case "image":
            return (
                <>
                    {textField("image_url", "Image URL", block.image_url ?? "", v => onPatch({image_url: v}))}
                    {textField("alt_text", "Alt text (required by Slack)", block.alt_text ?? "", v => onPatch({alt_text: v}))}
                </>
            );

        case "actions":
            return (
                <>
                    {(block.elements ?? []).map((el: any, i: number) => (
                        <div className="bk-button-row" key={i}>
                            {textField(`btn_label_${i}`, "Label", el?.text?.text ?? "", v =>
                                onPatch({
                                    elements: block.elements.map((g: any, j: number) =>
                                        j === i ? {...g, type: "button", text: {type: "plain_text", text: v}} : g),
                                }))}
                            {textField(`btn_url_${i}`, "Link", el?.url ?? "", v =>
                                onPatch({
                                    elements: block.elements.map((g: any, j: number) =>
                                        j === i ? {...g, url: v} : g),
                                }))}
                            <button className="bk-inline-btn" onClick={() =>
                                onPatch({elements: block.elements.filter((_: any, j: number) => j !== i)})}>
                                Remove button
                            </button>
                        </div>
                    ))}
                    <button className="bk-inline-btn" onClick={() =>
                        onPatch({
                            elements: [...(block.elements ?? []),
                                {type: "button", text: {type: "plain_text", text: "Button"}, url: ""}],
                        })}>
                        Add button
                    </button>
                </>
            );

        default:
            // Anything this editor does not model. Shown and editable as JSON
            // rather than hidden, so it is never lost and never a mystery.
            return <RawBlock block={block} onReplace={onReplace} />;
    }
}

function RawBlock({block, onReplace}: {block: any; onReplace: (next: any) => void}) {
    const [draft, setDraft] = useState(() => JSON.stringify(block, null, 2));
    const [error, setError] = useState<string | null>(null);

    // Re-seed when the block changes underneath us (reorder, JSON-mode edit).
    useEffect(() => {
        setDraft(JSON.stringify(block, null, 2));
        setError(null);
    }, [block]);

    return (
        <div className="bk-raw">
            <CodeArea
                value={draft}
                onChange={v => {
                    setDraft(v);
                    try {
                        onReplace(JSON.parse(v));
                        setError(null);
                    } catch (e) {
                        // Keep the text as typed; the author is mid-edit. The
                        // block itself is left at its last valid value.
                        setError(e instanceof Error ? e.message : "not valid JSON");
                    }
                }}
                rows={8}
            />
            {error && <div className="bk-raw-error">{error}</div>}
        </div>
    );
}
