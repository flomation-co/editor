import React, { memo, useCallback, useMemo, type ChangeEvent } from 'react';
import {Handle, Position} from '@xyflow/react';

import type { NodeDefinition}  from "~/types";
import {LabeledHandle} from "~/components/labeled-handle";
import { BaseNode } from "~/components/base-node";
import { Icon } from "~/components/icons/Icon";
import { detectSecret } from "~/lib/secretDetection";
import { useValidationProblem } from "~/components/editor/validationContext";

const NODE_COLOURS: Record<number, { bg: string; bgAlpha: string; glow: string; text: string; iconColour: string }> = {
    1: { bg: '#00aa9c', bgAlpha: 'rgba(0,170,156,0.15)',   glow: 'rgba(0,170,156,0.35)',   text: '#00aa9c', iconColour: '#00aa9c' },   // Trigger
    2: { bg: '#8b00de', bgAlpha: 'rgba(70,0,112,0.3)',     glow: 'rgba(139,0,222,0.35)',   text: '#8b00de', iconColour: '#b49eed' },   // Action
    3: { bg: '#f59e0b', bgAlpha: 'rgba(245,158,11,0.15)',   glow: 'rgba(245,158,11,0.35)',  text: '#f59e0b', iconColour: '#fbbf24' },   // Output
    4: { bg: '#efd467', bgAlpha: 'rgba(239,212,103,0.12)', glow: 'rgba(239,212,103,0.35)', text: '#efd467', iconColour: '#efd467' },  // Conditional
    5: { bg: '#b967ef', bgAlpha: 'rgba(185,103,239,0.15)', glow: 'rgba(185,103,239,0.35)', text: '#b967ef', iconColour: '#b967ef' },  // Loop
    6: { bg: '#06b6d4', bgAlpha: 'rgba(6,182,212,0.15)',  glow: 'rgba(6,182,212,0.35)',  text: '#06b6d4', iconColour: '#22d3ee' },  // Switch
    7: { bg: '#f43f5e', bgAlpha: 'rgba(244,63,94,0.15)',  glow: 'rgba(244,63,94,0.35)',  text: '#f43f5e', iconColour: '#fb7185' },  // Human in the Loop
};

const NODE_CLASS_MAP: Record<number, string> = {
    1: 'flo-node flo-node--trigger',
    2: 'flo-node flo-node--action',
    3: 'flo-node flo-node--output',
    4: 'flo-node flo-node--conditional',
    5: 'flo-node flo-node--loop',
    6: 'flo-node flo-node--switch',
    7: 'flo-node flo-node--await',
};

// slugifyOption mirrors the executor's option-value derivation so the editor's
// handle ids ("option_<value>") match the handles the executor routes to.
const slugifyOption = (s: string): string =>
    (s || '').toLowerCase().replace(/[^a-z0-9 _-]/g, '').replace(/[ _-]/g, '_');

// HandleLabel renders an output-handle caption as an icon + text chip that sits
// just outside the node, over the outgoing edge line. Shared by every
// multi-output node (Switch, Await, AI, Loop) so labels read consistently.
const HandleLabel = ({
    icon,
    label,
    top,
    italic,
    truncate,
    colour,
}: {
    icon: string;
    label: string;
    top: number;
    italic?: boolean;
    truncate?: boolean;
    colour?: string;
}) => (
    <span
        className={`handle-label handle-label--outside${italic ? ' handle-label--italic' : ''}${truncate ? ' handle-label--truncate' : ''}`}
        style={{ top, ...(colour ? { color: colour } : {}) }}
        title={label}
    >
        <Icon name={icon} className="handle-label__icon" />
        <span className="handle-label__text">{label}</span>
    </span>
);

