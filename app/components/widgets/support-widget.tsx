import React from "react";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faEnvelope, faHeadset} from "@fortawesome/free-solid-svg-icons";
import {faGithub, faDiscord} from "@fortawesome/free-brands-svg-icons";
import "./support-widget.css";


export default function SupportWidget() {

    return (
        <div className="usage-billing-widget support-widget">
            <div className="widget-header">
                <h3>Support</h3>
            </div>

            <div className="support-channels">
                <a href={"mailto:support@flomation.co"} className="support-card">
                    <div className="support-card-icon support-card-icon--email">
                        <FontAwesomeIcon icon={faEnvelope} />
                    </div>
                    <div className="support-card-content">
                        <span className="support-card-title">Email Support</span>
                        <span className="support-card-detail">support@flomation.co</span>
                    </div>
                </a>

                <a href={"https://github.com/flomation-co"} target={"_blank"} rel={"noopener noreferrer"} className="support-card">
                    <div className="support-card-icon support-card-icon--github">
                        <FontAwesomeIcon icon={faGithub} />
                    </div>
                    <div className="support-card-content">
                        <span className="support-card-title">GitHub</span>
                        <span className="support-card-detail">Report issues &amp; contribute</span>
                    </div>
                </a>

                <a href={"https://discord.gg/flomation"} target={"_blank"} rel={"noopener noreferrer"} className="support-card">
                    <div className="support-card-icon support-card-icon--discord">
                        <FontAwesomeIcon icon={faDiscord} />
                    </div>
                    <div className="support-card-content">
                        <span className="support-card-title">Discord Community</span>
                        <span className="support-card-detail">Chat with the team &amp; community</span>
                    </div>
                </a>
            </div>

            <div className="support-footer">
                <FontAwesomeIcon icon={faHeadset} className="support-footer-icon" />
                <span>Visit <a href="https://www.flomation.co" target="_blank" rel="noopener noreferrer">www.flomation.co</a> for documentation &amp; guides</span>
            </div>
        </div>
    );
}
