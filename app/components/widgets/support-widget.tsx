import React from "react";
import "./support-widget.css";
import { Icon } from "~/components/icons/Icon";

export default function SupportWidget() {

    return (
        <div className="usage-billing-widget support-widget">
            <div className="widget-header">
                <h3>Support</h3>
            </div>

            <div className="support-channels">
                <a href={"mailto:support@flomation.co"} className="support-card">
                    <div className="support-card-icon support-card-icon--email">
                        <Icon name="envelope" />
                    </div>
                    <div className="support-card-content">
                        <span className="support-card-title">Email Support</span>
                        <span className="support-card-detail">support@flomation.co</span>
                    </div>
                </a>

                <a href={"https://github.com/flomation-co"} target={"_blank"} rel={"noopener noreferrer"} className="support-card">
                    <div className="support-card-icon support-card-icon--github">
                        <Icon name="github" />
                    </div>
                    <div className="support-card-content">
                        <span className="support-card-title">GitHub</span>
                        <span className="support-card-detail">Report issues &amp; contribute</span>
                    </div>
                </a>

                <a href={"https://discord.gg/flomation"} target={"_blank"} rel={"noopener noreferrer"} className="support-card">
                    <div className="support-card-icon support-card-icon--discord">
                        <Icon name="discord" />
                    </div>
                    <div className="support-card-content">
                        <span className="support-card-title">Discord Community</span>
                        <span className="support-card-detail">Chat with the team &amp; community</span>
                    </div>
                </a>
            </div>

            <div className="support-footer">
                <Icon name="headset" className="support-footer-icon" />
                <span>Visit <a href="https://www.flomation.co" target="_blank" rel="noopener noreferrer">www.flomation.co</a> for documentation &amp; guides</span>
            </div>
        </div>
    );
}
