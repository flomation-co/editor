// Shared React context exposing the active flow's environment ID and
// a refresh callback for the variable lists (secrets / properties /
// credentials).
//
// Why context, not props: the existing `variables` prop already
// drills through ~15 layers (propertyMenu → typeProperty → field →
// VariableInput / VariablePicker). Adding two more siblings (env id
// + refresh fn) to every intermediate component would be invasive.
// The two terminal consumers — VariablePicker and VariableInput —
// reach into this context directly.
//
// Provider lives in editor/index.tsx, wrapping the entire editor
// subtree. Routes that render the editor with a known environment
// also feed the picker through this provider; routes that don't
// have an environment (e.g. embedded preview) provide a null value
// and the picker hides its footer affordances.

import React, { createContext, useContext } from "react";

export type EnvironmentContextValue = {
    /** Active environment ID for the flow being edited. Null when
     *  no environment is set — the picker hides its create / refresh
     *  footer in this state. */
    environmentId: string | null;
    /** Fire-and-forget call that re-runs the editor's three env
     *  fetches (secrets / properties / credentials) and re-populates
     *  the variables list. Invoked by the picker's refresh button
     *  after the user has tabbed away to create a new entry. */
    refreshVariables: () => void;
};

const defaultContext: EnvironmentContextValue = {
    environmentId: null,
    refreshVariables: () => { /* noop when no provider */ },
};

export const EnvironmentContext = createContext<EnvironmentContextValue>(defaultContext);

/** Hook for the variable pickers. Returns the default (null id + noop
 *  refresh) when no provider is mounted, which makes the picker
 *  gracefully degrade — footer hidden, refresh icon disabled. */
export function useEnvironment(): EnvironmentContextValue {
    return useContext(EnvironmentContext);
}
