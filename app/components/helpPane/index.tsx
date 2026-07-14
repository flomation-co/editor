import type {ReactNode} from "react";
import {Icon} from "~/components/icons/Icon";
import "./index.css";

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
};

/**
 * HelpPane renders a description of the current page in the right-hand rail.
 * It is a permanent, structural column (adopted via Container's `help` prop):
 * always visible, no collapse.
 */
export default function HelpPane({title, intro, points, tip}: HelpContent) {
    return (
        <aside className="help-pane" aria-label="Page help">
            <div className="help-pane-header">
                <span className="help-pane-heading">
                    <Icon name="lightbulb" className="help-pane-heading-icon" />
                    {title ?? "About this page"}
                </span>
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
        </aside>
    );
}
