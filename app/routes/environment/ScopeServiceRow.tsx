// One service row in the credential scope picker. Renders the
// service's icon, name, optional sensitive badge, and a collapsed/
// expanded view of its controls. Each row is an accordion: only the
// header is visible by default, with a one-line selection summary
// on the right (e.g. "Read + Send") so users can scan without
// opening every row. Clicking the header toggles expansion.
//
// All state is driven by props — no internal state. Parent owns
// both the ScopeSelection map and the per-row expansion state.

import { Icon } from "~/components/icons/Icon";
import type { ServiceScope, ServiceSelection } from "./scope-catalogue";

type Props = {
    service: ServiceScope;
    selection: ServiceSelection | undefined;
    expanded: boolean;
    onExpandToggle: (serviceId: string) => void;
    onLevelChange: (serviceId: string, level: string) => void;
    onToggleChange: (serviceId: string, toggleId: string, enabled: boolean) => void;
};

/** Produce a short, scannable summary of the row's current
 *  selection — shown on the right of the header when the row is
 *  collapsed. Examples:
 *    "Read + Send"            (level + toggle)
 *    "Read"                   (level only)
 *    "Workflows + Gists"      (toggles-only service)
 *    null                     (None level AND no toggles — render
 *                              nothing rather than the noisy "None")
 *  For required-only rows, we never show a summary — the "required"
 *  badge already conveys the row's state. */
function selectionSummary(service: ServiceScope, selection: ServiceSelection | undefined): string | null {
    if (service.required) return null;
    const parts: string[] = [];

    if (service.levels && selection?.level) {
        const level = service.levels.find(l => l.value === selection.level);
        if (level && level.value !== "none" && level.scopes.length > 0) {
            parts.push(level.label);
        }
    }

    if (service.toggles) {
        for (const toggle of service.toggles) {
            if (selection?.toggles.has(toggle.id)) parts.push(toggle.label);
        }
    }

    if (parts.length === 0) return null;
    return parts.join(" + ");
}

export function ScopeServiceRow({
    service,
    selection,
    expanded,
    onExpandToggle,
    onLevelChange,
    onToggleChange,
}: Props) {
    const currentLevel = selection?.level ?? service.levels?.[0]?.value;
    const enabledToggles = selection?.toggles ?? new Set<string>();
    const summary = selectionSummary(service, selection);

    return (
        <div className={`scope-row ${expanded ? "scope-row--expanded" : ""}`}>
            <button
                type="button"
                className="scope-row-header"
                onClick={() => onExpandToggle(service.id)}
                aria-expanded={expanded}
            >
                <Icon
                    name={expanded ? "chevron-down" : "chevron-right"}
                    className="scope-row-chevron"
                />
                <Icon name={service.icon} className="scope-row-icon" />
                <span className="scope-row-name">{service.name}</span>
                {service.sensitive && (
                    <span className="scope-badge scope-badge--sensitive" title="Restricted scope — may require provider app verification for production use.">
                        sensitive
                    </span>
                )}
                {service.required && (
                    <span className="scope-badge scope-badge--required" title="This scope is mechanically required for this provider and can't be removed.">
                        <Icon name="lock" /> required
                    </span>
                )}
                {summary && (
                    <span className="scope-row-summary" title={`Currently selected: ${summary}`}>
                        {summary}
                    </span>
                )}
            </button>

            {expanded && (
                <div className="scope-row-body">
                    <div className="scope-row-description">{service.description}</div>

                    {service.levels && service.levels.length > 0 && (
                        <div className="scope-segment-group" role="radiogroup" aria-label={`${service.name} access level`}>
                            {service.levels.map(level => {
                                const isActive = currentLevel === level.value;
                                return (
                                    <button
                                        key={level.value}
                                        type="button"
                                        role="radio"
                                        aria-checked={isActive}
                                        className={`scope-segment ${isActive ? "scope-segment--active" : ""}`}
                                        onClick={() => onLevelChange(service.id, level.value)}
                                    >
                                        {level.label}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {service.toggles && service.toggles.length > 0 && (
                        <div className="scope-toggle-group">
                            {service.toggles.map(toggle => {
                                const enabled = enabledToggles.has(toggle.id);
                                return (
                                    <label key={toggle.id} className="scope-toggle">
                                        <input
                                            type="checkbox"
                                            checked={enabled}
                                            onChange={e => onToggleChange(service.id, toggle.id, e.target.checked)}
                                        />
                                        <span className="scope-toggle-box" aria-hidden="true">
                                            <Icon name="check" />
                                        </span>
                                        <span className="scope-toggle-label">{toggle.label}</span>
                                        {toggle.sensitive && (
                                            <span className="scope-badge scope-badge--sensitive scope-badge--inline" title="Restricted scope.">
                                                sensitive
                                            </span>
                                        )}
                                    </label>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
