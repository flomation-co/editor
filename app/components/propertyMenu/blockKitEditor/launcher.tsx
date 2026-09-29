import {useMemo, useState} from "react";
import {Icon} from "~/components/icons/Icon";
import type {VariableItem} from "~/components/propertyMenu/variableInput";
import BlockKitEditor from "./index";
import {BLOCK_LABELS, describeProblems, parseBlocks} from "./model";
import "./index.css";

type Props = {
    nodeId: string;
    label: string;
    required?: boolean;
    value: string;
    variables?: VariableItem[];
    onChange: (value: string) => void;
};

/**
 * What the property menu shows for a Block Kit input: a summary of the message
 * and a way into the full-screen editor.
 *
 * The panel is about 400px wide, which is enough to say what the message
 * contains but not to build one. So the summary lives here and the building
 * happens in a surface with room for it.
 */
export default function BlockKitLauncher({nodeId, label, required, value, variables, onChange}: Props) {
    const [open, setOpen] = useState(false);

    const parsed = useMemo(() => parseBlocks(value), [value]);
    const problems = useMemo(
        () => (parsed.ok ? describeProblems(parsed.doc) : []),
        [parsed],
    );

    // A one-line description of the message, so the panel says something useful
    // without the author having to open anything.
    const summary = useMemo(() => {
        if (!parsed.ok) return null;
        const counts = new Map<string, number>();
        for (const b of parsed.doc.blocks) {
            const t = b?.type ?? "unknown";
            counts.set(t, (counts.get(t) ?? 0) + 1);
        }
        return [...counts.entries()]
            .map(([t, n]) => `${n} ${BLOCK_LABELS[t] ?? t}${n === 1 ? "" : "s"}`)
            .join(", ");
    }, [parsed]);

    const count = parsed.ok ? parsed.doc.blocks.length : 0;

    return (
        <div className="bk-launcher">
            <div className="bk-launcher-label">
                {/* The original label carried a format tutorial because the
                    textarea had nowhere else to put it. The editor is that
                    place now, so only the first sentence is shown. */}
                {label?.split(".")[0]}
                {required && <span className="bk-launcher-required">*</span>}
            </div>

            <button
                type="button"
                className="bk-launcher-card"
                onClick={() => setOpen(true)}
            >
                <span className="bk-launcher-icon"><Icon name="slack" /></span>
                <span className="bk-launcher-text">
                    {!parsed.ok ? (
                        <>
                            <strong>Needs attention</strong>
                            <small>Not valid Block Kit JSON — open to fix</small>
                        </>
                    ) : count === 0 ? (
                        <>
                            <strong>No message yet</strong>
                            <small>Open the builder to compose one</small>
                        </>
                    ) : (
                        <>
                            <strong>{count} block{count === 1 ? "" : "s"}</strong>
                            <small>{summary}</small>
                        </>
                    )}
                </span>
                <span className="bk-launcher-go"><Icon name="expand" /></span>
            </button>

            {parsed.ok && problems.length > 0 && (
                <div className="bk-launcher-warn">
                    <Icon name="circle-exclamation" /> {problems.length} thing{problems.length === 1 ? "" : "s"} to check
                </div>
            )}

            {open && (
                <BlockKitEditor
                    nodeId={nodeId}
                    value={value}
                    onChange={onChange}
                    variables={variables}
                    onClose={() => setOpen(false)}
                />
            )}
        </div>
    );
}
