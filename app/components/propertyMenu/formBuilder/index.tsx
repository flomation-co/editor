import React, {useState, useEffect} from "react";
import "./index.css";
import { Icon } from "~/components/icons/Icon";
import VariableInput, {type VariableItem} from "~/components/propertyMenu/variableInput";

type FormOption = {
    label: string;
    value: string;
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
    // Present only on radio / checkboxes / dropdown fields.
    options?: FormOption[];
    // Numeric constraints — apply to number, slider, and rating types.
    min?: number;
    max?: number;
    step?: number;
    integer_only?: boolean;
    // Number of stars/points for rating fields (typically 5 or 10).
    scale?: number;
    // Bounds for date/time HTML5 inputs, as ISO strings.
    min_date?: string;
    max_date?: string;
    // Paragraph text used by info_text display-only components.
    display_text?: string;
    // Location precision — "coarse" rounds coordinates client-side to
    // ~110m; "fine" (or unset) uses raw device precision.
    precision?: "coarse" | "fine";
    // Upload-field constraints (esignature / camera / file_upload).
    accept_mime?: string;
    max_size_bytes?: number;
    allow_gallery?: boolean;
}

// Types whose response is constrained to a curated list. Adding a new
// option-based type here automatically pulls in the sub-editor UI and
// the seed-on-add behaviour. Ranking is included because its schema is
// identical to radio/checkboxes/dropdown — it's just the response
// shape that differs (ordered array vs single / unordered set).
const OPTION_BASED_TYPES = new Set(["radio", "checkboxes", "dropdown", "ranking"]);

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
// (precision selector for location, nothing for address).
const STRUCTURED_TYPES = new Set(["location", "address"]);

// Upload types capture a file and store its bytes in the blob store;
// the response is a flo:blob:... token string. Placeholder / default
// don't apply (the user picks a file rather than typing). Read-only
// works via disabling the picker.
const UPLOAD_TYPES = new Set(["esignature", "camera", "file_upload"]);

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
}

type FormDefinition = {
    title: string;
    description: string;
    pages: FormPage[];
    // Require Sentinel session cookie to view/submit. Enables ${user.X}
    // substitution at render time.
    require_login?: boolean;
}

type Props = {
    nodeId: string;
    value: string;
    variables?: VariableItem[];
    onChange: (value: string) => void;
}


const fieldTypes = [
    {value: "text", label: "Text", icon: "i-cursor"},
    {value: "multiline", label: "Multi-line", icon: "align-left"},
    {value: "number", label: "Number", icon: "hashtag"},
    {value: "boolean", label: "Checkbox", icon: "check"},
    {value: "radio", label: "Radio", icon: "circle-dot"},
    {value: "checkboxes", label: "Checkbox Group", icon: "list-check"},
    {value: "dropdown", label: "Dropdown", icon: "chevron-down"},
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
    {value: "ranking", label: "Ranking", icon: "list"},
];

const FormBuilder = (props: Props) => {
    const [addingToPage, setAddingToPage] = useState<number | null>(null);

    const [form, setForm] = useState<FormDefinition>(() => {
        try {
            const parsed = JSON.parse(props.value || "{}");
            return {
                title: parsed.title || "Untitled Form",
                description: parsed.description || "",
                pages: parsed.pages || [{components: []}],
                require_login: parsed.require_login || false,
            };
        } catch {
            return {title: "Untitled Form", description: "", pages: [{components: []}], require_login: false};
        }
    });

    useEffect(() => {
        props.onChange(JSON.stringify(form));
    }, [form]);

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
                        onValueChange={(_, v) => updateForm({description: v})}
                    />
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
                                    {!DISPLAY_ONLY_TYPES.has(comp.type) && !STRUCTURED_TYPES.has(comp.type) && !UPLOAD_TYPES.has(comp.type) && (
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
                                                    placeholder="Static text or ${user.first_name}, ${query.ref}, etc."
                                                    label="Default Value"
                                                    value={comp.default_value || ""}
                                                    variables={props.variables || []}
                                                    onValueChange={(_, v) => updateField(pageIndex, fieldIndex, {default_value: v})}
                                                />
                                            </div>
                                        </>
                                    )}
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
                                <div className="fb-component-footer">
                                    {!DISPLAY_ONLY_TYPES.has(comp.type) ? (
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
                                            <span className="fb-field-name">{comp.name}</span>
                                        </>
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
