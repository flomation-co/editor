// What to ask for before a flow is run by hand.
//
// This lived twice: once in the editor's Execute button and once in the Flows
// list's Run button, each with its own copy. Teaching one of them that a Form
// trigger's questions are inputs left the other running form flows with no
// answers at all — required fields never asked for, never checked, and a row of
// blanks written. One module, both callers.

/** Form field types that carry no answer — page furniture, not questions. */
const FORM_DISPLAY_ONLY = new Set(["section_header", "divider", "info_text"]);

/**
 * How a form field is presented in the Execute modal.
 *
 * The modal renders text / boolean / date / dropdown / integer and falls back
 * to a single-line box for anything else, which is the honest default for the
 * structured types (address, matrix, ranking…): a test run can still supply
 * something rather than the field being silently dropped.
 */
function formFieldInputType(fieldType: string, hasOptions: boolean): string {
    switch (fieldType) {
        case "multiline": return "text";
        case "number": case "slider": case "rating": case "nps": case "opinion_scale":
            return "integer";
        case "boolean": case "consent": return "boolean";
        case "date": return "date";
        case "dropdown": case "radio": case "picture_choice": return "dropdown";
        default: return hasOptions ? "dropdown" : "string";
    }
}

/**
 * findTrigger matches on data.label as well as type.
 *
 * After a revision save and load the durable identity is data.label — node.type
 * is not preserved — so matching on type alone returns nothing for a flow that
 * has been reloaded, which silently skips the modal and runs with no inputs.
 */
function findTrigger(nodes: any[] | undefined, label: string): any {
    if (!Array.isArray(nodes)) return undefined;
    return nodes.find((n: any) => n?.type === label || n?.data?.label === label);
}

/** Inputs declared on a Manual trigger. */
export function manualTriggerInputs(nodes: any[] | undefined): any[] {
    const node = findTrigger(nodes, "trigger/manual");
    const declared = node?.data?.config?.trigger_inputs;
    if (!Array.isArray(declared)) return [];
    return declared.filter((i: any) => i?.name && i.name !== "");
}

/**
 * A Form trigger's questions, projected into the shape the Execute modal
 * already renders for manual-trigger inputs.
 *
 * A form's questions ARE that flow's inputs. Without this, running a
 * form-triggered flow by hand sent nothing at all.
 */
export function formTriggerInputs(nodes: any[] | undefined): any[] {
    const node = findTrigger(nodes, "trigger/form");
    const raw = node?.data?.config?.inputs?.find((i: any) => i?.name === "form_definition")?.value;
    if (!raw) return [];

    let def: any;
    try {
        def = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
        return [];
    }

    const inputs: any[] = [];
    for (const page of def?.pages ?? []) {
        for (const c of page?.components ?? []) {
            if (!c?.name || FORM_DISPLAY_ONLY.has(c.type)) continue;
            const options = Array.isArray(c.options) ? c.options : [];
            inputs.push({
                name: c.name,
                label: c.label || c.name,
                // A field behind a visible_if rule cannot be judged here — the
                // rule depends on answers that do not exist yet — so it is
                // offered but never demanded.
                required: !!c.required && !c.visible_if,
                type: formFieldInputType(c.type, options.length > 0),
                placeholder: c.placeholder || "",
                options: options.map((o: any) => ({
                    name: o.label || o.value,
                    value: o.value ?? o.label,
                    label: o.label || o.value,
                })),
                value: c.default_value ?? "",
            });
        }
    }
    return inputs;
}

/**
 * The inputs to prompt for when a flow is run by hand.
 *
 * Manual is checked first because pressing Run is literally a manual run; a
 * flow carrying both triggers should be asked for what its Manual trigger
 * declares.
 */
export function executeInputs(nodes: any[] | undefined): any[] {
    const manual = manualTriggerInputs(nodes);
    if (manual.length > 0) return manual;
    return formTriggerInputs(nodes);
}