const CustomNode = memo(({ data }: { data: NodeDefinition }) => {
    // RG: PERFORMANCE IMPROVEMENT: cache the icon so not to re-parse on every use
    const icon = useMemo(() => {
        try {
            return data?.config?.icon ? data.config.icon : undefined;
        } catch {
            return undefined;
        }
    }, [data?.config?.icon]);

    const type = data?.config?.type ?? 2;
    const isErrorNode = data?.label?.startsWith('error/') || data?.config?.plugin?.startsWith('error/');
    const isSubFlowBegin = data?.label === 'subflow/begin' || data?.config?.plugin === 'subflow/begin';
    const isSubFlowEnd = data?.label === 'subflow/end' || data?.config?.plugin === 'subflow/end';
    const isSubFlowNode = isSubFlowBegin || isSubFlowEnd || data?.label === 'subflow/invoke' || data?.config?.plugin === 'subflow/invoke';

    const colours = isErrorNode
        ? { bg: '#ef4444', bgAlpha: 'rgba(239,68,68,0.15)', glow: 'rgba(239,68,68,0.35)', text: '#ef4444', iconColour: '#f87171' }
        : isSubFlowNode
        ? { bg: '#10b981', bgAlpha: 'rgba(16,185,129,0.15)', glow: 'rgba(16,185,129,0.35)', text: '#10b981', iconColour: '#34d399' }
        : (NODE_COLOURS[type] ?? NODE_COLOURS[2]);
    const nodeClass = isErrorNode ? 'flo-node flo-node--error'
        : isSubFlowNode ? 'flo-node flo-node--subflow'
        : (NODE_CLASS_MAP[type] ?? NODE_CLASS_MAP[2]);
    const isTrigger = type === 1;
    const hasInputs = !isTrigger && !isErrorNode && !isSubFlowBegin;
    const hasOutputs = data?.config?.outputs && data.config.outputs.length > 0;

    // Detect AI nodes that support tool use and no-response handles.
    // Categorical-by-folder (label.startsWith('ai/')) isn't enough: ai/
    // also houses non-conversational transforms like gemini_image and
    // gemini_tts which are simple input→output nodes and should render
    // plain. The real discriminator is whether the action accepts a
    // `tool_definitions` input — that's what wires the tool loop and
    // creates the need for Response/Tools/Finished output handles.
    const isAINode = useMemo(() => {
        const label = data?.config?.label || data?.label || '';
        if (!label.startsWith('ai/')) return false;
        return (data?.config?.inputs || []).some((i: any) => i?.name === 'tool_definitions');
    }, [data?.config?.label, data?.label, data?.config?.inputs]);

    const hasToolDefinitions = useMemo(() => {
        if (!isAINode || !data?.config?.inputs) return false;
        const toolDefs = data.config.inputs.find((i: any) => i.name === 'tool_definitions');
        return toolDefs?.value && typeof toolDefs.value === 'string' && toolDefs.value.trim().length > 2;
    }, [isAINode, data?.config?.inputs]);

    // Extract switch cases from the 'cases' input for dynamic handle rendering
    const switchCases = useMemo(() => {
        if (type !== 6 || !data?.config?.inputs) return [];
        const casesInput = data.config.inputs.find((i: any) => i.name === 'cases');
        if (!casesInput?.value) return [];
        try {
            const parsed = typeof casesInput.value === 'string'
                ? JSON.parse(casesInput.value)
                : casesInput.value;
            if (Array.isArray(parsed)) {
                return parsed.map((c: any) => c.key || c.label || 'Case');
            }
        } catch {}
        return [];
    }, [type, data?.config?.inputs]);

    // Extract Human-in-the-Loop options from the 'options' input for dynamic
    // handle rendering. Each option becomes an "option_<value>" source handle.
    const awaitOptions = useMemo((): { label: string; value: string }[] => {
        if (type !== 7 || !data?.config?.inputs) return [];
        const optionsInput = data.config.inputs.find((i: any) => i.name === 'options');
        if (!optionsInput?.value) return [];
        try {
            const parsed = typeof optionsInput.value === 'string'
                ? JSON.parse(optionsInput.value)
                : optionsInput.value;
            if (Array.isArray(parsed)) {
                return parsed.map((o: any) => {
                    const label = o.key || o.label || 'Option';
                    const value = (o.value && String(o.value).trim()) || slugifyOption(label);
                    return { label, value };
                });
            }
        } catch {}
        return [];
    }, [type, data?.config?.inputs]);

    const hasIncompleteRequired = useMemo(() => {
        if (!data?.config?.inputs) return false;
        return data.config.inputs.some(i => {
            if (!i.required) return false;
            // Skip hidden inputs (visible_when condition not met)
            if (i.visible_when) {
                const ref = data.config.inputs.find((x: any) => x.name === i.visible_when.field);
                const refValue = ref?.value ?? '';
                if (!i.visible_when.values.includes(refValue)) return false;
            }
            return !i.value || (typeof i.value === 'string' && i.value.trim() === '');
        });
    }, [data?.config?.inputs]);

    // Pull the editor-wide validation problem for this specific
    // node out of context. The editor computes every node's
    // problem in one centralised memo (see editor/index.tsx:
    // validationProblems) so the canvas, the property menu, and
    // the Execute-button tooltip all stay in sync — no local
    // re-checking inside each node.
    //
    // CustomNode destructures only `data` from its props (ReactFlow
    // also passes id, type, position, etc. as siblings) so we read
    // the id from data.id, which the editor sets when it mints
    // each node.
    const validationProblem = useValidationProblem(data?.id ?? "");

    // Severity ordering for the visual: secret > unresolved >
    // required > clean. The fallback to hasIncompleteRequired
    // covers the rare case where the context map hasn't populated
    // yet (e.g. first render before the editor's memo settles).
    const effectiveColours = validationProblem?.kind === "secret"
        ? { ...colours, bg: '#ef4444', glow: 'rgba(239,68,68,0.45)' }
        : validationProblem?.kind === "unresolved"
            ? { ...colours, bg: '#ef4444', glow: 'rgba(239,68,68,0.35)' }
            : (validationProblem?.kind === "required" || hasIncompleteRequired)
                ? { ...colours, bg: '#e6a817', glow: 'rgba(230,168,23,0.35)' }
                : colours;
    let effectiveClass = validationProblem?.kind === "secret"
        ? `${nodeClass} flo-node--secret-error`
        : validationProblem?.kind === "unresolved"
            ? `${nodeClass} flo-node--unresolved`
            : (validationProblem?.kind === "required" || hasIncompleteRequired)
                ? `${nodeClass} flo-node--invalid`
                : nodeClass;
    if (isAINode) effectiveClass += ' flo-node--ai';

    // Multi-handle nodes need rectangular layout, not square
    const isMultiHandle = type === 5 || isAINode;

    // Warning icon shows on any node with a validation problem OR
    // the legacy missing-required local check. The title attribute
    // carries the specific reason — hover any broken node on the
    // canvas to see "Field X on Y references ${Z} but nothing
    // produces it" or similar, without having to open the property
    // menu and hunt for the issue.
    const showWarningIcon = !!validationProblem || hasIncompleteRequired;
    const warningTitle = validationProblem?.detail || (hasIncompleteRequired
        ? "One or more required fields are empty."
        : undefined);

    return (
        <>
            <div className="node-name" title={warningTitle}>
                {showWarningIcon && (
                    <Icon
                        name={["fa-solid", "fa-triangle-exclamation"]}
                        className={`node-name-warning node-name-warning--${validationProblem?.kind || 'required'}`}
                    />
                )}
                {data.config?.name || data.config?.label || ''}
                {data.config?.name && data.config?.label && (
                    <div className="node-label">
                        {data.config.label}
                    </div>
                )}
            </div>

            <div
                className={effectiveClass}
                title={warningTitle}
                style={{
                    '--node-colour': effectiveColours.bg,
                    '--node-glow': effectiveColours.glow,
                    ...(isAINode ? { minHeight: 3 * 28 + 16, minWidth: 180, paddingRight: 18 } : {}),
                    ...(type === 6 ? {
                        // Switch node height scales to cover all handles (cases + default)
                        minHeight: Math.max(56, 14 + (switchCases.length + 1) * 28 + 14),
                        width: Math.max(56, 14 + (switchCases.length + 1) * 28 + 14),
                    } : {}),
                    ...(type === 7 ? {
                        // Await node height scales to cover all handles (options + timeout)
                        minHeight: Math.max(56, 14 + (awaitOptions.length + 1) * 28 + 14),
                        width: Math.max(56, 14 + (awaitOptions.length + 1) * 28 + 14),
                    } : {}),
                } as React.CSSProperties}
            >
                {hasInputs && (
                    <Handle
                        type="target"
                        position={Position.Left}
                        {...(type === 4 ? { style: { top: '100%' } } : {})}
                    />
                )}

                {icon && (
                    <div
                        className={`node-icon-badge ${isMultiHandle ? '' : 'node-icon-badge--centred'}`}
                        style={{
                            backgroundColor: colours.bgAlpha,
                            boxShadow: `0 0 14px ${colours.glow}`,
                        }}
                    >
                        <Icon name={icon} style={{ fontSize: isMultiHandle ? '16px' : '22px', color: colours.iconColour }} />
                    </div>
                )}

                {/* Show inline label only for multi-handle nodes that need it */}
                {isMultiHandle && (
                    <span className="node-inline-label">
                        {data.config?.label || data.config?.name || ''}
                    </span>
                )}

                {/* Standard source handle for types 1, 2, 3 */}
                {type !== 4 && type !== 5 && type !== 6 && type !== 7 && hasOutputs && !isAINode && !isSubFlowEnd && (
                    <Handle
                        type="source"
                        position={Position.Right}
                        {...(type === 3 ? { id: "input" } : {})}
                    />
                )}

                {/* AI nodes: Response + Tools + Finished handles */}
                {isAINode && hasOutputs && (() => {
                    const handleSpacing = 28;
                    const startOffset = 14;
                    const handles = [
                        { id: 'output', label: 'Response', icon: 'comment', color: 'rgba(255,255,255,0.55)' },
                        { id: 'tools', label: 'Tools', icon: 'wrench', color: 'rgba(245,158,11,0.8)' },
                        { id: 'no_response', label: 'Finished', icon: 'circle-check', color: 'rgba(255,255,255,0.45)', italic: true },
                    ];
                    return (
                        <>
                            {handles.map((h, i) => {
                                const y = startOffset + i * handleSpacing;
                                return (
                                    <React.Fragment key={h.id}>
                                        <Handle
                                            type="source"
                                            position={Position.Right}
                                            id={h.id}
                                            style={{ top: y, transform: 'translateY(-50%)' }}
                                        />
                                        <HandleLabel icon={h.icon} label={h.label} top={y} italic={h.italic} colour={h.color} />
                                    </React.Fragment>
                                );
                            })}
                        </>
                    );
                })()}

                {/* Conditional (type 4): True/False handles at diamond edges.
                     Position sets edge path direction; style overrides set visual placement
                     on the rotated square's edge midpoints (top-right & bottom-right diamond edges). */}
                {type === 4 && hasOutputs && (
                    <>
                        <Handle type="source" position={Position.Top} id="true-branch"
                            style={{ right: 'auto', left: '50%', top: '-3px', transform: 'translate(-50%, 0)' }} />
                        <Handle type="source" position={Position.Bottom} id="false-branch"
                            style={{ bottom: 'auto', left: 'auto', right: '-3px', top: '50%', transform: 'translate(0, -50%)' }} />
                        <span className="diamond-label diamond-label--true">T</span>
                        <span className="diamond-label diamond-label--false">F</span>
                    </>
                )}

                {/* Loop (type 5): Bottom = loop body, Right = done/exit */}
                {type === 5 && hasOutputs && (
                    <>
                        <Handle type="source" position={Position.Bottom} id="loop" />
                        <Handle type="source" position={Position.Right} id="output" />
                        <span className="loop-label loop-label--body"><Icon name="repeat" className="handle-label__icon" />Loop</span>
                        <span className="loop-label loop-label--done"><Icon name="circle-check" className="handle-label__icon" />Done</span>
                    </>
                )}

                {/* Switch (type 6): Dynamic handles — one per case + default */}
                {type === 6 && (() => {
                    const handleSpacing = 28;
                    const startOffset = 14;
                    return (
                        <>
                            {switchCases.map((label: string, i: number) => {
                                const y = startOffset + i * handleSpacing;
                                return (
                                    <React.Fragment key={`case_${i}`}>
                                        <Handle
                                            type="source"
                                            position={Position.Right}
                                            id={`case_${i}`}
                                            style={{ top: y, transform: 'translateY(-50%)' }}
                                        />
                                        <HandleLabel icon="circle-dot" label={label} top={y} truncate />
                                    </React.Fragment>
                                );
                            })}
                            {(() => {
                                const y = startOffset + switchCases.length * handleSpacing;
                                return (
                                    <>
                                        <Handle
                                            type="source"
                                            position={Position.Right}
                                            id="default"
                                            style={{ top: y, transform: 'translateY(-50%)' }}
                                        />
                                        <HandleLabel icon="code-branch" label="Default" top={y} italic colour="rgba(6,182,212,0.7)" />
                                    </>
                                );
                            })()}
                        </>
                    );
                })()}

                {/* Human in the Loop (type 7): one handle per option + timeout */}
                {type === 7 && (() => {
                    const handleSpacing = 28;
                    const startOffset = 14;
                    return (
                        <>
                            {awaitOptions.map((opt, i: number) => {
                                const y = startOffset + i * handleSpacing;
                                return (
                                    <React.Fragment key={`option_${opt.value}_${i}`}>
                                        <Handle
                                            type="source"
                                            position={Position.Right}
                                            id={`option_${opt.value}`}
                                            style={{ top: y, transform: 'translateY(-50%)' }}
                                        />
                                        <HandleLabel icon="circle-dot" label={opt.label} top={y} truncate />
                                    </React.Fragment>
                                );
                            })}
                            {(() => {
                                const y = startOffset + awaitOptions.length * handleSpacing;
                                return (
                                    <>
                                        <Handle
                                            type="source"
                                            position={Position.Right}
                                            id="timeout"
                                            style={{ top: y, transform: 'translateY(-50%)' }}
                                        />
                                        <HandleLabel icon="clock" label="Timeout" top={y} italic colour="rgba(6,182,212,0.7)" />
                                    </>
                                );
                            })()}
                            {/* Delivery handle (bottom): wire Send Message nodes
                                here to fan the request out over their channels,
                                like AI tool nodes. */}
                            <Handle
                                type="source"
                                position={Position.Bottom}
                                id="delivery"
                                style={{ left: '50%', transform: 'translateX(-50%)' }}
                            />
                            <span className="await-delivery-label">
                                <Icon name="paper-plane" className="handle-label__icon" />
                                Deliver via
                            </span>
                        </>
                    );
                })()}
            </div>
        </>
    );
});

CustomNode.displayName = 'CustomNode';
export default CustomNode;
