// Dagre-driven auto layout for the flow editor.
//
// Why dagre and not ELK: dagre is ~15kB, runs synchronously, and
// produces a clean layered layout that fits agent flows well — one
// trigger column, one AI column, one toolkit column. ELK would give
// us radial layouts too but we don't need that yet, and pulling
// it in would 5x the bundle for one button.
//
// The user's pain point is the starburst around the AI node. Dagre's
// LR (left-to-right) layered layout transforms that into a clean
// fan: triggers on the left, AI in the middle, tools on the right.

import dagre from "dagre";
import type { Node, Edge } from "@xyflow/react";

// Fallback dimensions used when a node hasn't been rendered yet
// (just-loaded flow, never measured) and therefore lacks `measured`
// values. Picked to match the rounded-pill node sizing in
// customNode/index.css — overshooting is far better than undershooting
// because the only downside is generous spacing between nodes.
const DEFAULT_NODE_WIDTH = 220;
const DEFAULT_NODE_HEIGHT = 60;

export type LayoutDirection = "LR" | "TB";

export interface LayoutOptions {
    direction?: LayoutDirection;
    // Horizontal gap between nodes in the same rank.
    nodesep?: number;
    // Vertical gap between ranks.
    ranksep?: number;
}

// getLayoutedElements runs dagre over the supplied nodes + edges and
// returns a new array of nodes with updated `position` values. Edges
// are passed back unchanged; ReactFlow will re-route them once nodes
// move.
//
// We do NOT mutate the originals — React Flow's state hooks depend
// on reference equality to detect changes, so each repositioned node
// is returned as a fresh object.
export function getLayoutedElements(
    nodes: Node[],
    edges: Edge[],
    options: LayoutOptions = {}
): { nodes: Node[]; edges: Edge[] } {
    const direction: LayoutDirection = options.direction ?? "LR";
    const nodesep = options.nodesep ?? 40;
    // Dense agent flows look better with a generous rank gap — gives
    // the tools room to fan out without overlapping each other.
    const ranksep = options.ranksep ?? 120;

    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: direction, nodesep, ranksep });
    g.setDefaultEdgeLabel(() => ({}));

    for (const node of nodes) {
        // measured is populated by ReactFlow once a node has been
        // rendered. On a fresh load nodes haven't yet been measured;
        // fall back to the default pill dimensions.
        const m = (node as any).measured;
        const width = m?.width ?? DEFAULT_NODE_WIDTH;
        const height = m?.height ?? DEFAULT_NODE_HEIGHT;
        g.setNode(node.id, { width, height });
    }

    for (const edge of edges) {
        g.setEdge(edge.source, edge.target);
    }

    dagre.layout(g);

    const laidOutNodes: Node[] = nodes.map(node => {
        const dn = g.node(node.id);
        if (!dn) return node;
        // Dagre returns the centre point; ReactFlow expects top-left.
        const m = (node as any).measured;
        const width = m?.width ?? DEFAULT_NODE_WIDTH;
        const height = m?.height ?? DEFAULT_NODE_HEIGHT;
        return {
            ...node,
            position: {
                x: dn.x - width / 2,
                y: dn.y - height / 2,
            },
        };
    });

    return { nodes: laidOutNodes, edges };
}
