import React, { useEffect, useState, useMemo } from 'react';
import {
    ReactFlow,
    ReactFlowProvider,
    Background,
    BackgroundVariant,
    type Node,
    type Edge,
} from '@xyflow/react';

import ExecutionNode from './ExecutionNode';
import type { NodeStatus } from '~/types';
import api from '~/lib/api';
import useConfig from '~/components/config';
import useCookieToken from '~/components/cookie';

import './index.css';

type ExecutionFlowViewProps = {
    floId: string;
    nodeStatuses: Map<string, NodeStatus>;
    onNodeClick: (nodeId: string) => void;
};

const nodeTypes = { executionNode: ExecutionNode };

function ExecutionFlowViewInner({ floId, nodeStatuses, onNodeClick }: ExecutionFlowViewProps) {
    const config = useConfig();
    const token = useCookieToken();
    const [baseNodes, setBaseNodes] = useState<Node[]>([]);
    const [edges, setEdges] = useState<Edge[]>([]);
    const [defaultViewport, setDefaultViewport] = useState({ x: 0, y: 0, zoom: 1 });

    // Fetch flow definition once — stores base nodes without execution status
    useEffect(() => {
        const url = config("AUTOMATE_API_URL") + '/api/v1/flo/' + floId;

        api.get(url, {
            headers: { Authorization: "Bearer " + token }
        })
            .then(response => {
                if (!response?.data?.revision?.data) return;

                const revisionData = typeof response.data.revision.data === 'string'
                    ? JSON.parse(response.data.revision.data)
                    : response.data.revision.data;

                const flowNodes = revisionData.nodes || [];
                const flowEdges = revisionData.edges || [];

                const rfNodes: Node[] = flowNodes.map((n: any) => ({
                    id: n.id,
                    type: 'executionNode',
                    position: n.position || { x: 0, y: 0 },
                    data: { ...n.data, nodeId: n.id },
                }));

                const rfEdges: Edge[] = flowEdges.map((e: any) => ({
                    id: e.id,
                    source: e.source,
                    target: e.target,
                    sourceHandle: e.sourceHandle,
                    targetHandle: e.targetHandle,
                    type: 'simplebezier',
                }));

                setBaseNodes(rfNodes);
                setEdges(rfEdges);

                if (response.data.x !== undefined && response.data.y !== undefined) {
                    setDefaultViewport({
                        x: response.data.x ?? 0,
                        y: response.data.y ?? 0,
                        zoom: response.data.scale ?? 1,
                    });
                }
            })
            .catch(error => {
                console.error("Failed to load flow for execution view", error);
            });
    }, [floId]);

    // Derive final nodes by merging base nodes with current execution statuses.
    // This recalculates whenever baseNodes, nodeStatuses, or onNodeClick changes —
    // no stale closures, no race conditions.
    const nodes = useMemo(() => {
        return baseNodes.map(node => ({
            ...node,
            data: {
                ...node.data,
                executionStatus: nodeStatuses.has(node.id)
                    ? nodeStatuses.get(node.id)!.status
                    : 'pending',
                nodeStatusData: nodeStatuses.get(node.id) ?? null,
                onNodeClick,
                nodeId: node.id,
            },
        }));
    }, [baseNodes, nodeStatuses, onNodeClick]);

    // Style edges: mute untaken branches, animate active processing edges
    const styledEdges = useMemo(() => {
        return edges.map(edge => {
            const sourceStatus = nodeStatuses.get(edge.source);
            const targetStatus = nodeStatuses.get(edge.target);

            // Animate edge if target node is currently running (marching ants)
            const targetRunning = targetStatus?.status === 'running';
            // Also animate if source completed and target is about to run
            const sourceCompleted = sourceStatus?.status === 'success' || sourceStatus?.status === 'failed';

            // Check for untaken branches
            if (sourceStatus?.outputs) {
                const sourceType = baseNodes.find(n => n.id === edge.source)?.data?.config?.type;

                // Conditional (If)
                if (sourceType === 4 && edge.sourceHandle) {
                    const result = sourceStatus.outputs['result'];
                    if (result === true && edge.sourceHandle === 'false-branch') {
                        return { ...edge, style: { stroke: 'rgba(255,255,255,0.06)', strokeWidth: 1 }, animated: false };
                    }
                    if (result === false && edge.sourceHandle === 'true-branch') {
                        return { ...edge, style: { stroke: 'rgba(255,255,255,0.06)', strokeWidth: 1 }, animated: false };
                    }
                }

                // Switch
                if (sourceType === 6 && edge.sourceHandle) {
                    const matched = sourceStatus.outputs['matched_case'];
                    if (matched && edge.sourceHandle !== matched) {
                        return { ...edge, style: { stroke: 'rgba(255,255,255,0.06)', strokeWidth: 1 }, animated: false };
                    }
                }
            }

            // Active processing: animate the edge leading to a running node
            if (targetRunning) {
                return {
                    ...edge,
                    animated: true,
                    style: { stroke: '#00aa9c', strokeWidth: 2 },
                };
            }

            // Completed edge: source ran successfully
            if (sourceCompleted && targetStatus && targetStatus.status !== 'pending') {
                return {
                    ...edge,
                    style: { stroke: 'rgba(255,255,255,0.25)', strokeWidth: 1.5 },
                };
            }

            return edge;
        });
    }, [edges, nodeStatuses, baseNodes]);

    return (
        <div className="execution-flow-container">
            <ReactFlow
                nodes={nodes}
                edges={styledEdges}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.4, maxZoom: 0.8 }}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={false}
                panOnDrag={true}
                zoomOnScroll={true}
                defaultEdgeOptions={{ type: 'simplebezier' }}
                proOptions={{ hideAttribution: true }}
            >
                <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="rgba(255,255,255,0.05)" />
            </ReactFlow>
        </div>
    );
}

export default function ExecutionFlowView(props: ExecutionFlowViewProps) {
    return (
        <ReactFlowProvider>
            <ExecutionFlowViewInner {...props} />
        </ReactFlowProvider>
    );
}
