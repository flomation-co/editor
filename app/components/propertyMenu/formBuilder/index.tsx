import React, {useState, useEffect} from "react";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faPlus, faTrash, faChevronUp, faChevronDown, faGripVertical, faFileLines} from "@fortawesome/pro-solid-svg-icons";
import "./index.css";

type FormComponent = {
    name: string;
    label: string;
    type: string;
    placeholder: string;
    required: boolean;
    order: number;
}

type FormPage = {
    components: FormComponent[];
}

type FormDefinition = {
    title: string;
    description: string;
    pages: FormPage[];
}

type Props = {
    value: string;
    onChange: (value: string) => void;
}

const fieldTypes = [
    {value: "text", label: "Text"},
    {value: "multiline", label: "Multi-line Text"},
    {value: "number", label: "Number"},
    {value: "boolean", label: "Checkbox"},
];

const FormBuilder = (props: Props) => {
    const [form, setForm] = useState<FormDefinition>(() => {
        try {
            const parsed = JSON.parse(props.value || "{}");
            return {
                title: parsed.title || "Untitled Form",
                description: parsed.description || "",
                pages: parsed.pages || [{components: []}],
            };
        } catch {
            return {title: "Untitled Form", description: "", pages: [{components: []}]};
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

    const addField = (pageIndex: number) => {
        const fieldNum = form.pages.reduce((acc, p) => acc + p.components.length, 0) + 1;
        const newField: FormComponent = {
            name: `field_${fieldNum}`,
            label: `Field ${fieldNum}`,
            type: "text",
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
                    <input
                        type="text"
                        className="fb-input"
                        value={form.title}
                        onChange={e => updateForm({title: e.target.value})}
                    />
                </div>
                <div className="fb-field-row">
                    <label className="fb-label">Description</label>
                    <input
                        type="text"
                        className="fb-input"
                        value={form.description}
                        placeholder="Optional description"
                        onChange={e => updateForm({description: e.target.value})}
                    />
                </div>
            </div>

            {form.pages.map((page, pageIndex) => (
                <div key={pageIndex} className="fb-page">
                    <div className="fb-page-header">
                        <span className="fb-page-title">
                            <FontAwesomeIcon icon={faFileLines} /> Page {pageIndex + 1}
                        </span>
                        <div className="fb-page-actions">
                            {form.pages.length > 1 && (
                                <>
                                    <button className="fb-icon-btn" onClick={() => movePage(pageIndex, -1)} disabled={pageIndex === 0}>
                                        <FontAwesomeIcon icon={faChevronUp} />
                                    </button>
                                    <button className="fb-icon-btn" onClick={() => movePage(pageIndex, 1)} disabled={pageIndex === form.pages.length - 1}>
                                        <FontAwesomeIcon icon={faChevronDown} />
                                    </button>
                                    <button className="fb-icon-btn fb-danger" onClick={() => removePage(pageIndex)}>
                                        <FontAwesomeIcon icon={faTrash} />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {page.components.map((comp, fieldIndex) => (
                        <div key={fieldIndex} className="fb-component">
                            <div className="fb-component-header">
                                <FontAwesomeIcon icon={faGripVertical} className="fb-grip" />
                                <div className="fb-component-fields">
                                    <div className="fb-row">
                                        <input
                                            className="fb-input fb-input-sm"
                                            value={comp.label}
                                            placeholder="Label"
                                            onChange={e => updateField(pageIndex, fieldIndex, {label: e.target.value})}
                                        />
                                        <select
                                            className="fb-select"
                                            value={comp.type}
                                            onChange={e => updateField(pageIndex, fieldIndex, {type: e.target.value})}
                                        >
                                            {fieldTypes.map(ft => (
                                                <option key={ft.value} value={ft.value}>{ft.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="fb-row">
                                        <input
                                            className="fb-input fb-input-sm"
                                            value={comp.name}
                                            placeholder="Field name"
                                            onChange={e => updateField(pageIndex, fieldIndex, {name: e.target.value})}
                                        />
                                        <input
                                            className="fb-input fb-input-sm"
                                            value={comp.placeholder}
                                            placeholder="Placeholder"
                                            onChange={e => updateField(pageIndex, fieldIndex, {placeholder: e.target.value})}
                                        />
                                        <label className="fb-checkbox-label">
                                            <input
                                                type="checkbox"
                                                checked={comp.required}
                                                onChange={e => updateField(pageIndex, fieldIndex, {required: e.target.checked})}
                                            />
                                            Required
                                        </label>
                                    </div>
                                </div>
                                <div className="fb-component-actions">
                                    <button className="fb-icon-btn" onClick={() => moveField(pageIndex, fieldIndex, -1)} disabled={fieldIndex === 0}>
                                        <FontAwesomeIcon icon={faChevronUp} />
                                    </button>
                                    <button className="fb-icon-btn" onClick={() => moveField(pageIndex, fieldIndex, 1)} disabled={fieldIndex === page.components.length - 1}>
                                        <FontAwesomeIcon icon={faChevronDown} />
                                    </button>
                                    <button className="fb-icon-btn fb-danger" onClick={() => removeField(pageIndex, fieldIndex)}>
                                        <FontAwesomeIcon icon={faTrash} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}

                    <button className="fb-add-field" onClick={() => addField(pageIndex)}>
                        <FontAwesomeIcon icon={faPlus} /> Add Field
                    </button>
                </div>
            ))}

            <button className="fb-add-page" onClick={addPage}>
                <FontAwesomeIcon icon={faPlus} /> Add Page
            </button>
        </div>
    );
};

export default FormBuilder;
