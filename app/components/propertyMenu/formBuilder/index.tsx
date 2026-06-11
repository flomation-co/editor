import React, {useState, useEffect} from "react";
import "./index.css";
import { Icon } from "~/components/icons/Icon";
import VariableInput, {type VariableItem} from "~/components/propertyMenu/variableInput";

type FormComponent = {
    name: string;
    label: string;
    type: string;
    placeholder: string;
    required: boolean;
    order: number;
    read_only?: boolean;
    default_value?: string;
}

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
                                            onValueChange={(_, v) => updateField(pageIndex, fieldIndex, {label: v})}
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
                                </div>
                                <div className="fb-component-footer">
                                    <label className="fb-toggle-label">
                                        <input
                                            type="checkbox"
                                            checked={comp.required}
                                            onChange={e => updateField(pageIndex, fieldIndex, {required: e.target.checked})}
                                        />
                                        Required
                                    </label>
                                    <label className="fb-toggle-label">
                                        <input
                                            type="checkbox"
                                            checked={comp.read_only || false}
                                            onChange={e => updateField(pageIndex, fieldIndex, {read_only: e.target.checked})}
                                        />
                                        Read-only
                                    </label>
                                    <span className="fb-field-name">{comp.name}</span>
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
