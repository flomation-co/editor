import { createContext, useContext } from "react";

// ValidationProblem describes a single reason a flow can't execute.
// Severity ordering (highest first):
//   - secret      : a literal-looking secret pasted into a field
//                   (must be moved into environment secrets first)
//   - unresolved  : a ${...} variable reference that resolves to
//                   nothing — most commonly a typo, a renamed
//                   upstream output, or an `${input.X}` reference
//                   (which isn't a real namespace)
//   - required    : a required field is empty
//
// The node visual + the Execute button tooltip both use the highest-
// severity problem so the user sees the worst issue first and can
// fix it before lesser ones come to light.
export type ValidationProblem = {
    kind: "required" | "unresolved" | "secret";
    fieldName: string;
    fieldLabel: string;
    /** Human-readable, includes the node + field for use in tooltips. */
    detail: string;
};

const ValidationContext = createContext<Map<string, ValidationProblem>>(new Map());

export const ValidationProvider = ValidationContext.Provider;

export function useValidationProblem(nodeId: string): ValidationProblem | undefined {
    const map = useContext(ValidationContext);
    return map.get(nodeId);
}
