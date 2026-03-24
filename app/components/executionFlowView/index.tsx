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
                onNodeClick,
                nodeId: node.id,
            },
        }));
    }, [baseNodes, nodeStatuses, onNodeClick]);

    return (
        <div className="execution-flow-container">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                defaultViewport={defaultViewport}
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
