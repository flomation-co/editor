// GroupNode — a purely visual container for tidying tangled flows.
//
// This is a Tier-1 grouping primitive: it is NOT seen by the
// executor, does NOT alter the flow's runtime semantics, and is NOT
// reusable across flows. It exists solely to give the editor a way
// to fold a starburst of nodes into a single labelled pill the user
// can collapse and expand.
//
// Collapsed state:  small rounded pill with the group label, an
//                   input handle on the left, an output handle on
//                   the right, and a ▶ toggle. The children of this
//                   group are hidden by the editor; any edges that
//                   crossed the group boundary in either direction
//                   are visually re-routed to the group's exterior
//                   handles so external connectivity stays legible.
//
// Expanded state:   larger bordered container with a header row
//                   (label + ▼ toggle). React Flow renders the
//                   child nodes inside the container's bounds using
//                   its native parentId machinery; the editor wires
//                   the drag-into-group reparenting separately.
//
// Persistence:      `data.collapsed`, `data.label`, and the node's
//                   own width/height are stored on the node itself
//                   exactly like any other flow node, so groups
//                   survive a reload with no schema change.

import { memo, useCallback } from "react";
import { Handle, NodeResizer, Position, useReactFlow } from "@xyflow/react";

interface GroupNodeData {
    id: string;
    label?: string;
    collapsed?: boolean;
    // Snapshot of the dimensions the user resized the group to
    // before collapsing. Restored when they expand again so a
    // collapse/expand round-trip is non-destructive.
    expandedWidth?: number;
    expandedHeight?: number;
}

// Fixed footprint used while a group is collapsed. The height
// matches the header bar's CSS height exactly so the collapsed
// state visually IS the header — no chrome, no extra space — and
// expanding feels like the body slides down from underneath the
// same bar.
const COLLAPSED_WIDTH = 240;
const COLLAPSED_HEIGHT = 36;

interface GroupNodeProps {
    id: string;
    data: GroupNodeData;
    selected?: boolean;
}

