import React, { memo, useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faXmark, faSpinner, faClock } from "@fortawesome/pro-solid-svg-icons";
import { library } from '@fortawesome/fontawesome-svg-core';
import { fas } from '@fortawesome/pro-solid-svg-icons';
import { fab } from '@fortawesome/free-brands-svg-icons';
import type { NodeStatus } from '~/types';

library.add(fab, fas);

const NODE_COLOURS: Record<number, { bg: string; bgAlpha: string; glow: string; iconColour: string }> = {
    1: { bg: '#00aa9c', bgAlpha: 'rgba(0,170,156,0.15)',   glow: 'rgba(0,170,156,0.35)',   iconColour: '#00aa9c' },
    2: { bg: '#8b00de', bgAlpha: 'rgba(70,0,112,0.3)',     glow: 'rgba(139,0,222,0.35)',   iconColour: '#b49eed' },
    3: { bg: '#e8604c', bgAlpha: 'rgba(232,96,76,0.15)',    glow: 'rgba(232,96,76,0.35)',   iconColour: '#e8604c' },
    4: { bg: '#efd467', bgAlpha: 'rgba(239,212,103,0.12)', glow: 'rgba(239,212,103,0.35)', iconColour: '#efd467' },
    5: { bg: '#b967ef', bgAlpha: 'rgba(185,103,239,0.15)', glow: 'rgba(185,103,239,0.35)', iconColour: '#b967ef' },
};

const SENSITIVE_KEYS = /secret|password|key|token|credential|auth/i;

function formatVal(key: string, value: any): string {
    if (typeof value === 'string' && value === '********') return '********';
    if (SENSITIVE_KEYS.test(key)) return '********';
    const str = typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value ?? '');
    return str.length > 35 ? str.slice(0, 32) + '...' : str;
}

export type ExecutionNodeData = {
    config?: {
        name?: string;
        type?: number;
        label?: string;
        icon?: string;
        inputs?: any[];
        outputs?: any[];
    };
    executionStatus?: string;
    nodeStatusData?: NodeStatus | null;
    onNodeClick?: (nodeId: string) => void;
    nodeId?: string;
};

