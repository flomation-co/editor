import React, {useState, useEffect, useRef} from "react";
import "./index.css";
import { Icon } from "~/components/icons/Icon";
import VariableInput, {type VariableItem} from "~/components/propertyMenu/variableInput";
import FlowSelectProperty from "~/components/propertyMenu/flowSelectProperty";
import OutputSelect from "~/components/outputSelect";
import api from "~/lib/api";
import useConfig from "~/components/config";
import useCookieToken from "~/components/cookie";

type FormOption = {
    label: string;
    value: string;
    // Option-tile image URL used by the picture_choice field. Empty renders
    // a text fallback tile.
    image?: string;
}

// A single "show when" condition: one earlier answer, compared to a value.
type VisibilityClause = {
    field: string;   // identifier of the earlier question whose answer is tested
    op: string;      // equals, not_equals, contains, one_of, empty, ...
    value?: string;  // omitted for the empty / not_empty operators
}

// A group of conditions combined with all (AND) or any (OR). Absent /
// empty means the field or page is always shown. Mirrors visibilityRule in
// launch/internal/http/form.go — the launch renderer evaluates the same
// shape to show/hide live and to strip hidden answers on submit.
type VisibilityRule = {
    match: "all" | "any";
    rules: VisibilityClause[];
}

type FormComponent = {
    name: string;
    label: string;
    type: string;
    placeholder: string;
    required: boolean;
    order: number;
    read_only?: boolean;
    default_value?: string;
    // Present only on radio / checkboxes / dropdown / picture_choice fields.
    options?: FormOption[];
    // picture_choice: false ⇒ single-select (string response); true ⇒
    // multi-select (array response). Ignored by other field types.
    multiple?: boolean;
    // Matrix (grid) field — rows down the side, shared columns across the
    // top. The response is an object keyed by row value; cell_type decides
    // whether each row holds a single column value (radio → string) or a
    // set (checkbox → string[]). Only used by the "matrix" field type.
    matrix_rows?: FormOption[];
    matrix_columns?: FormOption[];
    cell_type?: "radio" | "checkbox";
    // When set (option-based fields only), options are populated at load
    // time from this key in the data-source flow's outputs, rather than the
    // static options above. Requires a form-level data flow.
    options_source?: string;
    // Numeric constraints — apply to number, slider, and rating types.
    min?: number;
    max?: number;
    step?: number;
    integer_only?: boolean;
    // Number of stars/points for rating fields (typically 5 or 10). Also the
    // top score of an nps field (0..scale — 5 or 10).
    scale?: number;
    // NPS end-of-scale captions (e.g. "Not likely" / "Very likely").
    scale_label_low?: string;
    scale_label_high?: string;
    // contact_name sub-fields, in order. Empty defaults to
    // ["first_name", "last_name", "email"]; "phone" is also supported.
    contact_fields?: string[];
    // Bounds for date/time HTML5 inputs, as ISO strings.
    min_date?: string;
    max_date?: string;
    // Paragraph text used by info_text display-only components.
    display_text?: string;
    // Location precision — "coarse" rounds coordinates client-side to
    // ~110m; "fine" (or unset) uses raw device precision.
    precision?: "coarse" | "fine";
    // Upload-field constraints (esignature / camera / file_upload / license_plate).
    accept_mime?: string;
    max_size_bytes?: number;
    allow_gallery?: boolean;
    // Recognition-field settings (license_plate, and future face/OCR fields).
    // capture_mode: "manual" = tap-to-capture (default); "auto" = hands-off
    // continuous detection with no button (e.g. car-park entry).
    capture_mode?: "manual" | "auto";
    // auto_submit (auto mode only): submit the whole form on a confident
    // recognition — the true unattended kiosk loop. Default off.
    auto_submit?: boolean;
    // Minimum confidence (0..1) before a recognition is accepted in auto mode.
    confidence_threshold?: number;
    // Informational privacy notice shown beside the field (not a gating
    // consent checkbox). show_privacy_notice defaults to true.
    privacy_notice?: string;
    show_privacy_notice?: boolean;
    // Payment field (type "payment") — collects a card payment via Stripe
    // hosted Checkout on submit. amount is a MAJOR-unit decimal string
    // (e.g. "49.99"); it may be a ${data.X} reference (resolved server-side).
    // currency is an ISO-4217 code (e.g. "gbp"). payment_secret is a
    // ${secrets.X} reference to the Stripe secret key.
    amount?: string;
    currency?: string;
    payment_secret?: string;
    // Flow-computed value. When value_source names a flow, this field's value
    // is produced by running that flow with the current form answers as
    // ${input.X} — the field renders read-only. value_output selects which
    // flow output key holds the value (defaults to the field's own name). On a
    // payment field this drives the Amount (e.g. a reg-plate → car-park price).
    value_source?: string;
    value_output?: string;
    // Conditional visibility — show this field only when earlier answers
    // satisfy the rule. Absent means always visible.
    visible_if?: VisibilityRule;
    // Show a "Copy" button at the end of the rendered field so respondents can
    // copy its current value to the clipboard. Default off (undefined/false).
    // Useful for read-only / flow-computed values (e.g. a generated reference).
    allow_copy?: boolean;
}

// Types whose response is constrained to a curated list. Adding a new
// option-based type here automatically pulls in the sub-editor UI and
// the seed-on-add behaviour. Ranking is included because its schema is
// identical to radio/checkboxes/dropdown — it's just the response
// shape that differs (ordered array vs single / unordered set).
const OPTION_BASED_TYPES = new Set(["radio", "checkboxes", "dropdown", "ranking", "opinion_scale"]);

// Types whose config includes numeric range/step constraints.
const NUMERIC_TYPES = new Set(["number", "slider", "rating"]);

// Types backed by an HTML5 date/time input, which accept min/max bounds.
const DATE_TIME_TYPES = new Set(["date", "time", "datetime"]);

// Display-only types render structural elements — no input, no response.
// Mirrors the backend's displayOnlyTypes set in launch/internal/http/form.go.
const DISPLAY_ONLY_TYPES = new Set(["section_header", "divider", "info_text"]);

// Structured types produce nested-object responses rather than a scalar.
// Placeholder / default_value / read-only don't map cleanly for these,
// so the FormBuilder hides those controls and shows type-specific config
// (precision selector for location, nothing for address). Matrix joins them
// — its response is an object keyed by row value, so placeholder/default make
// no sense; it keeps the required toggle and its own rows/columns editor.
const STRUCTURED_TYPES = new Set(["location", "address", "contact_name", "matrix"]);

// Upload types capture a file and store its bytes in the blob store;
// the response is a flo:blob:... token string. Placeholder / default
// don't apply (the user picks a file rather than typing). Read-only
// works via disabling the picker. license_plate also uploads a captured
// frame, so it shares the upload UI treatment.
const UPLOAD_TYPES = new Set(["esignature", "camera", "file_upload", "license_plate"]);

// supportsComputedValue reports whether a field type can have a scalar value
// produced by a flow (value_source). Mirrors placeholder/default eligibility —
// structured, upload, display-only and the toggle/scale/choice types don't
// carry a plain scalar value. Payment is handled separately ("Amount from a
// flow"), so it is excluded here.
function supportsComputedValue(type: string): boolean {
    return !DISPLAY_ONLY_TYPES.has(type) && !STRUCTURED_TYPES.has(type) &&
        !UPLOAD_TYPES.has(type) && type !== "consent" && type !== "nps" &&
        type !== "picture_choice" && type !== "payment";
}

// Field types that render as a single-value control (a lone input / textarea /
// select) whose value can be copied to the clipboard. The optional "Copy button"
// toggle is offered only for these — copying a scalar reference (e.g. a
// flow-computed reference number) is the clear use case; multi-part, choice and
// upload fields have no single value to copy. Mirrors the form.html renderer,
// which attaches the button to the same set.
const COPYABLE_TYPES = new Set([
    "text", "multiline", "number", "email", "phone", "url", "dropdown",
    "date", "time", "datetime",
]);
function supportsCopy(type: string): boolean {
    return COPYABLE_TYPES.has(type);
}

// Recognition types capture a camera frame AND run in-browser recognition,
// emitting a composite value ({image, plate, ...}). They carry capture-mode,
// auto-submit and privacy-notice settings. This set is the extension point
// for future recognition fields (face, OCR, …).
const RECOGNITION_TYPES = new Set(["license_plate"]);

// slugifyOptionValue turns a display label into a machine-safe value.
// Used to prefill the value field when the user only edits the label —
// once the user hand-edits the value we stop auto-syncing (tracked by
// the caller comparing prev.value against the derived slug).
const slugifyOptionValue = (label: string): string => {
    return label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
};

// Auto-name pattern applied when a field is first added — used as a
// heuristic to decide whether the Identifier is still tracking the
// Label (auto-sync ON) or has been hand-edited (auto-sync OFF).
const AUTO_NAME_PATTERN = /^field_\d+$/;

// identifierTracksLabel returns true when the current identifier looks
// like it was auto-derived from the previous label. We treat two shapes
// as "still tracking":
//   1. The initial auto-name ("field_1", "field_17", ...).
//   2. The slug of the label BEFORE the current change — i.e. the user
//      hasn't hand-edited the identifier since the last label edit.
const identifierTracksLabel = (identifier: string, previousLabel: string): boolean => {
    if (!identifier) return true;
    if (AUTO_NAME_PATTERN.test(identifier)) return true;
    return identifier === slugifyOptionValue(previousLabel);
};

type FormPage = {
    components: FormComponent[];
    // Conditional visibility for the whole page — skipped in navigation
    // and stripped on submit when the rule isn't satisfied.
    visible_if?: VisibilityRule;
}

// Autofill config: run a flow when the form loads and expose its outputs as
// ${data.X} in labels, placeholders and default values.
type FormDataSource = {
    flow_id: string;
    timeout_seconds?: number;
}

// Post-submission behaviour: a custom thank-you message, resetting for another
// response (kiosk), or redirecting the browser.
type FormSubmit = {
    success_message?: string;
    on_submit?: "message" | "restart" | "redirect";
    redirect_url?: string;
    redirect_delay_seconds?: number;
    // Override the Submit button text (default "Submit"). Display only.
    submit_label?: string;
}

