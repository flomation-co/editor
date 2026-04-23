import React from "react";
import { Icon } from "~/components/icons/Icon";
import "./support-widget.css";

export default function SupportWidget() {
    return (
        <div className="support-widget">
            <div className="support-widget-header">
                <div className="support-widget-badge">
                    <Icon name="headset" />
                </div>
                <h3>Support</h3>
            </div>

            <div className="support-channels">
                <a href="mailto:support@flomation.co" className="support-channel">
                    <div className="support-channel-icon support-channel-icon--email">
                        <Icon name="envelope" />
                    </div>
                    <div className="support-channel-text">
                        <span className="support-channel-title">Email Support</span>
                        <span className="support-channel-detail">support@flomation.co</span>
                    </div>
                </a>

                <a href="https://github.com/flomation-co" target="_blank" rel="noopener noreferrer" className="support-channel">
                    <div className="support-channel-icon support-channel-icon--github">
                        <Icon name="github" />
                    </div>
                    <div className="support-channel-text">
                        <span className="support-channel-title">GitHub</span>
                        <span className="support-channel-detail">Report issues &amp; contribute</span>
                    </div>
                </a>

                <a href="https://discord.gg/flomation" target="_blank" rel="noopener noreferrer" className="support-channel">
                    <div className="support-channel-icon support-channel-icon--discord">
                        <Icon name="discord" />
                    </div>
                    <div className="support-channel-text">
                        <span className="support-channel-title">Discord Community</span>
                        <span className="support-channel-detail">Chat with the team &amp; community</span>
                    </div>
                </a>
            </div>

            <div className="support-widget-footer">
                <Icon name="globe" className="support-widget-footer-icon" />
                <span>Visit <a href="https://www.flomation.co" target="_blank" rel="noopener noreferrer">www.flomation.co</a> for documentation</span>
            </div>
        </div>
    );
}
