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
