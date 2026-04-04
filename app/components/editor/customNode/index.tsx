import React, { memo, useCallback, useMemo, type ChangeEvent } from 'react';
import {Handle, Position} from '@xyflow/react';

import type { NodeDefinition}  from "~/types";
import {library} from '@fortawesome/fontawesome-svg-core'
import {fas} from '@fortawesome/pro-solid-svg-icons'
import {fab} from '@fortawesome/free-brands-svg-icons'

import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {LabeledHandle} from "~/components/labeled-handle";
import { BaseNode } from "~/components/base-node";

// RG: PERFORMANCE IMPROVEMENT: add the fontawesome icons to the library outside of the node so not to re-add on every render
library.add(fab, fas);

const NODE_COLOURS: Record<number, { bg: string; bgAlpha: string; glow: string; text: string; iconColour: string }> = {
    1: { bg: '#00aa9c', bgAlpha: 'rgba(0,170,156,0.15)',   glow: 'rgba(0,170,156,0.35)',   text: '#00aa9c', iconColour: '#00aa9c' },   // Trigger
    2: { bg: '#8b00de', bgAlpha: 'rgba(70,0,112,0.3)',     glow: 'rgba(139,0,222,0.35)',   text: '#8b00de', iconColour: '#b49eed' },   // Action
    3: { bg: '#f59e0b', bgAlpha: 'rgba(245,158,11,0.15)',   glow: 'rgba(245,158,11,0.35)',  text: '#f59e0b', iconColour: '#fbbf24' },   // Output
    4: { bg: '#efd467', bgAlpha: 'rgba(239,212,103,0.12)', glow: 'rgba(239,212,103,0.35)', text: '#efd467', iconColour: '#efd467' },  // Conditional
    5: { bg: '#b967ef', bgAlpha: 'rgba(185,103,239,0.15)', glow: 'rgba(185,103,239,0.35)', text: '#b967ef', iconColour: '#b967ef' },  // Loop
    6: { bg: '#06b6d4', bgAlpha: 'rgba(6,182,212,0.15)',  glow: 'rgba(6,182,212,0.35)',  text: '#06b6d4', iconColour: '#22d3ee' },  // Switch
};

const NODE_CLASS_MAP: Record<number, string> = {
    1: 'flo-node flo-node--trigger',
    2: 'flo-node flo-node--action',
    3: 'flo-node flo-node--output',
    4: 'flo-node flo-node--conditional',
    5: 'flo-node flo-node--loop',
    6: 'flo-node flo-node--switch',
};

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
    const colours = isErrorNode
        ? { bg: '#ef4444', bgAlpha: 'rgba(239,68,68,0.15)', glow: 'rgba(239,68,68,0.35)', text: '#ef4444', iconColour: '#f87171' }
        : (NODE_COLOURS[type] ?? NODE_COLOURS[2]);
    const nodeClass = isErrorNode ? 'flo-node flo-node--error' : (NODE_CLASS_MAP[type] ?? NODE_CLASS_MAP[2]);
    const isTrigger = type === 1;
    const hasInputs = !isTrigger && !isErrorNode;
    const hasOutputs = data?.config?.outputs && data.config.outputs.length > 0;

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

    const effectiveColours = hasIncompleteRequired
        ? { ...colours, bg: '#e6a817', glow: 'rgba(230,168,23,0.35)' }
        : colours;
    const effectiveClass = hasIncompleteRequired
        ? `${nodeClass} flo-node--invalid`
        : nodeClass;

    return (
        <>
            <div className="node-name">
                {data.config?.name && (
                    <>
                        {hasIncompleteRequired && (
                            <FontAwesomeIcon
                                icon={["fa-solid", "fa-triangle-exclamation"]}
                                className="node-name-warning"
                            />
                        )}
                        {data.config.name}
                    </>
                )}
                {data.config?.label && (
                    <div className="node-label">
                        {data.config.label}
                    </div>
                )}
            </div>

            <div
                className={effectiveClass}
                style={{
                    '--node-colour': effectiveColours.bg,
                    '--node-glow': effectiveColours.glow,
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
                        className="node-icon-badge"
                        style={{
                            backgroundColor: colours.bgAlpha,
                            boxShadow: `0 0 14px ${colours.glow}`,
                        }}
                    >
                        <FontAwesomeIcon
                            icon={["fa-solid", "fa-" + icon]}
                            style={{ fontSize: '16px', color: colours.iconColour }}
                        />
                    </div>
                )}

                <span className="node-inline-label">
                    {data.config?.label || data.config?.name || ''}
                </span>

                {/* Standard source handle for types 1, 2, 3 */}
                {type !== 4 && type !== 5 && type !== 6 && hasOutputs && (
                    <Handle
                        type="source"
                        position={Position.Right}
                        {...(type === 3 ? { id: "input" } : {})}
                    />
                )}

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
                        <span className="loop-label loop-label--body">Loop</span>
                        <span className="loop-label loop-label--done">Done</span>
                    </>
                )}

                {/* Switch (type 6): Dynamic handles — one per case + default */}
                {type === 6 && (
                    <div className="switch-handles">
                        {switchCases.map((label: string, i: number) => (
                            <div key={`case_${i}`} className="switch-handle-row">
                                <Handle
                                    type="source"
                                    position={Position.Right}
                                    id={`case_${i}`}
                                    style={{ position: 'relative', top: 'auto', right: 'auto', transform: 'none' }}
                                />
                                <span className="switch-handle-label">{label}</span>
                            </div>
                        ))}
                        <div className="switch-handle-row switch-handle-default">
                            <Handle
                                type="source"
                                position={Position.Right}
                                id="default"
                                style={{ position: 'relative', top: 'auto', right: 'auto', transform: 'none' }}
                            />
                            <span className="switch-handle-label">Default</span>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
});

CustomNode.displayName = 'CustomNode';
export default CustomNode;