type FormDefinition = {
    title: string;
    description: string;
    pages: FormPage[];
    // Require Sentinel session cookie to view/submit. Enables ${user.X}
    // substitution at render time.
    require_login?: boolean;
    // Optional flow whose outputs prefill fields via ${data.X}.
    data_source?: FormDataSource;
    // What happens after a successful submission (thank-you / restart / redirect).
    submit?: FormSubmit;
}

type Props = {
    nodeId: string;
    value: string;
    variables?: VariableItem[];
    onChange: (value: string) => void;
}

// parseFormDefinition turns the stored form_definition JSON string into a
// FormDefinition, filling in sane defaults for missing top-level fields. Pages
// (and therefore every component's config — payment value_source/value_output,
// visibility rules, options, …) are passed through verbatim, so nothing about a
// field is lost on load. Shared by the initial mount and the external-value
// re-sync below so both interpret a saved definition identically.
const parseFormDefinition = (raw: string): FormDefinition => {
    try {
        const parsed = JSON.parse(raw || "{}");
        return {
            title: parsed.title || "Untitled Form",
            description: parsed.description || "",
            pages: parsed.pages || [{components: []}],
            require_login: parsed.require_login || false,
            data_source: parsed.data_source || undefined,
            submit: parsed.submit || undefined,
        };
    } catch {
        return {title: "Untitled Form", description: "", pages: [{components: []}], require_login: false};
    }
};


const fieldTypes = [
    {value: "text", label: "Text", icon: "i-cursor"},
    {value: "multiline", label: "Multi-line", icon: "align-left"},
    {value: "number", label: "Number", icon: "hashtag"},
    {value: "boolean", label: "Checkbox", icon: "check"},
    {value: "radio", label: "Radio", icon: "circle-dot"},
    {value: "checkboxes", label: "Checkbox Group", icon: "list-check"},
    {value: "matrix", label: "Matrix / Grid", icon: "table"},
    {value: "dropdown", label: "Dropdown", icon: "chevron-down"},
    {value: "picture_choice", label: "Picture Choice", icon: "image"},
    {value: "email", label: "Email", icon: "envelope"},
    {value: "phone", label: "Phone", icon: "phone"},
    {value: "url", label: "URL", icon: "link"},
    {value: "date", label: "Date", icon: "calendar"},
    {value: "time", label: "Time", icon: "clock"},
    {value: "datetime", label: "Date & Time", icon: "calendar"},
    {value: "slider", label: "Slider", icon: "gauge"},
    {value: "rating", label: "Rating", icon: "star"},
    {value: "section_header", label: "Section Header", icon: "bookmark"},
    {value: "divider", label: "Divider", icon: "minus"},
    {value: "info_text", label: "Info Text", icon: "lightbulb"},
    {value: "location", label: "Location", icon: "map"},
    {value: "address", label: "Address", icon: "house"},
    {value: "esignature", label: "eSignature", icon: "pencil"},
    {value: "camera", label: "Camera", icon: "image"},
    {value: "file_upload", label: "File Upload", icon: "file-arrow-down"},
    {value: "qr_scanner", label: "QR / Barcode", icon: "qrcode"},
    {value: "license_plate", label: "Licence Plate", icon: "magnifying-glass"},
    {value: "ranking", label: "Ranking", icon: "list"},
    {value: "nps", label: "NPS", icon: "gauge"},
    {value: "opinion_scale", label: "Opinion Scale", icon: "list-check"},
    {value: "consent", label: "Consent", icon: "clipboard-list"},
    {value: "contact_name", label: "Contact Info", icon: "user"},
    {value: "payment", label: "Payment", icon: "dollar-sign"},
];

// Operators offered in the conditional-visibility builder. Labels are
// deliberately plain-English ("is", "is not") rather than jargon so a
// non-technical form author can read a rule like a sentence. The `value`
// strings are the wire format the launch renderer evaluates — keep them in
// sync with evalClause in launch/internal/http/form.go.
const VISIBILITY_OPERATORS = [
    {value: "equals", label: "is"},
    {value: "not_equals", label: "is not"},
    {value: "contains", label: "contains"},
    {value: "not_contains", label: "does not contain"},
    {value: "starts_with", label: "starts with"},
    {value: "ends_with", label: "ends with"},
    {value: "one_of", label: "is one of"},
    {value: "empty", label: "is empty"},
    {value: "not_empty", label: "is not empty"},
    {value: "greater_than", label: "is greater than"},
    {value: "less_than", label: "is less than"},
];

// Operators that take no comparison value (they test presence, not a value).
const VALUELESS_OPS = new Set(["empty", "not_empty"]);

type SourceField = {name: string; label: string};

