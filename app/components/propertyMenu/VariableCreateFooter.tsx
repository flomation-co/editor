// Shared footer for both VariablePicker (button-triggered dropdown)
// and VariableInput (inline ${ autocomplete). Lets the flow author
// create a missing secret / property / credential without leaving
// the editor: opens the Environment page in a new tab pre-positioned
// on the right tab and (optionally) with the new-entry form pre-
// filled, then offers a refresh button for re-loading the list once
// they come back.
//
// Renders nothing when the active flow has no environment ID — the
// "create" affordance is meaningless without somewhere to create
// the entry into.

import React from "react";
import { Icon } from "~/components/icons/Icon";
import { useEnvironment } from "~/contexts/EnvironmentContext";

type CreatableCategory = "secrets" | "properties" | "credentials";

type Props = {
    /** Current filter text the user has typed in the picker. Used
     *  to (a) infer which creatable category they're searching in
     *  so we can collapse the footer to a single context-aware
     *  button, and (b) pre-fill the new-entry form with whatever
     *  partial name they were trying to autocomplete. */
    filter: string;
};

/** Map a category prefix the user might be typing to the canonical
 *  creatable category. We accept both singular and plural for
 *  secrets/credentials (matches the substitution layer's aliases)
 *  and recognise "env" as the input-form for properties.
 *  Returns null when the filter doesn't start with a creatable
 *  prefix — caller falls back to showing all three buttons. */
function detectCategoryFromFilter(filter: string): { category: CreatableCategory; partialName: string } | null {
    const lower = filter.toLowerCase();
    const prefixes: Array<[string, CreatableCategory]> = [
        ["secrets.", "secrets"],
        ["secret.", "secrets"],
        ["env.", "properties"],
        ["credentials.", "credentials"],
        ["credential.", "credentials"],
    ];
    for (const [prefix, category] of prefixes) {
        if (lower.startsWith(prefix)) {
            return { category, partialName: filter.slice(prefix.length) };
        }
    }
    return null;
}

/** Build the URL that the "+ Create" button opens in a new tab. The
 *  Environment page reads ?tab= and ?new= on mount (see
 *  routes/environment/index.tsx) to position correctly. */
function buildCreateUrl(environmentId: string, category: CreatableCategory, partialName: string): string {
    const params = new URLSearchParams();
    params.set("tab", category);
    if (partialName.trim()) {
        params.set("new", partialName.trim());
    }
    return `/environment/${environmentId}?${params.toString()}`;
}

const CATEGORY_LABELS: Record<CreatableCategory, string> = {
    secrets: "secret",
    properties: "property",
    credentials: "credential",
};

export function VariableCreateFooter({ filter }: Props) {
    const { environmentId, refreshVariables } = useEnvironment();

    // Nothing to do if there's no environment to create into.
    if (!environmentId) return null;

    const detected = detectCategoryFromFilter(filter);

    return (
        <div className="vp-footer">
            {detected ? (
                // Context-aware single button — user has typed a
                // category prefix, so we know which kind they want.
                <a
                    className="vp-footer-btn vp-footer-btn--create"
                    href={buildCreateUrl(environmentId, detected.category, detected.partialName)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onMouseDown={(e) => e.preventDefault()}
                >
                    <Icon name="plus" />
                    <span>
                        New {CATEGORY_LABELS[detected.category]}
                        {detected.partialName.trim() && (
                            <code className="vp-footer-name">{detected.partialName.trim()}</code>
                        )}
                    </span>
                </a>
            ) : (
                // Filter is empty or ambiguous — show all three so
                // the user picks which kind to create.
                <>
                    {(["secrets", "properties", "credentials"] as CreatableCategory[]).map((category) => (
                        <a
                            key={category}
                            className="vp-footer-btn vp-footer-btn--create"
                            href={buildCreateUrl(environmentId, category, "")}
                            target="_blank"
                            rel="noopener noreferrer"
                            onMouseDown={(e) => e.preventDefault()}
                        >
                            <Icon name="plus" />
                            <span>{CATEGORY_LABELS[category]}</span>
                        </a>
                    ))}
                </>
            )}

            <button
                type="button"
                className="vp-footer-btn vp-footer-btn--refresh"
                onClick={(e) => {
                    e.preventDefault();
                    refreshVariables();
                }}
                onMouseDown={(e) => e.preventDefault()}
                title="Refresh the variable list — use after creating a new entry in the other tab."
            >
                <Icon name="arrow-rotate-right" />
            </button>
        </div>
    );
}
