import React from "react";


export default function SupportWidget() {

    return (
        <div className="usage-billing-widget">
            <div className="widget-header">
                <h3>Support</h3>
            </div>

            <div className="usage-section">
                <div className="usage-stats">
                    <div className="current-usage">
                        Andy Esser
                        <a href={"mailto:andy@flomation.co"}>andy@flomation.co</a>
                        <span className="usage-label">Account Manager</span>
                    </div>
                </div>
            </div>

            <div className="billing-section">
                <div className="usage-stats">
                    <div className="current-usage">
                        <a href={"mailto:support@flomation.co"}>support@flomation.co</a>

                        <a href={"tel:03000881828"}>(+44) 0330 088 1828</a>
                        <span className="usage-label">Technical Support</span>
                    </div>
                </div>
            </div>
        </div>
    );
}