import React, { useState, useCallback } from "react";
import { Link } from "react-router";
import { Icon } from "~/components/icons/Icon";
import { getRandomTip, type Tip } from "./tips";
import "./tip-widget.css";

export default function TipWidget() {
    const [tip, setTip] = useState<Tip>(getRandomTip);

    const nextTip = useCallback(() => {
        let next = getRandomTip();
        while (next.title === tip.title) {
            next = getRandomTip();
        }
        setTip(next);
    }, [tip]);

    return (
        <div className="tip-widget">
            <div className="tip-widget-header">
                <div className="tip-widget-badge">
                    <Icon name="lightbulb" />
                </div>
                <h3>Tip</h3>
                <button className="tip-widget-refresh" onClick={nextTip} title="Next tip">
                    <Icon name="rotate" />
                </button>
            </div>

            <div className="tip-widget-content">
                <div className="tip-widget-icon">
                    <Icon name={tip.icon} />
                </div>
                <div className="tip-widget-text">
                    <div className="tip-widget-title">{tip.title}</div>
                    <div className="tip-widget-body">{tip.body}</div>
                    {tip.link && tip.linkLabel && (
                        <Link to={tip.link} className="tip-widget-link">
                            {tip.linkLabel} &rarr;
                        </Link>
                    )}
                </div>
            </div>
        </div>
    );
}
