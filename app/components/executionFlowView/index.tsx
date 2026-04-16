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

    // Style edges: mute untaken branches + all downstream, animate active edges
    const styledEdges = useMemo(() => {
        const mutedStyle = { stroke: 'rgba(255,255,255,0.06)', strokeWidth: 1 };

        // Step 1: find directly untaken edges (from conditional/switch outputs)
        const untakenTargets = new Set<string>();
        for (const edge of edges) {
            const sourceStatus = nodeStatuses.get(edge.source);
            if (!sourceStatus?.outputs || !edge.sourceHandle) continue;

            const sourceType = baseNodes.find(n => n.id === edge.source)?.data?.config?.type;

            if (sourceType === 4) {
                const result = sourceStatus.outputs['result'];
                if (result === true && edge.sourceHandle === 'false-branch') untakenTargets.add(edge.target);
                if (result === false && edge.sourceHandle === 'true-branch') untakenTargets.add(edge.target);
            }

            if (sourceType === 6) {
                const matched = sourceStatus.outputs['matched_case'];
                if (matched && edge.sourceHandle !== matched) untakenTargets.add(edge.target);
            }
        }

        // Step 2: flood-fill to find all nodes downstream of untaken branches
        const mutedNodes = new Set<string>(untakenTargets);
        let changed = true;
        while (changed) {
            changed = false;
            for (const edge of edges) {
                if (mutedNodes.has(edge.source) && !mutedNodes.has(edge.target)) {
                    // Don't mute if the target is also reachable via a non-muted path
                    const hasLivePath = edges.some(e =>
                        e.target === edge.target && !mutedNodes.has(e.source)
                    );
                    if (!hasLivePath) {
                        mutedNodes.add(edge.target);
                        changed = true;
                    }
                }
            }
        }

        // Step 3: style each edge
        return edges.map(edge => {
            const targetStatus = nodeStatuses.get(edge.target);
            const sourceStatus = nodeStatuses.get(edge.source);

            // Mute if source or target is in the untaken subgraph
            if (mutedNodes.has(edge.target) || (mutedNodes.has(edge.source) && mutedNodes.has(edge.target))) {
                return { ...edge, style: mutedStyle, animated: false };
            }

            // Active: target is running → marching ants
            if (targetStatus?.status === 'running') {
                return { ...edge, animated: true, style: { stroke: '#00aa9c', strokeWidth: 2 } };
            }

            // Completed successfully: bright green trace
            const sourceCompleted = sourceStatus?.status === 'success' || sourceStatus?.status === 'failed';
            if (sourceCompleted && targetStatus && targetStatus.status === 'success') {
                return { ...edge, style: { stroke: 'rgba(34, 197, 94, 0.5)', strokeWidth: 2 }, animated: false };
            }

            // Target failed: red trace
            if (sourceCompleted && targetStatus && targetStatus.status === 'failed') {
                return { ...edge, style: { stroke: 'rgba(239, 68, 68, 0.5)', strokeWidth: 2 }, animated: false };
            }

            // Partially executed (source done, target still running or waiting)
            if (sourceCompleted && targetStatus && targetStatus.status !== 'pending') {
                return { ...edge, style: { stroke: 'rgba(255,255,255,0.35)', strokeWidth: 1.5 } };
            }

            // Not executed: source never ran (pending) → dim the edge
            if (!sourceStatus || sourceStatus.status === 'pending') {
                return { ...edge, style: mutedStyle, animated: false };
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
