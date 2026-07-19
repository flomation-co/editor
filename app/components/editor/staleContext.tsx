import { createContext, useContext } from "react";

// A node is "stale" when the action manifest hash baked into its config at
// add-time no longer matches the current manifest — the action has since gained
// or changed inputs/outputs. The set holds the ids of such nodes so CustomNode
// can show an at-a-glance badge (the property panel offers the one-click update).
const StaleContext = createContext<Set<string>>(new Set());

export const StaleProvider = StaleContext.Provider;

export function useIsNodeStale(nodeId: string): boolean {
    return useContext(StaleContext).has(nodeId);
}

// nodeIsStale decides whether a node's baked config has fallen behind the current
// manifest definition (`fresh`). It is the single source of truth for both the
// canvas badge (CustomNode) and the property-panel "Update available" pill.
//
// Two strategies, in order of precedence:
//  1. Hash fast-path — when BOTH the node and the manifest carry an action hash,
//     a mismatch is authoritative (it also catches option/label/default changes a
//     structural diff would miss). Equal hashes mean up-to-date, full stop.
//  2. Structural fallback — legacy nodes added before hashing existed have no
//     baked hash, so there is no baseline to diff against. We instead compare the
//     input/output *shape* (names + input types): a refresh reconciles inputs by
//     name, so a differing shape is exactly what a refresh would change. Without
//     this fallback, every pre-hash node could never be flagged — the common case.
export function nodeIsStale(nodeConfig: any, fresh: any): boolean {
    if (!fresh) return false;
    const cfg = nodeConfig || {};

    // 1. Hash fast-path (only when we actually have both baselines).
    if (fresh.hash && cfg.hash) return fresh.hash !== cfg.hash;

    // 2. Structural fallback for hashless (legacy) nodes.
    const freshInputs: any[] = fresh.inputs || [];
    const cfgInputs: any[] = cfg.inputs || [];
    const freshOutputs: any[] = fresh.outputs || [];
    const cfgOutputs: any[] = cfg.outputs || [];

    if (freshInputs.length !== cfgInputs.length) return true;
    if (freshOutputs.length !== cfgOutputs.length) return true;

    const cfgByName = new Map(cfgInputs.map((i: any) => [i.name, i]));
    for (const fi of freshInputs) {
        const oi = cfgByName.get(fi.name);
        if (!oi) return true;                                   // input added
        if ((fi.type || "") !== (oi.type || "")) return true;   // input type changed
    }

    const cfgOutNames = new Set(cfgOutputs.map((o: any) => o.name));
    for (const fo of freshOutputs) {
        if (!cfgOutNames.has(fo.name)) return true;             // output added
    }

    return false;
}