const ExecutionNode = memo(({ data }: { data: ExecutionNodeData }) => {
    const icon = useMemo(() => {
        try {
            return data?.config?.icon ? data.config.icon : undefined;
        } catch {
            return undefined;
        }
    }, [data?.config?.icon]);

    const type = data?.config?.type ?? 2;
    const colours = NODE_COLOURS[type] ?? NODE_COLOURS[2];
    const status = data?.executionStatus ?? 'pending';
    const nodeStatus = data?.nodeStatusData ?? null;
    const isTrigger = type === 1;
    const isConditional = type === 4;
    const hasInputs = !isTrigger && data?.config?.inputs && data.config.inputs.length > 0;
    const hasOutputs = data?.config?.outputs && data.config.outputs.length > 0;

    const statusClass = `exec-node exec-node--${status}${isConditional ? ' exec-node--conditional' : ''}`;

    const handleClick = () => {
        if (data?.onNodeClick && data?.nodeId) {
            data.onNodeClick(data.nodeId);
        }
    };

    const showTooltip = status !== 'pending';
    const hasDetail = nodeStatus &&
        ((nodeStatus.inputs && Object.keys(nodeStatus.inputs).length > 0) ||
         (nodeStatus.outputs && Object.keys(nodeStatus.outputs).length > 0) ||
         nodeStatus.error);

    return (
        <div className="exec-node-hover-wrap">
            <div className="exec-node-name">
                {data.config?.name && data.config.name}
                {data.config?.label && (
                    <div className="exec-node-label">{data.config.label}</div>
                )}
            </div>

            <div className={statusClass} onClick={handleClick}>
                {hasInputs && (
                    <Handle
                        type="target"
                        position={Position.Left}
                        {...(isConditional ? { style: { top: '100%' } } : {})}
                    />
                )}

                {icon && (
                    <div
                        className="exec-node-icon-badge"
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

                <span className="exec-node-inline-label">
                    {data.config?.label || data.config?.name || ''}
                </span>

                {type !== 4 && type !== 5 && hasOutputs && (
                    <Handle type="source" position={Position.Right} />
                )}

                {type === 4 && hasOutputs && (
                    <>
                        <Handle type="source" position={Position.Top} id="true-branch"
                            style={{ right: 'auto', left: '50%', top: '-3px', transform: 'translate(-50%, 0)' }} />
                        <Handle type="source" position={Position.Bottom} id="false-branch"
                            style={{ bottom: 'auto', left: 'auto', right: '-3px', top: '50%', transform: 'translate(0, -50%)' }} />
                    </>
                )}

                {type === 5 && hasOutputs && (
                    <>
                        <Handle type="source" position={Position.Bottom} id="loop" />
                        <Handle type="source" position={Position.Right} id="output" />
                    </>
                )}

                {status === 'running' && (
                    <div className="exec-node-status-badge exec-node-status-badge--running">
                        <FontAwesomeIcon icon={faSpinner} spin style={{ fontSize: '9px' }} />
                    </div>
                )}
                {status === 'success' && (
                    <div className="exec-node-status-badge exec-node-status-badge--success">
                        <FontAwesomeIcon icon={faCheck} style={{ fontSize: '9px' }} />
                    </div>
                )}
                {status === 'failed' && (
                    <div className="exec-node-status-badge exec-node-status-badge--failed">
                        <FontAwesomeIcon icon={faXmark} style={{ fontSize: '9px' }} />
                    </div>
                )}
            </div>

            {/* CSS-only hover tooltip — .exec-node-hover-wrap:hover makes this visible */}
            {showTooltip && (
                <div className="exec-node-tooltip">
                    <div className="exec-node-tooltip-hdr">
                        <span className={`exec-node-tooltip-status exec-node-tooltip-status--${status}`}>
                            {status === 'success' && 'Success'}
                            {status === 'failed' && 'Failed'}
                            {status === 'running' && 'Running'}
                        </span>
                        {nodeStatus?.duration_ms !== undefined && nodeStatus.duration_ms > 0 && (
                            <span className="exec-node-tooltip-dur">
                                <FontAwesomeIcon icon={faClock} /> {nodeStatus.duration_ms}ms
                            </span>
                        )}
                    </div>

                    {nodeStatus?.error && (
                        <div className="exec-node-tooltip-err">
                            {nodeStatus.error.length > 80 ? nodeStatus.error.slice(0, 77) + '...' : nodeStatus.error}
                        </div>
                    )}

                    {hasDetail && nodeStatus!.inputs && Object.keys(nodeStatus!.inputs).length > 0 && (
                        <div className="exec-node-tooltip-sect">
                            <div className="exec-node-tooltip-lbl">Inputs</div>
                            {Object.entries(nodeStatus!.inputs!).slice(0, 4).map(([k, v]) => (
                                <div key={k} className="exec-node-tooltip-kv">
                                    <span className="exec-node-tooltip-k">{k}</span>
                                    <span className="exec-node-tooltip-v">{formatVal(k, v)}</span>
                                </div>
                            ))}
                            {Object.keys(nodeStatus!.inputs!).length > 4 && (
                                <div className="exec-node-tooltip-more">+{Object.keys(nodeStatus!.inputs!).length - 4} more</div>
                            )}
                        </div>
                    )}

                    {hasDetail && nodeStatus!.outputs && Object.keys(nodeStatus!.outputs).length > 0 && (
                        <div className="exec-node-tooltip-sect">
                            <div className="exec-node-tooltip-lbl">Outputs</div>
                            {Object.entries(nodeStatus!.outputs!).slice(0, 4).map(([k, v]) => (
                                <div key={k} className="exec-node-tooltip-kv">
                                    <span className="exec-node-tooltip-k">{k}</span>
                                    <span className="exec-node-tooltip-v">{formatVal(k, v)}</span>
                                </div>
                            ))}
                            {Object.keys(nodeStatus!.outputs!).length > 4 && (
                                <div className="exec-node-tooltip-more">+{Object.keys(nodeStatus!.outputs!).length - 4} more</div>
                            )}
                        </div>
                    )}

                    <div className="exec-node-tooltip-hint">Click to inspect</div>
                </div>
            )}
        </div>
    );
});

ExecutionNode.displayName = 'ExecutionNode';
export default ExecutionNode;
