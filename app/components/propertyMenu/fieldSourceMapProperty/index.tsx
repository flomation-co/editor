import React, { useEffect, useState } from "react";
import type { ParameterOption } from "~/types";
import { Icon } from "~/components/icons/Icon";
import "./index.css";

// A single field → request-part mapping. Serialized as one entry of a JSON
// OBJECT ({ field: source }) — NOT the key_value_array's array-of-pairs form,
// because the API/executor parse the Web Trigger's `fields` as map[string]string.
type Row = { field: string; source: string };

type Props = {
  nodeId: string;
  name: string;
  label: string;
  value: string;
  options: ParameterOption[];
  onValueChange?: (property: string, value: any) => void;
};

const FALLBACK_SOURCES: ParameterOption[] = [
  { name: "Path", value: "path" },
  { name: "Query", value: "query" },
  { name: "Header", value: "header" },
  { name: "Body", value: "body" },
];

function parseRows(value: string): Row[] {
  try {
    const obj = typeof value === "string" ? JSON.parse(value || "{}") : value;
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      return Object.entries(obj).map(([field, source]) => ({ field, source: String(source) }));
    }
  } catch {
    /* fall through to empty */
  }
  return [];
}

const FieldSourceMapProperty = (props: Props) => {
  const sources = props.options?.length ? props.options : FALLBACK_SOURCES;
  const defaultSource = sources[0].value;
  const [rows, setRows] = useState<Row[]>([]);

  // Re-seed only when the node changes (mirrors the other structured renderers).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setRows(parseRows(props.value));
  }, [props.nodeId]);

  const commit = (next: Row[]) => {
    setRows(next);
    // Serialize to a JSON object { field: source }, skipping unnamed rows so a
    // half-typed field never poisons the map.
    const obj: Record<string, string> = {};
    for (const r of next) {
      const f = r.field.trim();
      if (f) obj[f] = r.source;
    }
    props.onValueChange?.(props.name, JSON.stringify(obj));
  };

  const update = (i: number, patch: Partial<Row>) =>
    commit(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const add = () => commit([...rows, { field: "", source: defaultSource }]);
  const remove = (i: number) => commit(rows.filter((_, idx) => idx !== i));

  return (
    <div className="property-menu-input-row">
      <div className="property-menu-input-name fsm-header">
        <span>{props.label}</span>
        <button className="fsm-add-btn" onClick={add} title="Add field" type="button">
          <Icon name="plus" />
        </button>
      </div>

      <div className="fsm-list">
        {rows.map((r, i) => (
          <div key={i} className="fsm-row">
            <input
              className="fsm-field"
              placeholder="field name"
              value={r.field}
              onChange={(e) => update(i, { field: e.target.value })}
            />
            <span className="fsm-from">from</span>
            <select
              className="fsm-source"
              value={r.source}
              onChange={(e) => update(i, { source: e.target.value })}
            >
              {sources.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.name}
                </option>
              ))}
            </select>
            <button
              className="fsm-icon-btn fsm-icon-btn--danger"
              onClick={() => remove(i)}
              title="Remove"
              type="button"
            >
              <Icon name="xmark" />
            </button>
          </div>
        ))}

        {rows.length === 0 && <div className="fsm-empty-state">No request fields mapped</div>}
      </div>

      <div className="fsm-hint">
        Each field becomes a bare <code>{"${field}"}</code> output, taken from the chosen part of the request.
      </div>
    </div>
  );
};

export default FieldSourceMapProperty;
