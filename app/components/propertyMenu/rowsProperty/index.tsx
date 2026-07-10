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

// Drag state: which cell or row is being dragged. Cells reorder only
// within their own row (their column position is meaningful across the
// 2D grid); rows reorder among themselves.
type DragState =
    | { kind: "cell"; row: number; col: number }
    | { kind: "row"; row: number }
    | null;

const RowsProperty = (props: RowsPropertyProps) => {
    const [rows, setRows] = useState<Row[]>(() => parseRows(props.value));
    const [drag, setDrag] = useState<DragState>(null);
    // The cell/row currently under the pointer during a drag, for a drop
    // indicator. Cleared on drop/drag-end.
    const [over, setOver] = useState<DragState>(null);

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

    // Reorder a cell within its row (drag-and-drop). Removing then
    // re-inserting keeps the move predictable; a no-op move is ignored.
    const moveCell = (rowIndex: number, from: number, to: number) => {
        if (from === to) return;
        const next = rows.map((r, i) => {
            if (i !== rowIndex) return r;
            const updated = [...r];
            const [moved] = updated.splice(from, 1);
            updated.splice(to, 0, moved);
            return updated;
        });
        commit(next);
    };

    // Reorder a whole row among the other rows (drag-and-drop).
    const moveRow = (from: number, to: number) => {
        if (from === to) return;
        const next = [...rows];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        commit(next);
    };

    const endDrag = () => {
        setDrag(null);
        setOver(null);
    };

    return (
        <div className="property-menu-input-row">
            <div className="property-menu-input-name">{props.label}</div>

            <div className="rows-property">
                {rows.map((row, rowIndex) => {
                    const rowOver = over?.kind === "row" && over.row === rowIndex && drag?.kind === "row" && drag.row !== rowIndex;
                    return (
                    <div
                        key={rowIndex}
                        className={`rows-property-row${rowOver ? " rows-property-row--drop" : ""}`}
                        onDragOver={e => {
                            if (drag?.kind === "row") {
                                e.preventDefault();
                                setOver({ kind: "row", row: rowIndex });
                            }
                        }}
                        onDrop={e => {
                            if (drag?.kind === "row") {
                                e.preventDefault();
                                moveRow(drag.row, rowIndex);
                                endDrag();
                            }
                        }}
                    >
                        <div className="rows-property-row-header">
                            <span
                                className="rows-property-drag rows-property-drag--row"
                                draggable
                                onDragStart={e => {
                                    e.dataTransfer.effectAllowed = "move";
                                    setDrag({ kind: "row", row: rowIndex });
                                }}
                                onDragEnd={endDrag}
                                title="Drag to reorder this row"
                            >
                                <Icon name="grip-vertical" />
                            </span>
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
                            {row.map((cell, colIndex) => {
                                const cellOver = over?.kind === "cell" && over.row === rowIndex && over.col === colIndex
                                    && drag?.kind === "cell" && drag.row === rowIndex && drag.col !== colIndex;
                                return (
                                <div
                                    key={colIndex}
                                    className={`rows-property-cell${cellOver ? " rows-property-cell--drop" : ""}`}
                                    onDragOver={e => {
                                        // Cells reorder only within their own row.
                                        if (drag?.kind === "cell" && drag.row === rowIndex) {
                                            e.preventDefault();
                                            setOver({ kind: "cell", row: rowIndex, col: colIndex });
                                        }
                                    }}
                                    onDrop={e => {
                                        if (drag?.kind === "cell" && drag.row === rowIndex) {
                                            e.preventDefault();
                                            moveCell(rowIndex, drag.col, colIndex);
                                            endDrag();
                                        }
                                    }}
                                >
                                    <span
                                        className="rows-property-drag rows-property-drag--cell"
                                        draggable
                                        onDragStart={e => {
                                            e.dataTransfer.effectAllowed = "move";
                                            setDrag({ kind: "cell", row: rowIndex, col: colIndex });
                                        }}
                                        onDragEnd={endDrag}
                                        title="Drag to reorder this column"
                                    >
                                        <Icon name="grip-vertical" />
                                    </span>
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
                                );
                            })}
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
                    );
                })}

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
