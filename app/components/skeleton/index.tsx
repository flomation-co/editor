import React from "react";
import "./index.css";

interface SkeletonProps {
    width?: string;
    height?: string;
    borderRadius?: string;
    style?: React.CSSProperties;
}

export function Skeleton({ width = "100%", height = "14px", borderRadius = "4px", style }: SkeletonProps) {
    return (
        <div className="skeleton-pulse" style={{ width, height, borderRadius, ...style }} />
    );
}

/** A skeleton that matches the flow card layout */
export function FlowCardSkeleton({ nameWidth }: { nameWidth: number }) {
    const dotCount = Math.floor(Math.random() * 4) + 2;
    return (
        <div className="skeleton-flow-card">
            <Skeleton width="16px" height="16px" borderRadius="4px" />
            <div className="skeleton-flow-card-body">
                <div className="skeleton-flow-card-header">
                    <Skeleton width="14px" height="14px" borderRadius="50%" />
                    <Skeleton width={`${nameWidth}px`} height="14px" />
                </div>
                <div className="skeleton-flow-card-meta">
                    <div className="skeleton-dots">
                        {Array.from({ length: dotCount }, (_, i) => (
                            <Skeleton key={i} width="8px" height="8px" borderRadius="50%" />
                        ))}
                    </div>
                    <Skeleton width="70px" height="10px" />
                    <Skeleton width="45px" height="10px" />
                </div>
            </div>
        </div>
    );
}

/** Multiple flow card skeletons */
export function FlowListSkeleton({ count = 6 }: { count?: number }) {
    const widths = Array.from({ length: count }, () => 100 + Math.floor(Math.random() * 160));
    return (
        <div className="skeleton-flow-list">
            {widths.map((w, i) => (
                <FlowCardSkeleton key={i} nameWidth={w} />
            ))}
        </div>
    );
}

/** A skeleton that looks like an execution table row */
export function ExecutionRowSkeleton() {
    return (
        <tr className="skeleton-table-row">
            <td><Skeleton width={`${100 + Math.random() * 100}px`} height="13px" /></td>
            <td className="table-column-hide-sm"><Skeleton width="80px" height="13px" /></td>
            <td className="table-column-hide-sm"><Skeleton width="90px" height="13px" /></td>
            <td className="table-column-hide-sm"><Skeleton width="60px" height="13px" /></td>
            <td className="table-column-hide-sm"><Skeleton width="50px" height="13px" borderRadius="10px" /></td>
            <td className="table-column-hide-sm"><Skeleton width="45px" height="13px" /></td>
            <td><Skeleton width="24px" height="13px" /></td>
        </tr>
    );
}

/** Multiple execution row skeletons */
export function ExecutionTableSkeleton({ count = 8 }: { count?: number }) {
    return (
        <>
            {Array.from({ length: count }, (_, i) => (
                <ExecutionRowSkeleton key={i} />
            ))}
        </>
    );
}
