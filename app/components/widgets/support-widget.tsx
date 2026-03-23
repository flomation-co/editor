import React from "react";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faEnvelope} from "@fortawesome/free-solid-svg-icons";
import {faGithub, faDiscord} from "@fortawesome/free-brands-svg-icons";


export default function SupportWidget() {

    return (
        <div className="usage-billing-widget">
            <div className="widget-header">
                <h3>Support</h3>
            </div>

            <div className="billing-section">
                <div className="usage-stats">
                    <div className="current-usage">
                        <a href={"mailto:support@flomation.co"}>
                            <FontAwesomeIcon icon={faEnvelope} /> support@flomation.co
                        </a>

                        <a href={"https://github.com/flomation"} target={"_blank"} rel={"noopener noreferrer"}>
                            <FontAwesomeIcon icon={faGithub} /> GitHub
                        </a>

                        <a href={"https://discord.gg/flomation"} target={"_blank"} rel={"noopener noreferrer"}>
                            <FontAwesomeIcon icon={faDiscord} /> Discord Community
                        </a>

                        <span className="usage-label">Get Help</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
