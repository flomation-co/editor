import {useCallback, useState, type ReactNode} from "react";
import {useMatches} from "react-router";
import {Icon} from "~/components/icons/Icon";
import "./index.css";

/**
 * usePageHelpPreference remembers whether the rail is hidden, per page.
 *
 * The key is the leaf route id rather than the pathname, so the preference
 * belongs to the PAGE and not to the record being viewed: hiding the help on
 * one agent's settings screen hides it on every agent's, which is what somebody
 * means when they dismiss it. A pathname key would ask again for each new id.
 *
 * Read lazily with the same window guard the nav collapse uses. The rail is
 * always rendered and only its width changes, so the server and client markup
 * differ by a class rather than by a missing column — a structural difference
 * would mean a hydration mismatch, or a visible flash of a rail somebody has
 * already dismissed.
 */
function usePageHelpPreference(): [boolean, () => void] {
    const matches = useMatches();
    const pageKey = matches.length > 0 ? matches[matches.length - 1].id : "unknown";
    const storageKey = `flomation-help-hidden:${pageKey}`;

    const [hidden, setHidden] = useState<boolean>(() => {
        if (typeof window === "undefined") return false;
        try {
            return window.localStorage.getItem(storageKey) === "true";
        } catch {
            return false;   // private mode / storage disabled
        }
    });

    const toggle = useCallback(() => {
        setHidden(prev => {
            const next = !prev;
            try {
                window.localStorage.setItem(storageKey, String(next));
            } catch { /* storage disabled — the preference lasts this visit only */ }
            return next;
        });
    }, [storageKey]);

    return [hidden, toggle];
}

// HelpContent describes the plain-English "what is this page for" copy shown in
// the right-hand help pane. Keep the wording jargon-free: it's aimed at someone
// seeing the page for the first time, not at an engineer.
export type HelpContent = {
    /** Pane heading. Defaults to "About this page". */
    title?: string;
    /** One short plain-English paragraph explaining what the page is for. */
    intro: string;
    /** Optional "What you can do here" bullet points: short, action-led. */
    points?: string[];
    /** Optional closing tip, shown in a highlighted callout. May contain a link. */
    tip?: ReactNode;
    /**
     * Optional interactive content rendered below the copy, separated by a
     * divider. Lets a page bolt page-specific tooling (e.g. a live tester) onto
     * the rail without the pane knowing anything about it.
     */
    extra?: ReactNode;
};

/**
 * HelpPane renders a description of the current page in the right-hand rail.
 *
 * It stays a structural column whether open or closed — collapsed it narrows to
 * a slim strip holding the button that reopens it, rather than disappearing.
 * That keeps the affordance where the rail was, instead of adding a floating
 * control that would have to dodge the Feedback tab, and makes it obvious the
 * strip IS the help rail rather than a new piece of furniture.
 */
export default function HelpPane({title, intro, points, tip, extra}: HelpContent) {
    const [hidden, toggle] = usePageHelpPreference();

    if (hidden) {
        return (
            <aside className="help-pane help-pane--collapsed" aria-label="Page help">
                <button
                    type="button"
                    className="help-pane-reopen"
                    onClick={toggle}
                    title="Show help for this page"
                    aria-expanded={false}
                >
                    <Icon name="lightbulb" />
                    <span className="help-pane-reopen-text">Help</span>
                </button>
            </aside>
        );
    }

    return (
        <aside className="help-pane" aria-label="Page help">
            <div className="help-pane-header">
                <span className="help-pane-heading">
                    <Icon name="lightbulb" className="help-pane-heading-icon" />
                    {title ?? "About this page"}
                </span>
                <button
                    type="button"
                    className="help-pane-dismiss"
                    onClick={toggle}
                    title="Hide help on this page"
                    aria-label="Hide help on this page"
                    aria-expanded={true}
                >
                    <Icon name="xmark" />
                </button>
            </div>

            <p className="help-pane-intro">{intro}</p>

            {points && points.length > 0 && (
                <>
                    <div className="help-pane-subheading">What you can do here</div>
                    <ul className="help-pane-points">
                        {points.map((p, i) => (
                            <li key={i}>
                                <Icon name="circle-check" className="help-pane-point-icon" />
                                <span>{p}</span>
                            </li>
                        ))}
                    </ul>
                </>
            )}

            {tip && (
                <div className="help-pane-tip">
                    <Icon name="lightbulb" className="help-pane-tip-icon" />
                    <span>{tip}</span>
                </div>
            )}

            {extra && <div className="help-pane-extra">{extra}</div>}
        </aside>
    );
}