function GroupNodeBody({ id, data, selected }: GroupNodeProps) {
    const rf = useReactFlow();
    const isCollapsed = data.collapsed !== false; // default to collapsed on first add

    // Toggle the collapsed flag on this node's data AND swap the
    // node's actual dimensions. React Flow v12 sizes the outer
    // wrapper from the node's own width/height + style — a
    // derived-only override loses the race against React Flow's
    // measurement cache. Setting both top-level and style values
    // gives a deterministic resize.
    //
    // On collapse: read the current expanded size (whatever the
    // user last resized to, or the default we created with) and
    // stash it in data so we can restore it on expand. Then shrink
    // to the fixed pill footprint.
    //
    // On expand: read the stashed size back out of data. Fall
    // through to sensible defaults if missing (e.g. legacy nodes).
    const toggle = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        rf.setNodes(prev => {
            const collapsing = !isCollapsed;
            return prev.map((n: any) => {
                if (n.id === id) {
                    // The group node itself: swap dimensions and the
                    // collapsed flag. Read from `measured` first so
                    // we capture whatever size React Flow has the
                    // node actually rendered at — NodeResizer-driven
                    // changes land here before they propagate back to
                    // style/width, and reading from a stale source
                    // would lose the user's resize.
                    if (collapsing) {
                        const savedW = n.measured?.width
                            ?? (n.style?.width as number)
                            ?? n.width
                            ?? 400;
                        const savedH = n.measured?.height
                            ?? (n.style?.height as number)
                            ?? n.height
                            ?? 240;
                        return {
                            ...n,
                            width: COLLAPSED_WIDTH,
                            height: COLLAPSED_HEIGHT,
                            style: { ...n.style, width: COLLAPSED_WIDTH, height: COLLAPSED_HEIGHT },
                            // Clear measured so React Flow re-runs
                            // the DOM measurement at the new pill
                            // size; otherwise the cached expanded
                            // measurement keeps the wrapper bigger
                            // than the new style says.
                            measured: undefined,
                            data: {
                                ...n.data,
                                collapsed: true,
                                expandedWidth: savedW,
                                expandedHeight: savedH,
                            },
                        };
                    }
                    const w = n.data?.expandedWidth ?? 400;
                    const h = n.data?.expandedHeight ?? 240;
                    return {
                        ...n,
                        width: w,
                        height: h,
                        style: { ...n.style, width: w, height: h },
                        measured: undefined,
                        data: { ...n.data, collapsed: false },
                    };
                }

                // Children of this group need careful handling.
                // React Flow's `extent: "parent"` constraint silently
                // clamps a child's position to fit the parent's
                // current bounds — so the moment we shrink the parent
                // to pill size, every child gets shoved into the
                // top-left corner and the source position is lost.
                //
                // We snapshot each child's position into data before
                // collapsing AND fully remove the extent property
                // (destructuring it out, not setting it to undefined,
                // since React Flow may treat the latter as the
                // property still being present). On expand we
                // restore position and extent and explicitly set
                // hidden: false in case the field lingered from a
                // prior render cycle.
                if (n.parentId === id) {
                    if (collapsing) {
                        const { extent: _drop, ...rest } = n;
                        return {
                            ...rest,
                            data: {
                                ...n.data,
                                __preCollapsePosition: {
                                    x: n.position.x,
                                    y: n.position.y,
                                },
                            },
                        };
                    }
                    // Restore position on expand but deliberately
                    // leave extent unset — see the matching note in
                    // index.tsx's onNodeDragStopReparent for why.
                    const stashed = n.data?.__preCollapsePosition;
                    const restoredData = { ...n.data };
                    delete (restoredData as any).__preCollapsePosition;
                    const { extent: _drop, ...rest } = n;
                    return {
                        ...rest,
                        position: stashed ?? n.position,
                        hidden: false,
                        data: restoredData,
                    };
                }
                return n;
            });
        });
    }, [ id, isCollapsed, rf ]);

    const onLabelChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const next = e.target.value;
        rf.setNodes(prev =>
            prev.map(n =>
                n.id === id
                    ? { ...n, data: { ...n.data, label: next } }
                    : n
            )
        );
    }, [ id, rf ]);

    const label = data.label ?? "Group";

    return (
        <div className={`flo-group-node ${isCollapsed ? "flo-group-node--collapsed" : "flo-group-node--expanded"} ${selected ? "flo-group-node--selected" : ""}`}>
            {/* Drag handles on the corners + edges to resize the
                group's footprint. Only meaningful when expanded —
                a collapsed group has a fixed pill size. Min sizes
                keep the header readable even if the user yanks the
                corner inwards aggressively. */}
            {!isCollapsed && (
                <NodeResizer
                    isVisible={selected}
                    minWidth={200}
                    minHeight={120}
                    lineClassName="flo-group-node-resize-line"
                    handleClassName="flo-group-node-resize-handle"
                />
            )}
            {/* Handles render so collapsed-state edge rerouting has
                somewhere to visually terminate, but isConnectable
                is false so users can't draw edges to or from a
                group. A persisted edge ending on a group node would
                break execution — the executor has no "group" action
                in its registry and would return ErrInvalidNode. */}
            <Handle
                type="target"
                position={Position.Left}
                id="in"
                className="flo-group-node-handle"
                isConnectable={false}
            />
            <div className="flo-group-node-header">
                <span
                    className="flo-group-node-toggle"
                    onClick={toggle}
                    title={isCollapsed ? "Expand group" : "Collapse group"}
                >
                    {isCollapsed ? "▶" : "▼"}
                </span>
                {/* Same input field in both states — the header
                    only differs in whether a body extends below it,
                    so renaming should be possible from either. */}
                <input
                    className="flo-group-node-label-input"
                    value={label}
                    onChange={onLabelChange}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="Group name"
                />
            </div>
            <Handle
                type="source"
                position={Position.Right}
                id="out"
                className="flo-group-node-handle"
                isConnectable={false}
            />
        </div>
    );
}

// memo guards against re-renders when other parts of the canvas
// change. The group only needs to re-render when its own data or
// selection state changes.
export default memo(GroupNodeBody);
