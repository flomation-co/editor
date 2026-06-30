// RowsProperty renders the editor widget for ConnectionTypeRows
// inputs: spreadsheet append actions and other places where the user
// wants to enter a 2-D table of values, each cell supporting either
// literal text or a ${...} variable reference.
//
// Wire format (preserved from the old ConnectionTypeText shape):
//   [["A1","B1"], ["A2","B2"]]
// — a JSON 2D array stored as a string in the connection value. The
// existing google/sheets/append + microsoft/excel/append_rows actions
// already json.Unmarshal this string, so the widget is a pure UI
// upgrade with zero backend changes.
//
// UX shape:
//   ┌─────────────────────────────────────────┐
//   │ Row 1                              [×]  │
//   │ [cell] [cell] [cell]              [+]   │   <- + Column
//   ├─────────────────────────────────────────┤
//   │ Row 2                              [×]  │
//   │ [cell] [cell]                     [+]   │
//   └─────────────────────────────────────────┘
//                                  [+ Add row]
//
// Backward-compat behaviour on mount: parse whatever JSON 2D array
// is already in the value. If parsing fails (malformed JSON,
// non-array root, mid-flight migration), fall back to a single
// empty row so users don't lose access to the input. The original
// raw value is preserved in state so it can be surfaced via a
// "raw JSON" toggle if needed in future.

import React, { useEffect, useState } from "react";
import VariableInput, { type VariableItem } from "~/components/propertyMenu/variableInput";
import { Icon } from "~/components/icons/Icon";
import "./index.css";

type Cell = string;
type Row = Cell[];

type RowsPropertyProps = {
    nodeId: string;
    name: string;
    label: string;
    value: string;
    placeholder?: string;
    variables?: VariableItem[];
    onValueChange?: (property: string, value: any) => void;
};

/** Parse the saved JSON 2D string into rows. Tolerates the empty
 *  string (treats as one empty row), malformed JSON (treats as one
 *  empty row + retains nothing — user is free to start over), and
 *  cells that arrive as non-string scalars (numbers, booleans) by
 *  coercing to their string representation. The widget's wire
 *  format is strings end-to-end; numeric values are entered as
 *  unquoted text and become strings here. Actions that want
 *  typed cells decode them on parse — same as today. */
function parseRows(raw: string): Row[] {
    if (!raw || !raw.trim()) return [[""]];
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [[""]];
        const rows: Row[] = [];
        for (const r of parsed) {
            if (!Array.isArray(r)) continue;
            const cells: Cell[] = r.map(c => {
                if (typeof c === "string") return c;
                if (c === null || c === undefined) return "";
                return String(c);
            });
            rows.push(cells.length === 0 ? [""] : cells);
        }
        if (rows.length === 0) return [[""]];
        return rows;
    } catch {
        return [[""]];
    }
}

/** Serialise the widget state back into the JSON 2D string the
 *  backend expects. Empty trailing rows and columns are NOT
 *  trimmed — the user might have just added a placeholder row
 *  they're about to fill. Trimming would surprise; preserving
 *  matches what the user sees. */
function serialiseRows(rows: Row[]): string {
    return JSON.stringify(rows);
}

const RowsProperty = (props: RowsPropertyProps) => {
    const [rows, setRows] = useState<Row[]>(() => parseRows(props.value));

    // Re-sync from props when the node changes (user switched
    // selection to a different node). Don't re-sync on every value
    // change — that would fight with local editing.
    useEffect(() => {
        setRows(parseRows(props.value));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.nodeId]);

    const commit = (next: Row[]) => {
        setRows(next);
        if (props.onValueChange) {
            props.onValueChange(props.name, serialiseRows(next));
        }
    };

    const updateCell = (rowIndex: number, colIndex: number, value: string) => {
        const next = rows.map((r, i) => {
            if (i !== rowIndex) return r;
            const updated = [...r];
            updated[colIndex] = value;
            return updated;
        });
        commit(next);
    };

    const addColumn = (rowIndex: number) => {
        const next = rows.map((r, i) => (i === rowIndex ? [...r, ""] : r));
        commit(next);
    };

    const removeColumn = (rowIndex: number, colIndex: number) => {
        const next = rows.map((r, i) => {
            if (i !== rowIndex) return r;
            const updated = r.filter((_, c) => c !== colIndex);
            // Always keep at least one cell — easier to type into than
            // an empty row.
            return updated.length === 0 ? [""] : updated;
        });
        commit(next);
    };

    const addRow = () => {
        // New row gets one empty cell. The user can add columns as
        // they go — this matches how spreadsheets feel (start with
        // one cell, expand).
        commit([...rows, [""]]);
    };

    const removeRow = (rowIndex: number) => {
        // Always keep at least one row so the widget never collapses
        // to an empty state the user can't recover from. Removing
        // the last row leaves a single empty row.
        const next = rows.filter((_, i) => i !== rowIndex);
        commit(next.length === 0 ? [[""]] : next);
    };

    return (
        <div className="property-menu-input-row">
            <div className="property-menu-input-name">{props.label}</div>

            <div className="rows-property">
                {rows.map((row, rowIndex) => (
                    <div key={rowIndex} className="rows-property-row">
                        <div className="rows-property-row-header">
                            <span className="rows-property-row-label">Row {rowIndex + 1}</span>
                            <button
                                type="button"
                                className="rows-property-icon-btn rows-property-icon-btn--danger"
                                onClick={() => removeRow(rowIndex)}
                                title="Remove this row"
                            >
                                <Icon name="xmark" />
                            </button>
                        </div>
                        <div className="rows-property-cells">
                            {row.map((cell, colIndex) => (
                                <div key={colIndex} className="rows-property-cell">
                                    <VariableInput
                                        nodeId={props.nodeId}
                                        name={`${props.name}_r${rowIndex}_c${colIndex}`}
                                        placeholder={`Col ${colIndex + 1}`}
                                        label=""
                                        value={cell}
                                        variables={props.variables ?? []}
                                        onValueChange={(_, v) => updateCell(rowIndex, colIndex, v)}
                                    />
                                    {row.length > 1 && (
                                        <button
                                            type="button"
                                            className="rows-property-cell-remove"
                                            onClick={() => removeColumn(rowIndex, colIndex)}
                                            title="Remove this column"
                                            tabIndex={-1}
                                        >
                                            <Icon name="xmark" />
                                        </button>
                                    )}
                                </div>
                            ))}
                            <button
                                type="button"
                                className="rows-property-add-col"
                                onClick={() => addColumn(rowIndex)}
                                title="Add another column to this row"
                            >
                                <Icon name="plus" /> Column
                            </button>
                        </div>
                    </div>
                ))}

                <button
                    type="button"
                    className="rows-property-add-row"
                    onClick={addRow}
                    title="Add another row"
                >
                    <Icon name="plus" /> Add row
                </button>
            </div>
        </div>
    );
};

export default RowsProperty;