// VisibilityEditor is the shared "show this when…" builder used for both a
// single question and a whole page. It's fully controlled — the parent owns
// the rule and receives an updated one (or undefined to clear all
// conditions) via onChange. `sources` is the list of earlier questions that
// may be referenced; when empty the control can't be enabled.
const VisibilityEditor = ({rule, sources, onChange, scope}: {
    rule?: VisibilityRule;
    sources: SourceField[];
    onChange: (rule?: VisibilityRule) => void;
    scope: "question" | "page";
}) => {
    const enabled = !!rule && rule.rules.length > 0;

    const newClause = (): VisibilityClause => ({field: sources[0]?.name || "", op: "equals", value: ""});

    if (!enabled) {
        // Nothing to condition against yet — don't signpost the edge case.
        if (sources.length === 0) {
            return null;
        }
        return (
            <button
                type="button"
                className="fb-visibility-enable"
                onClick={() => onChange({match: "all", rules: [newClause()]})}
            >
                <Icon name="eye" /> Conditional visibility
            </button>
        );
    }

    const patchClause = (i: number, patch: Partial<VisibilityClause>) =>
        onChange({...rule!, rules: rule!.rules.map((c, ci) => ci === i ? {...c, ...patch} : c)});

    const removeClause = (i: number) => {
        const rules = rule!.rules.filter((_, ci) => ci !== i);
        onChange(rules.length === 0 ? undefined : {...rule!, rules});
    };

    return (
        <div className="fb-visibility">
            <div className="fb-visibility-head">
                <span className="fb-visibility-title">
                    <Icon name="eye" /> Show this {scope} when
                </span>
                {rule!.rules.length > 1 && (
                    <select
                        className="fb-input fb-input-sm fb-visibility-match"
                        value={rule!.match}
                        onChange={e => onChange({...rule!, match: e.target.value as "all" | "any"})}
                    >
                        <option value="all">all match</option>
                        <option value="any">any match</option>
                    </select>
                )}
                <button
                    type="button"
                    className="fb-icon-btn fb-danger"
                    title="Remove all conditions"
                    onClick={() => onChange(undefined)}
                >
                    <Icon name="xmark" />
                </button>
            </div>

            {rule!.rules.map((clause, i) => (
                <div key={i} className="fb-visibility-clause">
                    <select
                        className="fb-input fb-input-sm"
                        value={clause.field}
                        onChange={e => patchClause(i, {field: e.target.value})}
                    >
                        {!sources.some(s => s.name === clause.field) && (
                            // The referenced field was renamed/removed — keep it
                            // visible so the author notices rather than silently
                            // repointing the rule at a different question.
                            <option value={clause.field}>{clause.field || "(choose a question)"}</option>
                        )}
                        {sources.map(s => (
                            <option key={s.name} value={s.name}>{s.label || s.name}</option>
                        ))}
                    </select>
                    <select
                        className="fb-input fb-input-sm"
                        value={clause.op}
                        onChange={e => patchClause(i, {op: e.target.value})}
                    >
                        {VISIBILITY_OPERATORS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                    </select>
                    {!VALUELESS_OPS.has(clause.op) && (
                        <input
                            className="fb-input fb-input-sm"
                            value={clause.value || ""}
                            placeholder={clause.op === "one_of" ? "a, b, c" : "value"}
                            onChange={e => patchClause(i, {value: e.target.value})}
                        />
                    )}
                    <button
                        type="button"
                        className="fb-icon-btn fb-danger"
                        title="Remove condition"
                        onClick={() => removeClause(i)}
                    >
                        <Icon name="trash" />
                    </button>
                </div>
            ))}

            <button
                type="button"
                className="fb-add-option"
                onClick={() => onChange({...rule!, rules: [...rule!.rules, newClause()]})}
            >
                <Icon name="plus" /> Add condition
            </button>
        </div>
    );
};

const FormBuilder = (props: Props) => {
    const [addingToPage, setAddingToPage] = useState<number | null>(null);

    const [form, setForm] = useState<FormDefinition>(() => parseFormDefinition(props.value));

    // Distinguish our OWN echo (the value we just emitted, which the parent
    // stores and hands straight back as props.value) from a genuine EXTERNAL
    // change to the definition — a flow reload, an undo/redo, or a collaborator
    // replacing the node. The builder's key is stable per node, so it never
    // remounts on those; without this it would keep showing stale data (e.g. a
    // payment field's value_source/value_output/payment_secret appearing to
    // "revert"). Seeded with the mount value so the initial emit is recognised
    // as our own and doesn't trigger a needless re-seed.
    const lastEmitted = useRef<string>(props.value);

    // The data-driven (prefill-from-a-flow) section is collapsed by default so
    // it doesn't crowd the common case — but starts open if a flow is already
    // configured, so an existing data source is never hidden away.
    const [dataDrivenOpen, setDataDrivenOpen] = useState(() => !!form.data_source?.flow_id);

    // "After submission" section — collapsed by default; opens if any
    // post-submit behaviour is already configured.
    const [afterSubmitOpen, setAfterSubmitOpen] = useState(() => {
        const s = form.submit;
        return !!(s && (s.success_message || (s.on_submit && s.on_submit !== "message") || s.redirect_url || s.submit_label));
    });

    // Per-field "Computed by a flow" disclosure. Collapsed by default (an absent
    // key means closed) so the common case — a plain field — stays uncluttered;
    // authors expand it only when wiring a flow-computed value. Keyed by
    // "<pageIndex>-<fieldIndex>". A configured value_source shows a badge on the
    // collapsed header so it's still discoverable without expanding.
    const [computedOpen, setComputedOpen] = useState<Record<string, boolean>>({});
    const toggleComputed = (key: string) =>
        setComputedOpen(prev => ({...prev, [key]: !prev[key]}));

    useEffect(() => {
        const serialised = JSON.stringify(form);
        // Record what we emit so the sync effect below can tell our own echo
        // apart from an external change.
        lastEmitted.current = serialised;
        props.onChange(serialised);
    }, [form]);

    // Re-seed from props.value ONLY when it differs from what we last emitted —
    // i.e. the definition changed underneath us (reload / undo / collaborator),
    // not our own round-trip. This keeps an open builder in sync with external
    // updates without ever clobbering in-progress edits (those match
    // lastEmitted and are ignored). The equality check makes this loop-safe: our
    // emit sets lastEmitted, the parent echoes the same string back, and this
    // effect no-ops.
    useEffect(() => {
        if (props.value === lastEmitted.current) return;
        lastEmitted.current = props.value;
        setForm(parseFormDefinition(props.value));
    }, [props.value]);

    // Autocomplete suggestions for the "Computed by a flow" output field. For
    // each flow referenced by a field's value_source we fetch the flow revision
    // once and extract the keys named by its output/set nodes, so the author is
    // offered the flow's real output names rather than typing a free-text guess.
    // Cached per flow id (an entry — even an empty array — marks a completed
    // fetch, so switching fields or re-rendering never refetches).
    const config = useConfig();
    const token = useCookieToken();
    const [flowOutputs, setFlowOutputs] = useState<Record<string, string[]>>({});

    useEffect(() => {
        const ids = new Set<string>();
        form.pages.forEach(p => p.components?.forEach(c => {
            if (c.value_source) ids.add(c.value_source);
        }));
        ids.forEach(flowId => {
            if (flowOutputs[flowId] !== undefined) return; // already fetched (incl. empty)
            const url = config("AUTOMATE_API_URL");
            api.get(`${url}/api/v1/flo/${flowId}`, {
                headers: { Authorization: "Bearer " + token },
            })
                .then(res => {
                    const nodes = res.data?.revision?.data?.nodes;
                    const keys: string[] = [];
                    if (Array.isArray(nodes)) {
                        for (const n of nodes) {
                            const isOutput = n?.data?.label === "output/set" || n?.type === "output/set";
                            if (!isOutput) continue;
                            const inputs = n?.data?.config?.inputs;
                            if (!Array.isArray(inputs)) continue;
                            const nameInput = inputs.find((inp: any) => inp?.name === "name");
                            const key = nameInput?.value;
                            if (typeof key === "string" && key && !keys.includes(key)) {
                                keys.push(key);
                            }
                        }
                    }
                    setFlowOutputs(prev => ({...prev, [flowId]: keys}));
                })
                .catch(() => setFlowOutputs(prev => ({...prev, [flowId]: []})));
        });
    }, [form, flowOutputs]);

    const updateForm = (updates: Partial<FormDefinition>) => {
        setForm(prev => ({...prev, ...updates}));
    };

    const addPage = () => {
        setForm(prev => ({
            ...prev,
            pages: [...prev.pages, {components: []}],
        }));
    };

    const removePage = (pageIndex: number) => {
        if (form.pages.length <= 1) return;
        setForm(prev => ({
            ...prev,
            pages: prev.pages.filter((_, i) => i !== pageIndex),
        }));
    };

    const addField = (pageIndex: number, type: string) => {
        const fieldNum = form.pages.reduce((acc, p) => acc + p.components.length, 0) + 1;
        const typeLabel = fieldTypes.find(ft => ft.value === type)?.label || type;
        const newField: FormComponent = {
            name: `field_${fieldNum}`,
            label: `${typeLabel} Field`,
            type,
            placeholder: "",
            required: false,
            order: form.pages[pageIndex].components.length,
        };
        // Seed a single starter option for option-based types so the
        // sub-editor renders with something to edit rather than an
        // empty state. Users can add / remove from there.
        if (OPTION_BASED_TYPES.has(type)) {
            newField.options = [{label: "Option 1", value: "option_1"}];
        }
        // Slider needs a sensible range or the browser renders it as a
        // dot with no drag surface. 0-100 step 1 covers most percentage
        // and dial-style use cases; users can widen from there.
        if (type === "slider") {
            newField.min = 0;
            newField.max = 100;
            newField.step = 1;
        }
        // Rating fields default to a 5-star scale, which fits mobile
        // channels better than 10 and matches product-review conventions.
        if (type === "rating") {
            newField.scale = 5;
        }
        // Location defaults to fine precision. Coarse rounds coordinates
        // to ~110m granularity which is enough for "which country /
        // region" flows but too coarse for turn-by-turn use cases.
        if (type === "location") {
            newField.precision = "fine";
        }
        // Upload-type defaults: cap at 10 MB (well under the API's 25 MB
        // hard limit, but enough for phone-camera photos and typical PDF
        // uploads). eSignature always outputs PNG so its accept_mime is
        // locked. Camera defaults to gallery=off (pure capture) to match
        // the "prove you're here now" identity/verification use case.
        if (type === "esignature") {
            newField.accept_mime = "image/png";
            newField.max_size_bytes = 10 * 1024 * 1024;
        }
        if (type === "camera") {
            newField.accept_mime = "image/*";
            newField.max_size_bytes = 10 * 1024 * 1024;
            newField.allow_gallery = false;
        }
        if (type === "file_upload") {
            newField.max_size_bytes = 10 * 1024 * 1024;
        }
        if (type === "license_plate") {
            newField.accept_mime = "image/*";
            newField.max_size_bytes = 10 * 1024 * 1024;
            newField.capture_mode = "manual";
            newField.show_privacy_notice = true;
            newField.privacy_notice =
                "This field uses your device camera to read a licence plate. " +
                "Images are processed in your browser.";
        }
        // NPS defaults to a 0–10 promoter score with the conventional
        // likelihood end captions. Authors can drop to 0–5 in the config.
        if (type === "nps") {
            newField.scale = 10;
            newField.scale_label_low = "Not likely";
            newField.scale_label_high = "Very likely";
        }
        // Opinion scale seeds a 5-point Likert set (overriding the generic
        // single starter option seeded above for OPTION_BASED_TYPES).
        if (type === "opinion_scale") {
            newField.options = [
                {label: "Strongly disagree", value: "strongly_disagree"},
                {label: "Disagree", value: "disagree"},
                {label: "Neutral", value: "neutral"},
                {label: "Agree", value: "agree"},
                {label: "Strongly agree", value: "strongly_agree"},
            ];
        }
        // Consent is a required opt-in by nature: a ticked-to-proceed
        // checkbox with legal/terms text shown above it.
        if (type === "consent") {
            newField.label = "I agree to the terms";
            newField.display_text = "Please read and accept our terms.";
            newField.required = true;
        }
        // Contact info defaults to name + email; "phone" can be added.
        if (type === "contact_name") {
            newField.contact_fields = ["first_name", "last_name", "email"];
        }
        // Picture choice seeds one starter option with an empty image URL and
        // defaults to single-select. Its options carry an image alongside
        // label/value, so it uses a dedicated editor rather than
        // OPTION_BASED_TYPES.
        if (type === "picture_choice") {
            newField.options = [{label: "Option 1", value: "option_1", image: ""}];
            newField.multiple = false;
        }
        // Matrix seeds one row and one column plus a single-choice cell type,
        // so the dual editors render with something to edit straight away.
        if (type === "matrix") {
            newField.matrix_rows = [{label: "Row 1", value: "row_1"}];
            newField.matrix_columns = [{label: "Column 1", value: "column_1"}];
            newField.cell_type = "radio";
        }
        // Payment defaults to £ (GBP) and the conventional secret name. The
        // amount is left blank for the author to fill (a literal or ${data.X}).
        // It collects no input, so it is never required.
        if (type === "payment") {
            newField.label = "Payment";
            newField.amount = "";
            newField.currency = "gbp";
            newField.payment_secret = "${secrets.stripe_secret_key}";
            newField.required = false;
        }
        // Display-only types get a friendlier default label and no
        // placeholder — they don't collect input, so "Field N Label"
        // and a text-input placeholder would be misleading.
        if (DISPLAY_ONLY_TYPES.has(type)) {
            if (type === "section_header") {
                newField.label = "Section Heading";
            } else if (type === "divider") {
                newField.label = "";  // dividers render without text
            } else if (type === "info_text") {
                newField.label = "";  // paragraph text sits inside display_text
                newField.display_text = "Additional information for the user.";
            }
            newField.required = false;
        }

        setForm(prev => ({
            ...prev,
            pages: prev.pages.map((p, i) =>
                i === pageIndex ? {...p, components: [...p.components, newField]} : p
            ),
        }));
        setAddingToPage(null);
    };

    const updateField = (pageIndex: number, fieldIndex: number, updates: Partial<FormComponent>) => {
        setForm(prev => ({
            ...prev,
            pages: prev.pages.map((p, pi) =>
                pi === pageIndex ? {
                    ...p,
                    components: p.components.map((c, ci) =>
                        ci === fieldIndex ? {...c, ...updates} : c
                    ),
                } : p
            ),
        }));
    };

    const updatePage = (pageIndex: number, updates: Partial<FormPage>) => {
        setForm(prev => ({
            ...prev,
            pages: prev.pages.map((p, pi) => pi === pageIndex ? {...p, ...updates} : p),
        }));
    };

    // Questions that a conditional rule may reference must appear *before*
    // the thing being gated — earlier pages, or an earlier position on the
    // same page — so a rule can never point forward or at itself (which
    // would risk an evaluation cycle). Display-only elements hold no answer,
    // so they're excluded as sources.
    const sourceFieldsForComponent = (pageIndex: number, fieldIndex: number): SourceField[] => {
        const out: SourceField[] = [];
        form.pages.forEach((p, pi) => {
            if (pi > pageIndex) return;
            p.components.forEach((c, ci) => {
                if (pi === pageIndex && ci >= fieldIndex) return;
                if (DISPLAY_ONLY_TYPES.has(c.type)) return;
                out.push({name: c.name, label: c.label || c.name});
            });
        });
        return out;
    };

    // A page condition may only reference answers from strictly earlier
    // pages (a page can't depend on answers the user hasn't reached yet).
    const sourceFieldsForPage = (pageIndex: number): SourceField[] => {
        const out: SourceField[] = [];
        form.pages.forEach((p, pi) => {
            if (pi >= pageIndex) return;
            p.components.forEach(c => {
                if (DISPLAY_ONLY_TYPES.has(c.type)) return;
                out.push({name: c.name, label: c.label || c.name});
            });
        });
        return out;
    };

    const removeField = (pageIndex: number, fieldIndex: number) => {
        setForm(prev => ({
            ...prev,
            pages: prev.pages.map((p, pi) =>
                pi === pageIndex ? {
                    ...p,
                    components: p.components.filter((_, ci) => ci !== fieldIndex)
                        .map((c, i) => ({...c, order: i})),
                } : p
            ),
        }));
    };

    const moveField = (pageIndex: number, fieldIndex: number, direction: -1 | 1) => {
        const targetIndex = fieldIndex + direction;
        const page = form.pages[pageIndex];
        if (targetIndex < 0 || targetIndex >= page.components.length) return;

        setForm(prev => ({
            ...prev,
            pages: prev.pages.map((p, pi) => {
                if (pi !== pageIndex) return p;
                const comps = [...p.components];
                [comps[fieldIndex], comps[targetIndex]] = [comps[targetIndex], comps[fieldIndex]];
                return {...p, components: comps.map((c, i) => ({...c, order: i}))};
            }),
        }));
    };

    const updateOption = (pageIndex: number, fieldIndex: number, optionIndex: number, updates: Partial<FormOption>) => {
        setForm(prev => ({
            ...prev,
            pages: prev.pages.map((p, pi) => pi !== pageIndex ? p : {
                ...p,
                components: p.components.map((c, ci) => ci !== fieldIndex ? c : {
                    ...c,
                    options: (c.options || []).map((o, oi) => oi !== optionIndex ? o : {...o, ...updates}),
                }),
            }),
        }));
    };

    const addOption = (pageIndex: number, fieldIndex: number) => {
        setForm(prev => ({
            ...prev,
            pages: prev.pages.map((p, pi) => pi !== pageIndex ? p : {
                ...p,
                components: p.components.map((c, ci) => {
                    if (ci !== fieldIndex) return c;
                    const existing = c.options || [];
                    const n = existing.length + 1;
                    return {...c, options: [...existing, {label: `Option ${n}`, value: `option_${n}`}]};
                }),
            }),
        }));
    };

    const removeOption = (pageIndex: number, fieldIndex: number, optionIndex: number) => {
        setForm(prev => ({
            ...prev,
            pages: prev.pages.map((p, pi) => pi !== pageIndex ? p : {
                ...p,
                components: p.components.map((c, ci) => ci !== fieldIndex ? c : {
                    ...c,
                    options: (c.options || []).filter((_, oi) => oi !== optionIndex),
                }),
            }),
        }));
    };

    const moveOption = (pageIndex: number, fieldIndex: number, optionIndex: number, direction: -1 | 1) => {
        setForm(prev => ({
            ...prev,
            pages: prev.pages.map((p, pi) => {
                if (pi !== pageIndex) return p;
                return {
                    ...p,
                    components: p.components.map((c, ci) => {
                        if (ci !== fieldIndex) return c;
                        const opts = [...(c.options || [])];
                        const target = optionIndex + direction;
                        if (target < 0 || target >= opts.length) return c;
                        [opts[optionIndex], opts[target]] = [opts[target], opts[optionIndex]];
                        return {...c, options: opts};
                    }),
                };
            }),
        }));
    };

    // ── Matrix rows/columns editors ──────────────────────────────────────
    // The matrix has two independent option lists (matrix_rows and
    // matrix_columns) that share the option-row editor UI. Rather than
    // overload the single-`options` helpers above, these generic helpers take
    // a listKey ("matrix_rows" | "matrix_columns") and operate on comp[listKey],
    // reusing the same label→value auto-slug behaviour.
    type MatrixListKey = "matrix_rows" | "matrix_columns";

    const updateListItem = (pageIndex: number, fieldIndex: number, listKey: MatrixListKey, itemIndex: number, patch: Partial<FormOption>) => {
        setForm(prev => ({
            ...prev,
            pages: prev.pages.map((p, pi) => pi !== pageIndex ? p : {
                ...p,
                components: p.components.map((c, ci) => ci !== fieldIndex ? c : {
                    ...c,
                    [listKey]: (c[listKey] || []).map((o, oi) => oi !== itemIndex ? o : {...o, ...patch}),
                }),
            }),
        }));
    };

    const addListItem = (pageIndex: number, fieldIndex: number, listKey: MatrixListKey) => {
        setForm(prev => ({
            ...prev,
            pages: prev.pages.map((p, pi) => pi !== pageIndex ? p : {
                ...p,
                components: p.components.map((c, ci) => {
                    if (ci !== fieldIndex) return c;
                    const existing = c[listKey] || [];
                    const n = existing.length + 1;
                    const stem = listKey === "matrix_rows" ? "Row" : "Column";
                    const slug = listKey === "matrix_rows" ? "row" : "column";
                    return {...c, [listKey]: [...existing, {label: `${stem} ${n}`, value: `${slug}_${n}`}]};
                }),
            }),
        }));
    };

    const removeListItem = (pageIndex: number, fieldIndex: number, listKey: MatrixListKey, itemIndex: number) => {
        setForm(prev => ({
            ...prev,
            pages: prev.pages.map((p, pi) => pi !== pageIndex ? p : {
                ...p,
                components: p.components.map((c, ci) => ci !== fieldIndex ? c : {
                    ...c,
                    [listKey]: (c[listKey] || []).filter((_, oi) => oi !== itemIndex),
                }),
            }),
        }));
    };

    const moveListItem = (pageIndex: number, fieldIndex: number, listKey: MatrixListKey, itemIndex: number, direction: -1 | 1) => {
        setForm(prev => ({
            ...prev,
            pages: prev.pages.map((p, pi) => {
                if (pi !== pageIndex) return p;
                return {
                    ...p,
                    components: p.components.map((c, ci) => {
                        if (ci !== fieldIndex) return c;
                        const items = [...(c[listKey] || [])];
                        const target = itemIndex + direction;
                        if (target < 0 || target >= items.length) return c;
                        [items[itemIndex], items[target]] = [items[target], items[itemIndex]];
                        return {...c, [listKey]: items};
                    }),
                };
            }),
        }));
    };

    const movePage = (pageIndex: number, direction: -1 | 1) => {
        const targetIndex = pageIndex + direction;
        if (targetIndex < 0 || targetIndex >= form.pages.length) return;

        setForm(prev => {
            const pages = [...prev.pages];
            [pages[pageIndex], pages[targetIndex]] = [pages[targetIndex], pages[pageIndex]];
            return {...prev, pages};
        });
    };

    return (
        <div className="form-builder">
            <div className="fb-section">
                <div className="fb-field-row">
                    <label className="fb-label">Form Title</label>
                    <VariableInput
                        nodeId={`${props.nodeId}-title`}
                        name="form_title"
                        placeholder=""
                        label="Form Title"
                        value={form.title}
                        variables={props.variables || []}
                        onValueChange={(_, v) => updateForm({title: v})}
                    />
                </div>
                <div className="fb-field-row">
                    <label className="fb-label">Description</label>
                    <VariableInput
                        nodeId={`${props.nodeId}-description`}
                        name="form_description"
                        placeholder="Optional description"
                        label="Description"
                        value={form.description}
                        variables={props.variables || []}
                        multiline
                        onValueChange={(_, v) => updateForm({description: v})}
                    />
                    <span className="fb-hint">
                        Supports line breaks, <strong>*bold*</strong> and <em>_italic_</em>.
                    </span>
                </div>
                <div className="fb-field-row">
                    <label className="fb-toggle-label fb-toggle-label--prominent">
                        <input
                            type="checkbox"
                            checked={form.require_login || false}
                            onChange={e => updateForm({require_login: e.target.checked})}
                        />
                        <span>
                            <strong>Require login</strong>
                            <span className="fb-toggle-desc">
                                Users must be signed in to view or submit. Enables
                                <code>{" ${user.X} "}</code>substitution in labels and default values.
                            </span>
                        </span>
                    </label>
                </div>
                <div className="fb-field-row fb-collapsible">
                    <button
                        type="button"
                        className="fb-collapsible-header"
                        onClick={() => setDataDrivenOpen(o => !o)}
                        aria-expanded={dataDrivenOpen}
                    >
                        <Icon name={dataDrivenOpen ? "chevron-down" : "chevron-right"} />
                        <span className="fb-collapsible-title">Data-driven form</span>
                        {form.data_source?.flow_id && (
                            <span className="fb-collapsible-badge">1 flow</span>
                        )}
                    </button>
                    {dataDrivenOpen && (
                        <div className="fb-datasource">
                            <span className="fb-datasource-desc">
                                Run a flow when the form loads and use its outputs to fill fields
                                with <code>{" ${data.X} "}</code>(e.g. a default of
                                <code>{" ${data.customer_name} "}</code>). The flow runs once and the
                                result is cached, so many visitors share a single run.
                            </span>
                            <FlowSelectProperty
                                nodeId={`${props.nodeId}-datasource`}
                                name="data_source_flow"
                                label="Data flow"
                                value={form.data_source?.flow_id || ""}
                                onValueChange={(_, flowId) =>
                                    updateForm({data_source: flowId ? {...form.data_source, flow_id: flowId} : undefined})
                                }
                            />
                            {form.data_source?.flow_id && (
                                <button
                                    type="button"
                                    className="fb-datasource-clear"
                                    onClick={() => updateForm({data_source: undefined})}
                                >
                                    <Icon name="xmark" /> Remove data flow
                                </button>
                            )}
                        </div>
                    )}
                </div>
                <div className="fb-field-row fb-collapsible">
                    <button
                        type="button"
                        className="fb-collapsible-header"
                        onClick={() => setAfterSubmitOpen(o => !o)}
                        aria-expanded={afterSubmitOpen}
                    >
                        <Icon name={afterSubmitOpen ? "chevron-down" : "chevron-right"} />
                        <span className="fb-collapsible-title">After submission</span>
                        {form.submit?.on_submit && form.submit.on_submit !== "message" && (
                            <span className="fb-collapsible-badge">{form.submit.on_submit}</span>
                        )}
                    </button>
                    {afterSubmitOpen && (
                        <div className="fb-datasource">
                            <span className="fb-datasource-desc">
                                What the visitor sees after they submit — a thank-you message, a
                                reset for another response (kiosk), or a redirect.
                            </span>
                            <div className="fb-field-group fb-full-width">
                                <span className="fb-field-group-label">Submit button text</span>
                                <input
                                    className="fb-input fb-input-sm"
                                    value={form.submit?.submit_label || ""}
                                    placeholder="Submit"
                                    onChange={e => updateForm({submit: {...form.submit, submit_label: e.target.value || undefined}})}
                                />
                            </div>
                            <div className="fb-field-group fb-full-width">
                                <span className="fb-field-group-label">On submit</span>
                                <select
                                    className="fb-input fb-input-sm"
                                    value={form.submit?.on_submit || "message"}
                                    onChange={e => updateForm({submit: {...form.submit, on_submit: e.target.value as "message" | "restart" | "redirect"}})}
                                >
                                    <option value="message">Show a thank-you message</option>
                                    <option value="restart">Reset for another response</option>
                                    <option value="redirect">Redirect to a URL</option>
                                </select>
                            </div>
                            {(form.submit?.on_submit || "message") !== "redirect" && (
                                <div className="fb-field-group fb-full-width">
                                    <span className="fb-field-group-label">Thank-you message</span>
                                    <textarea
                                        className="fb-input fb-input-sm"
                                        rows={2}
                                        value={form.submit?.success_message || ""}
                                        placeholder="Your response has been submitted successfully."
                                        onChange={e => updateForm({submit: {...form.submit, success_message: e.target.value}})}
                                    />
                                </div>
                            )}
                            {form.submit?.on_submit === "redirect" && (
                                <>
                                    <div className="fb-field-group fb-full-width">
                                        <span className="fb-field-group-label">Redirect URL</span>
                                        <input
                                            className="fb-input fb-input-sm"
                                            value={form.submit?.redirect_url || ""}
                                            placeholder="https://example.com/thanks"
                                            onChange={e => updateForm({submit: {...form.submit, redirect_url: e.target.value}})}
                                        />
                                    </div>
                                    <div className="fb-field-group">
                                        <span className="fb-field-group-label">Delay (seconds)</span>
                                        <input
                                            className="fb-input fb-input-sm"
                                            type="number"
                                            min={0}
                                            max={30}
                                            value={form.submit?.redirect_delay_seconds ?? ""}
                                            placeholder="0"
                                            onChange={e => {
                                                const v = e.target.value === "" ? undefined : Number(e.target.value);
                                                updateForm({submit: {...form.submit, redirect_delay_seconds: v}});
                                            }}
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {form.pages.map((page, pageIndex) => (
                <div key={pageIndex} className="fb-page">
                    <div className="fb-page-header">
                        <span className="fb-page-title">
                            <Icon name="file-lines" /> Page {pageIndex + 1}
                        </span>
                        <div className="fb-page-actions">
                            {form.pages.length > 1 && (
                                <>
                                    <button className="fb-icon-btn" onClick={() => movePage(pageIndex, -1)} disabled={pageIndex === 0}>
                                        <Icon name="chevron-up" />
                                    </button>
                                    <button className="fb-icon-btn" onClick={() => movePage(pageIndex, 1)} disabled={pageIndex === form.pages.length - 1}>
                                        <Icon name="chevron-down" />
                                    </button>
                                    <button className="fb-icon-btn fb-danger" onClick={() => removePage(pageIndex)}>
                                        <Icon name="trash" />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {pageIndex > 0 && (
                        <div className="fb-page-visibility">
                            <VisibilityEditor
                                scope="page"
                                rule={page.visible_if}
                                sources={sourceFieldsForPage(pageIndex)}
                                onChange={r => updatePage(pageIndex, {visible_if: r})}
                            />
                        </div>
                    )}

                    {page.components.map((comp, fieldIndex) => (
                        <div key={fieldIndex} className="fb-component">
                            <div className="fb-component-card">
                                <div className="fb-component-top">
                                    <div className="fb-component-top-left">
                                        <Icon name="grip-vertical" className="fb-grip" />
                                        <span className="fb-field-badge">
                                            <Icon name={fieldTypes.find(ft => ft.value === comp.type)?.icon || "font"} />
                                            {fieldTypes.find(ft => ft.value === comp.type)?.label || comp.type}
                                        </span>
                                    </div>
                                    <div className="fb-component-actions">
                                        <button className="fb-icon-btn" onClick={() => moveField(pageIndex, fieldIndex, -1)} disabled={fieldIndex === 0}>
                                            <Icon name="chevron-up" />
                                        </button>
                                        <button className="fb-icon-btn" onClick={() => moveField(pageIndex, fieldIndex, 1)} disabled={fieldIndex === page.components.length - 1}>
                                            <Icon name="chevron-down" />
                                        </button>
                                        <button className="fb-icon-btn fb-danger" onClick={() => removeField(pageIndex, fieldIndex)}>
                                            <Icon name="trash" />
                                        </button>
                                    </div>
                                </div>
                                <div className="fb-component-grid">
                                    <div className="fb-field-group">
                                        <span className="fb-field-group-label">Label</span>
                                        <VariableInput
                                            nodeId={`${props.nodeId}-${pageIndex}-${fieldIndex}-label`}
                                            name={`label-${comp.name}`}
                                            placeholder="Display label"
                                            label="Label"
                                            value={comp.label}
                                            variables={props.variables || []}
                                            onValueChange={(_, v) => {
                                                // Auto-track: if the identifier still looks
                                                // like it was derived from the label (either
                                                // the initial "field_N" or the previous
                                                // slug), regenerate it from the new label.
                                                // Once the user hand-edits the identifier
                                                // off the slug, we stop auto-syncing so
                                                // renames don't clobber their choice.
                                                const patch: Partial<FormComponent> = {label: v};
                                                if (identifierTracksLabel(comp.name, comp.label)) {
                                                    const nextSlug = slugifyOptionValue(v);
                                                    if (nextSlug) patch.name = nextSlug;
                                                }
                                                updateField(pageIndex, fieldIndex, patch);
                                            }}
                                        />
                                    </div>
                                    <div className="fb-field-group">
                                        <span className="fb-field-group-label">Identifier</span>
                                        <input
                                            className="fb-input fb-input-sm"
                                            value={comp.name}
                                            placeholder="field_name"
                                            onChange={e => updateField(pageIndex, fieldIndex, {name: e.target.value})}
                                        />
                                    </div>
                                    {!DISPLAY_ONLY_TYPES.has(comp.type) && !STRUCTURED_TYPES.has(comp.type) && !UPLOAD_TYPES.has(comp.type) && comp.type !== "consent" && comp.type !== "nps" && comp.type !== "picture_choice" && comp.type !== "payment" && !comp.value_source && (
                                        <>
                                            <div className="fb-field-group fb-full-width">
                                                <span className="fb-field-group-label">Placeholder</span>
                                                <VariableInput
                                                    nodeId={`${props.nodeId}-${pageIndex}-${fieldIndex}-placeholder`}
                                                    name={`placeholder-${comp.name}`}
                                                    placeholder="Hint text shown to user"
                                                    label="Placeholder"
                                                    value={comp.placeholder}
                                                    variables={props.variables || []}
                                                    onValueChange={(_, v) => updateField(pageIndex, fieldIndex, {placeholder: v})}
                                                />
                                            </div>
                                            <div className="fb-field-group fb-full-width">
                                                <span className="fb-field-group-label">Default Value</span>
                                                <VariableInput
                                                    nodeId={`${props.nodeId}-${pageIndex}-${fieldIndex}-default`}
                                                    name={`default-${comp.name}`}
                                                    placeholder="Static text or ${user.first_name}, ${query.ref}, ${data.customer_name}, etc."
                                                    label="Default Value"
                                                    value={comp.default_value || ""}
                                                    variables={props.variables || []}
                                                    onValueChange={(_, v) => updateField(pageIndex, fieldIndex, {default_value: v})}
                                                />
                                            </div>
                                        </>
                                    )}
                                    {supportsComputedValue(comp.type) && (() => {
                                        const key = `${pageIndex}-${fieldIndex}`;
                                        const open = !!computedOpen[key];
                                        return (
                                        <div className={`fb-field-group fb-full-width fb-computed-source${open ? " fb-computed-source--open" : ""}`}>
                                            <button
                                                type="button"
                                                className="fb-computed-header"
                                                aria-expanded={open}
                                                onClick={() => toggleComputed(key)}
                                            >
                                                <Icon name={open ? "chevron-down" : "chevron-right"} />
                                                <span className="fb-computed-header-label">Computed by a flow</span>
                                                {comp.value_source && (
                                                    <span className="fb-computed-badge">
                                                        <Icon name="bolt" /> Active
                                                    </span>
                                                )}
                                            </button>
                                            {open && (
                                            <div className="fb-computed-body">
                                                <span className="fb-field-hint">
                                                    Fill this field's value by running a flow with the current
                                                    answers as <code>{"${input.X}"}</code>. The field becomes
                                                    read-only; the value is authoritative server-side.
                                                </span>
                                                <FlowSelectProperty
                                                    nodeId={`${props.nodeId}-${pageIndex}-${fieldIndex}-value-source`}
                                                    name={`value-source-${comp.name}`}
                                                    label="Value flow"
                                                    value={comp.value_source || ""}
                                                    onValueChange={(_, flowId) => updateField(pageIndex, fieldIndex, {value_source: flowId || undefined})}
                                                />
                                                {comp.value_source && (() => {
                                                    const outs = flowOutputs[comp.value_source] || [];
                                                    return (
                                                    <>
                                                        <div className="property-menu-input-row">
                                                            <div className="property-menu-input-name">Value output</div>
                                                            <OutputSelect
                                                                value={comp.value_output || ""}
                                                                options={outs}
                                                                onChange={(v) => updateField(pageIndex, fieldIndex, {value_output: v || undefined})}
                                                            />
                                                        </div>
                                                        {outs.length > 0 && (
                                                            <span className="fb-field-hint">
                                                                Available outputs: {outs.join(", ")}
                                                            </span>
                                                        )}
                                                        <button
                                                            type="button"
                                                            className="fb-datasource-clear"
                                                            onClick={() => updateField(pageIndex, fieldIndex, {value_source: undefined, value_output: undefined})}
                                                        >
                                                            <Icon name="xmark" /> Remove value flow
                                                        </button>
                                                    </>
                                                    );
                                                })()}
                                            </div>
                                            )}
                                        </div>
                                        );
                                    })()}
                                    {comp.type === "location" && (
                                        <div className="fb-field-group fb-full-width">
                                            <span className="fb-field-group-label">Precision</span>
                                            <select
                                                className="fb-input fb-input-sm"
                                                value={comp.precision || "fine"}
                                                onChange={e => updateField(pageIndex, fieldIndex, {precision: e.target.value as "coarse" | "fine"})}
                                            >
                                                <option value="fine">Fine (raw device precision)</option>
                                                <option value="coarse">Coarse (~110 m, 3 decimals)</option>
                                            </select>
                                        </div>
                                    )}
                                    {comp.type === "address" && (
                                        <div className="fb-field-group fb-full-width">
                                            <span className="fb-field-group-label">Sub-fields</span>
                                            <div className="fb-address-preview">
                                                <span>Line 1 · Line 2 · City · Postcode · Country</span>
                                                <small>Available downstream as <code>{"${trigger." + comp.name + ".line1}"}</code>, <code>{".postcode}"}</code>, etc.</small>
                                            </div>
                                        </div>
                                    )}
                                    {comp.type === "esignature" && (
                                        <div className="fb-field-group fb-full-width">
                                            <span className="fb-field-group-label">Upload constraints</span>
                                            <div className="fb-address-preview">
                                                <span>Canvas → PNG · Max 10 MB (locked)</span>
                                                <small>Response: <code>flo:blob:...</code> token; downstream actions consume as bytes via the blob store.</small>
                                            </div>
                                        </div>
                                    )}
                                    {(comp.type === "camera" || comp.type === "file_upload") && (
                                        <>
                                            <div className="fb-field-group fb-full-width">
                                                <span className="fb-field-group-label">Accepted MIME types</span>
                                                <input
                                                    className="fb-input fb-input-sm"
                                                    value={comp.accept_mime || ""}
                                                    placeholder={comp.type === "camera" ? "image/*" : "e.g. image/*,application/pdf"}
                                                    onChange={e => updateField(pageIndex, fieldIndex, {accept_mime: e.target.value})}
                                                />
                                            </div>
                                            <div className="fb-field-group">
                                                <span className="fb-field-group-label">Max size (MB)</span>
                                                <input
                                                    className="fb-input fb-input-sm"
                                                    type="number"
                                                    min={1}
                                                    max={25}
                                                    value={comp.max_size_bytes ? Math.round(comp.max_size_bytes / (1024 * 1024)) : ""}
                                                    placeholder="10"
                                                    onChange={e => {
                                                        const mb = e.target.value === "" ? undefined : Number(e.target.value);
                                                        updateField(pageIndex, fieldIndex, {max_size_bytes: mb ? mb * 1024 * 1024 : undefined});
                                                    }}
                                                />
                                            </div>
                                            {comp.type === "camera" && (
                                                <div className="fb-field-group">
                                                    <label className="fb-toggle-label">
                                                        <input
                                                            type="checkbox"
                                                            checked={comp.allow_gallery || false}
                                                            onChange={e => updateField(pageIndex, fieldIndex, {allow_gallery: e.target.checked})}
                                                        />
                                                        Allow gallery
                                                    </label>
                                                </div>
                                            )}
                                        </>
                                    )}
                                    {comp.type === "license_plate" && (
                                        <>
                                            <div className="fb-field-group fb-full-width">
                                                <span className="fb-field-group-label">Recognition</span>
                                                <div className="fb-address-preview">
                                                    <span>Camera frame → in-browser plate read</span>
                                                    <small>Response: <code>{"${trigger." + comp.name + ".plate}"}</code> plus <code>.image</code> (blob) and <code>.confidence</code>. Recognition runs in the browser; only forms using this field load the model.</small>
                                                </div>
                                            </div>
                                            <div className="fb-field-group fb-full-width">
                                                <span className="fb-field-group-label">Capture mode</span>
                                                <select
                                                    className="fb-input fb-input-sm"
                                                    value={comp.capture_mode || "manual"}
                                                    onChange={e => updateField(pageIndex, fieldIndex, {capture_mode: e.target.value as "manual" | "auto"})}
                                                >
                                                    <option value="manual">Manual — tap to capture</option>
                                                    <option value="auto">Auto — hands-off (e.g. car-park entry)</option>
                                                </select>
                                            </div>
                                            {comp.capture_mode === "auto" && (
                                                <>
                                                    <div className="fb-field-group fb-full-width">
                                                        <label className="fb-toggle-label">
                                                            <input
                                                                type="checkbox"
                                                                checked={comp.auto_submit || false}
                                                                onChange={e => updateField(pageIndex, fieldIndex, {auto_submit: e.target.checked})}
                                                            />
                                                            Submit the form automatically on a confident read
                                                        </label>
                                                    </div>
                                                    <div className="fb-field-group">
                                                        <span className="fb-field-group-label">Min confidence</span>
                                                        <input
                                                            className="fb-input fb-input-sm"
                                                            type="number"
                                                            min={0}
                                                            max={1}
                                                            step={0.05}
                                                            value={comp.confidence_threshold ?? ""}
                                                            placeholder="0.6"
                                                            onChange={e => {
                                                                const v = e.target.value === "" ? undefined : Number(e.target.value);
                                                                updateField(pageIndex, fieldIndex, {confidence_threshold: v});
                                                            }}
                                                        />
                                                    </div>
                                                </>
                                            )}
                                            <div className="fb-field-group fb-full-width">
                                                <label className="fb-toggle-label">
                                                    <input
                                                        type="checkbox"
                                                        checked={comp.show_privacy_notice !== false}
                                                        onChange={e => updateField(pageIndex, fieldIndex, {show_privacy_notice: e.target.checked})}
                                                    />
                                                    Show a privacy notice on the form
                                                </label>
                                            </div>
                                            {comp.show_privacy_notice !== false && (
                                                <div className="fb-field-group fb-full-width">
                                                    <span className="fb-field-group-label">Privacy notice</span>
                                                    <textarea
                                                        className="fb-input fb-input-sm"
                                                        rows={2}
                                                        value={comp.privacy_notice || ""}
                                                        placeholder="This field uses your camera to read a licence plate…"
                                                        onChange={e => updateField(pageIndex, fieldIndex, {privacy_notice: e.target.value})}
                                                    />
                                                </div>
                                            )}
                                        </>
                                    )}
                                    {comp.type === "info_text" && (
                                        <div className="fb-field-group fb-full-width">
                                            <span className="fb-field-group-label">Display Text</span>
                                            <VariableInput
                                                nodeId={`${props.nodeId}-${pageIndex}-${fieldIndex}-display-text`}
                                                name={`display-text-${comp.name}`}
                                                placeholder="Paragraph text shown to the user"
                                                label="Display Text"
                                                value={comp.display_text || ""}
                                                variables={props.variables || []}
                                                onValueChange={(_, v) => updateField(pageIndex, fieldIndex, {display_text: v})}
                                            />
                                        </div>
                                    )}
                                    {comp.type === "payment" && (
                                        <>
                                            {!comp.value_source && (
                                                <div className="fb-field-group fb-full-width">
                                                    <span className="fb-field-group-label">Amount</span>
                                                    <VariableInput
                                                        nodeId={`${props.nodeId}-${pageIndex}-${fieldIndex}-amount`}
                                                        name={`amount-${comp.name}`}
                                                        placeholder="49.99"
                                                        label="Amount"
                                                        value={comp.amount || ""}
                                                        variables={props.variables || []}
                                                        onValueChange={(_, v) => updateField(pageIndex, fieldIndex, {amount: v})}
                                                    />
                                                    <span className="fb-field-hint">Major units, e.g. 49.99. Supports ${"{"}data.X{"}"} references (resolved at checkout).</span>
                                                </div>
                                            )}
                                            <div className="fb-field-group fb-full-width fb-computed-source">
                                                <span className="fb-field-group-label">Amount from a flow</span>
                                                <span className="fb-field-hint">
                                                    Compute the charge by running a flow with the form
                                                    answers as <code>{"${input.X}"}</code> (e.g. a reg-plate
                                                    to a car-park price). Takes precedence over the manual
                                                    amount and is resolved server-side at checkout.
                                                </span>
                                                <FlowSelectProperty
                                                    nodeId={`${props.nodeId}-${pageIndex}-${fieldIndex}-value-source`}
                                                    name={`value-source-${comp.name}`}
                                                    label="Amount flow"
                                                    value={comp.value_source || ""}
                                                    onValueChange={(_, flowId) => updateField(pageIndex, fieldIndex, {value_source: flowId || undefined})}
                                                />
                                                {comp.value_source && (
                                                    <>
                                                        <input
                                                            className="fb-input fb-input-sm"
                                                            value={comp.value_output || ""}
                                                            placeholder="Flow output holding the amount; defaults to the field name"
                                                            onChange={e => updateField(pageIndex, fieldIndex, {value_output: e.target.value || undefined})}
                                                        />
                                                        <button
                                                            type="button"
                                                            className="fb-datasource-clear"
                                                            onClick={() => updateField(pageIndex, fieldIndex, {value_source: undefined, value_output: undefined})}
                                                        >
                                                            <Icon name="xmark" /> Remove amount flow
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                            <div className="fb-field-group fb-full-width">
                                                <span className="fb-field-group-label">Currency</span>
                                                <select
                                                    className="fb-input fb-input-sm"
                                                    value={comp.currency || "gbp"}
                                                    onChange={e => updateField(pageIndex, fieldIndex, {currency: e.target.value})}
                                                >
                                                    <option value="gbp">GBP (£)</option>
                                                    <option value="usd">USD ($)</option>
                                                    <option value="eur">EUR (€)</option>
                                                    <option value="aud">AUD ($)</option>
                                                    <option value="cad">CAD ($)</option>
                                                    <option value="jpy">JPY (¥)</option>
                                                    <option value="chf">CHF</option>
                                                    <option value="nzd">NZD ($)</option>
                                                    <option value="sek">SEK</option>
                                                    <option value="nok">NOK</option>
                                                    <option value="dkk">DKK</option>
                                                </select>
                                            </div>
                                            <div className="fb-field-group fb-full-width">
                                                <span className="fb-field-group-label">Stripe Secret Key</span>
                                                <VariableInput
                                                    nodeId={`${props.nodeId}-${pageIndex}-${fieldIndex}-payment-secret`}
                                                    name={`payment-secret-${comp.name}`}
                                                    placeholder="${secrets.stripe_secret_key}"
                                                    label="Stripe Secret Key"
                                                    value={comp.payment_secret ?? "${secrets.stripe_secret_key}"}
                                                    variables={props.variables || []}
                                                    onValueChange={(_, v) => updateField(pageIndex, fieldIndex, {payment_secret: v})}
                                                />
                                                <span className="fb-field-hint">A ${"{"}secrets.X{"}"} reference — resolved server-side, never exposed to the browser.</span>
                                            </div>
                                        </>
                                    )}
                                    {(comp.type === "number" || comp.type === "slider") && (
                                        <>
                                            <div className="fb-field-group">
                                                <span className="fb-field-group-label">Min</span>
                                                <input
                                                    className="fb-input fb-input-sm"
                                                    type="number"
                                                    value={comp.min ?? ""}
                                                    placeholder="No minimum"
                                                    onChange={e => updateField(pageIndex, fieldIndex, {min: e.target.value === "" ? undefined : Number(e.target.value)})}
                                                />
                                            </div>
                                            <div className="fb-field-group">
                                                <span className="fb-field-group-label">Max</span>
                                                <input
                                                    className="fb-input fb-input-sm"
                                                    type="number"
                                                    value={comp.max ?? ""}
                                                    placeholder="No maximum"
                                                    onChange={e => updateField(pageIndex, fieldIndex, {max: e.target.value === "" ? undefined : Number(e.target.value)})}
                                                />
                                            </div>
                                            <div className="fb-field-group">
                                                <span className="fb-field-group-label">Step</span>
                                                <input
                                                    className="fb-input fb-input-sm"
                                                    type="number"
                                                    value={comp.step ?? ""}
                                                    placeholder="Any"
                                                    onChange={e => updateField(pageIndex, fieldIndex, {step: e.target.value === "" ? undefined : Number(e.target.value)})}
                                                />
                                            </div>
                                            {comp.type === "number" && (
                                                <div className="fb-field-group">
                                                    <label className="fb-toggle-label">
                                                        <input
                                                            type="checkbox"
                                                            checked={comp.integer_only || false}
                                                            onChange={e => updateField(pageIndex, fieldIndex, {integer_only: e.target.checked})}
                                                        />
                                                        Integer only
                                                    </label>
                                                </div>
                                            )}
                                        </>
                                    )}
                                    {comp.type === "rating" && (
                                        <div className="fb-field-group fb-full-width">
                                            <span className="fb-field-group-label">Scale</span>
                                            <select
                                                className="fb-input fb-input-sm"
                                                value={comp.scale || 5}
                                                onChange={e => updateField(pageIndex, fieldIndex, {scale: Number(e.target.value)})}
                                            >
                                                <option value={3}>1 – 3</option>
                                                <option value={5}>1 – 5</option>
                                                <option value={7}>1 – 7</option>
                                                <option value={10}>1 – 10</option>
                                            </select>
                                        </div>
                                    )}
                                    {comp.type === "matrix" && (
                                        <>
                                            <div className="fb-field-group fb-full-width">
                                                <span className="fb-field-group-label">Cell type</span>
                                                <select
                                                    className="fb-input fb-input-sm"
                                                    value={comp.cell_type || "radio"}
                                                    onChange={e => updateField(pageIndex, fieldIndex, {cell_type: e.target.value as "radio" | "checkbox"})}
                                                >
                                                    <option value="radio">Single choice per row</option>
                                                    <option value="checkbox">Multiple choices per row</option>
                                                </select>
                                            </div>
                                            {(["matrix_rows", "matrix_columns"] as const).map(listKey => {
                                                const items = comp[listKey] || [];
                                                const heading = listKey === "matrix_rows" ? "Rows" : "Columns";
                                                return (
                                                    <div key={listKey} className="fb-field-group fb-full-width fb-options-editor">
                                                        <span className="fb-field-group-label">{heading}</span>
                                                        {items.map((item, itemIndex) => {
                                                            const valueTracksLabel = item.value === "" || item.value === slugifyOptionValue(item.label);
                                                            return (
                                                                <div key={itemIndex} className="fb-option-row">
                                                                    <input
                                                                        className="fb-input fb-input-sm fb-option-label-input"
                                                                        value={item.label}
                                                                        placeholder={`${listKey === "matrix_rows" ? "Row" : "Column"} label`}
                                                                        onChange={e => {
                                                                            const newLabel = e.target.value;
                                                                            const nextValue = valueTracksLabel ? slugifyOptionValue(newLabel) : item.value;
                                                                            updateListItem(pageIndex, fieldIndex, listKey, itemIndex, {label: newLabel, value: nextValue});
                                                                        }}
                                                                    />
                                                                    <input
                                                                        className="fb-input fb-input-sm fb-option-value-input"
                                                                        value={item.value}
                                                                        placeholder="value"
                                                                        onChange={e => updateListItem(pageIndex, fieldIndex, listKey, itemIndex, {value: e.target.value})}
                                                                    />
                                                                    <div className="fb-option-actions">
                                                                        <button
                                                                            className="fb-icon-btn"
                                                                            onClick={() => moveListItem(pageIndex, fieldIndex, listKey, itemIndex, -1)}
                                                                            disabled={itemIndex === 0}
                                                                            title="Move up"
                                                                        >
                                                                            <Icon name="chevron-up" />
                                                                        </button>
                                                                        <button
                                                                            className="fb-icon-btn"
                                                                            onClick={() => moveListItem(pageIndex, fieldIndex, listKey, itemIndex, 1)}
                                                                            disabled={itemIndex === items.length - 1}
                                                                            title="Move down"
                                                                        >
                                                                            <Icon name="chevron-down" />
                                                                        </button>
                                                                        <button
                                                                            className="fb-icon-btn fb-danger"
                                                                            onClick={() => removeListItem(pageIndex, fieldIndex, listKey, itemIndex)}
                                                                            disabled={items.length <= 1}
                                                                            title={`Remove ${listKey === "matrix_rows" ? "row" : "column"}`}
                                                                        >
                                                                            <Icon name="trash" />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                        <button
                                                            className="fb-add-option"
                                                            onClick={() => addListItem(pageIndex, fieldIndex, listKey)}
                                                        >
                                                            <Icon name="plus" /> Add {listKey === "matrix_rows" ? "Row" : "Column"}
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </>
                                    )}
                                    {comp.type === "picture_choice" && (
                                        <>
                                            <div className="fb-field-group fb-full-width">
                                                <label className="fb-toggle-label">
                                                    <input
                                                        type="checkbox"
                                                        checked={comp.multiple || false}
                                                        onChange={e => updateField(pageIndex, fieldIndex, {multiple: e.target.checked})}
                                                    />
                                                    Multiple selection
                                                </label>
                                            </div>
                                            <div className="fb-field-group fb-full-width fb-options-editor">
                                                <span className="fb-field-group-label">Picture options</span>
                                                {(comp.options || []).map((opt, optionIndex) => {
                                                    const valueTracksLabel = opt.value === "" || opt.value === slugifyOptionValue(opt.label);
                                                    return (
                                                        <div key={optionIndex} className="fb-picture-option">
                                                            <div className="fb-option-row">
                                                                <input
                                                                    className="fb-input fb-input-sm fb-option-label-input"
                                                                    value={opt.label}
                                                                    placeholder="Option label"
                                                                    onChange={e => {
                                                                        const newLabel = e.target.value;
                                                                        const nextValue = valueTracksLabel ? slugifyOptionValue(newLabel) : opt.value;
                                                                        updateOption(pageIndex, fieldIndex, optionIndex, {label: newLabel, value: nextValue});
                                                                    }}
                                                                />
                                                                <input
                                                                    className="fb-input fb-input-sm fb-option-value-input"
                                                                    value={opt.value}
                                                                    placeholder="option_value"
                                                                    onChange={e => updateOption(pageIndex, fieldIndex, optionIndex, {value: e.target.value})}
                                                                />
                                                                <div className="fb-option-actions">
                                                                    <button
                                                                        className="fb-icon-btn"
                                                                        onClick={() => moveOption(pageIndex, fieldIndex, optionIndex, -1)}
                                                                        disabled={optionIndex === 0}
                                                                        title="Move up"
                                                                    >
                                                                        <Icon name="chevron-up" />
                                                                    </button>
                                                                    <button
                                                                        className="fb-icon-btn"
                                                                        onClick={() => moveOption(pageIndex, fieldIndex, optionIndex, 1)}
                                                                        disabled={optionIndex === (comp.options?.length || 0) - 1}
                                                                        title="Move down"
                                                                    >
                                                                        <Icon name="chevron-down" />
                                                                    </button>
                                                                    <button
                                                                        className="fb-icon-btn fb-danger"
                                                                        onClick={() => removeOption(pageIndex, fieldIndex, optionIndex)}
                                                                        disabled={(comp.options?.length || 0) <= 1}
                                                                        title="Remove option"
                                                                    >
                                                                        <Icon name="trash" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            <input
                                                                className="fb-input fb-input-sm fb-picture-image-input"
                                                                value={opt.image || ""}
                                                                placeholder="Image URL, e.g. https://example.com/photo.jpg"
                                                                onChange={e => updateOption(pageIndex, fieldIndex, optionIndex, {image: e.target.value})}
                                                            />
                                                        </div>
                                                    );
                                                })}
                                                <button
                                                    className="fb-add-option"
                                                    onClick={() => addOption(pageIndex, fieldIndex)}
                                                >
                                                    <Icon name="plus" /> Add Option
                                                </button>
                                            </div>
                                        </>
                                    )}
                                    {comp.type === "nps" && (
                                        <>
                                            <div className="fb-field-group fb-full-width">
                                                <span className="fb-field-group-label">Scale</span>
                                                <select
                                                    className="fb-input fb-input-sm"
                                                    value={comp.scale || 10}
                                                    onChange={e => updateField(pageIndex, fieldIndex, {scale: Number(e.target.value)})}
                                                >
                                                    <option value={5}>0 – 5</option>
                                                    <option value={10}>0 – 10</option>
                                                </select>
                                            </div>
                                            <div className="fb-field-group">
                                                <span className="fb-field-group-label">Low label</span>
                                                <input
                                                    className="fb-input fb-input-sm"
                                                    value={comp.scale_label_low || ""}
                                                    placeholder="Not likely"
                                                    onChange={e => updateField(pageIndex, fieldIndex, {scale_label_low: e.target.value})}
                                                />
                                            </div>
                                            <div className="fb-field-group">
                                                <span className="fb-field-group-label">High label</span>
                                                <input
                                                    className="fb-input fb-input-sm"
                                                    value={comp.scale_label_high || ""}
                                                    placeholder="Very likely"
                                                    onChange={e => updateField(pageIndex, fieldIndex, {scale_label_high: e.target.value})}
                                                />
                                            </div>
                                        </>
                                    )}
                                    {comp.type === "consent" && (
                                        <div className="fb-field-group fb-full-width">
                                            <span className="fb-field-group-label">Terms / Legal text</span>
                                            <textarea
                                                className="fb-input fb-input-sm"
                                                rows={3}
                                                value={comp.display_text || ""}
                                                placeholder="Please read and accept our terms."
                                                onChange={e => updateField(pageIndex, fieldIndex, {display_text: e.target.value})}
                                            />
                                        </div>
                                    )}
                                    {comp.type === "contact_name" && (
                                        <div className="fb-field-group fb-full-width">
                                            <span className="fb-field-group-label">Sub-fields</span>
                                            <div className="fb-address-preview">
                                                <span>First name · Last name · Email</span>
                                                <small>Available downstream as <code>{"${trigger." + comp.name + ".first_name}"}</code>, <code>{".email}"}</code>, etc.</small>
                                            </div>
                                        </div>
                                    )}
                                    {DATE_TIME_TYPES.has(comp.type) && (
                                        <>
                                            <div className="fb-field-group">
                                                <span className="fb-field-group-label">Min {comp.type === "time" ? "Time" : "Date"}</span>
                                                <input
                                                    className="fb-input fb-input-sm"
                                                    type={comp.type === "datetime" ? "datetime-local" : comp.type}
                                                    value={comp.min_date || ""}
                                                    onChange={e => updateField(pageIndex, fieldIndex, {min_date: e.target.value})}
                                                />
                                            </div>
                                            <div className="fb-field-group">
                                                <span className="fb-field-group-label">Max {comp.type === "time" ? "Time" : "Date"}</span>
                                                <input
                                                    className="fb-input fb-input-sm"
                                                    type={comp.type === "datetime" ? "datetime-local" : comp.type}
                                                    value={comp.max_date || ""}
                                                    onChange={e => updateField(pageIndex, fieldIndex, {max_date: e.target.value})}
                                                />
                                            </div>
                                        </>
                                    )}
                                    {OPTION_BASED_TYPES.has(comp.type) && (
                                        <div className="fb-field-group fb-full-width fb-options-editor">
                                            <span className="fb-field-group-label">Options</span>
                                            {form.data_source?.flow_id && (
                                                <div className="fb-options-source">
                                                    <label className="fb-field-group-label">Populate from flow output</label>
                                                    <input
                                                        className="fb-input fb-input-sm"
                                                        value={comp.options_source || ""}
                                                        placeholder="Output key, e.g. countries — leave blank for the fixed list below"
                                                        onChange={e => updateField(pageIndex, fieldIndex, {options_source: e.target.value || undefined})}
                                                    />
                                                    <span className="fb-options-source-hint">
                                                        The data flow output must be a list of strings or
                                                        <code>{" {label, value} "}</code>objects. Options load in the
                                                        browser after the form appears; the fixed list below is used if
                                                        this is blank.
                                                    </span>
                                                </div>
                                            )}
                                            {(comp.options || []).map((opt, optionIndex) => {
                                                // Auto-track slug when value hasn't been hand-edited off the current
                                                // slug. Empty value also tracks (typical during rapid label typing).
                                                const valueTracksLabel = opt.value === "" || opt.value === slugifyOptionValue(opt.label);
                                                return (
                                                    <div key={optionIndex} className="fb-option-row">
                                                        <input
                                                            className="fb-input fb-input-sm fb-option-label-input"
                                                            value={opt.label}
                                                            placeholder="Option label"
                                                            onChange={e => {
                                                                const newLabel = e.target.value;
                                                                const nextValue = valueTracksLabel ? slugifyOptionValue(newLabel) : opt.value;
                                                                updateOption(pageIndex, fieldIndex, optionIndex, {label: newLabel, value: nextValue});
                                                            }}
                                                        />
                                                        <input
                                                            className="fb-input fb-input-sm fb-option-value-input"
                                                            value={opt.value}
                                                            placeholder="option_value"
                                                            onChange={e => updateOption(pageIndex, fieldIndex, optionIndex, {value: e.target.value})}
                                                        />
                                                        <div className="fb-option-actions">
                                                            <button
                                                                className="fb-icon-btn"
                                                                onClick={() => moveOption(pageIndex, fieldIndex, optionIndex, -1)}
                                                                disabled={optionIndex === 0}
                                                                title="Move up"
                                                            >
                                                                <Icon name="chevron-up" />
                                                            </button>
                                                            <button
                                                                className="fb-icon-btn"
                                                                onClick={() => moveOption(pageIndex, fieldIndex, optionIndex, 1)}
                                                                disabled={optionIndex === (comp.options?.length || 0) - 1}
                                                                title="Move down"
                                                            >
                                                                <Icon name="chevron-down" />
                                                            </button>
                                                            <button
                                                                className="fb-icon-btn fb-danger"
                                                                onClick={() => removeOption(pageIndex, fieldIndex, optionIndex)}
                                                                disabled={(comp.options?.length || 0) <= 1}
                                                                title="Remove option"
                                                            >
                                                                <Icon name="trash" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            <button
                                                className="fb-add-option"
                                                onClick={() => addOption(pageIndex, fieldIndex)}
                                            >
                                                <Icon name="plus" /> Add Option
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <VisibilityEditor
                                    scope="question"
                                    rule={comp.visible_if}
                                    sources={sourceFieldsForComponent(pageIndex, fieldIndex)}
                                    onChange={r => updateField(pageIndex, fieldIndex, {visible_if: r})}
                                />
                                <div className="fb-component-footer">
                                    {!DISPLAY_ONLY_TYPES.has(comp.type) && comp.type !== "payment" ? (
                                        <>
                                            <label className="fb-toggle-label">
                                                <input
                                                    type="checkbox"
                                                    checked={comp.required}
                                                    onChange={e => updateField(pageIndex, fieldIndex, {required: e.target.checked})}
                                                />
                                                Required
                                            </label>
                                            {!STRUCTURED_TYPES.has(comp.type) && !UPLOAD_TYPES.has(comp.type) && (
                                                <label className="fb-toggle-label">
                                                    <input
                                                        type="checkbox"
                                                        checked={comp.read_only || false}
                                                        onChange={e => updateField(pageIndex, fieldIndex, {read_only: e.target.checked})}
                                                    />
                                                    Read-only
                                                </label>
                                            )}
                                            {supportsCopy(comp.type) && (
                                                <label className="fb-toggle-label" title="Show a Copy button at the end of this field so respondents can copy its value.">
                                                    <input
                                                        type="checkbox"
                                                        checked={comp.allow_copy || false}
                                                        onChange={e => updateField(pageIndex, fieldIndex, {allow_copy: e.target.checked})}
                                                    />
                                                    Copy button
                                                </label>
                                            )}
                                        </>
                                    ) : comp.type === "payment" ? (
                                        // Payment collects no input — Required/Read-only are
                                        // meaningless. Card capture happens on Stripe's hosted page.
                                        <span className="fb-field-name">payment field</span>
                                    ) : (
                                        // Display-only fields don't collect input so Required/Read-only
                                        // are meaningless. Just show the tag so authors can spot which
                                        // element they're editing.
                                        <span className="fb-field-name">display element</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}

                    {addingToPage === pageIndex ? (
                        <div className="fb-type-picker">
                            <span className="fb-type-picker-label">Choose field type</span>
                            <div className="fb-type-picker-grid">
                                {fieldTypes.map(ft => (
                                    <button
                                        key={ft.value}
                                        className="fb-type-picker-option"
                                        onClick={() => addField(pageIndex, ft.value)}
                                    >
                                        <Icon name={ft.icon} />
                                        <span>{ft.label}</span>
                                    </button>
                                ))}
                            </div>
                            <button className="fb-type-picker-cancel" onClick={() => setAddingToPage(null)}>
                                Cancel
                            </button>
                        </div>
                    ) : (
                        <button className="fb-add-field" onClick={() => setAddingToPage(pageIndex)}>
                            <Icon name="plus" /> Add Field
                        </button>
                    )}
                </div>
            ))}

            <button className="fb-add-page" onClick={addPage}>
                <Icon name="plus" /> Add Page
            </button>
        </div>
    );
};

export default FormBuilder;
