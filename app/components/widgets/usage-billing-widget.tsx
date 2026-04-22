import React from "react";

interface UsageBillingData {
    currentUsage: number;
    monthlyLimit: number;
    billingPeriod: string;
    nextBillingDate: string;
    currentCost: number;
}

interface UsageBillingWidgetProps {
    data?: UsageBillingData;
    loading?: boolean;
}

function friendlyDuration(ms: number): string {
    if (!ms || ms <= 0) return "0 seconds";
    const totalSeconds = Math.floor(ms / 1000);
    if (totalSeconds < 60) return `${totalSeconds} second${totalSeconds !== 1 ? "s" : ""}`;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes < 60) {
        return seconds > 0
            ? `${minutes} min${minutes !== 1 ? "s" : ""}, ${seconds} sec${seconds !== 1 ? "s" : ""}`
            : `${minutes} minute${minutes !== 1 ? "s" : ""}`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMins = minutes % 60;
    return remainingMins > 0
        ? `${hours} hour${hours !== 1 ? "s" : ""}, ${remainingMins} min${remainingMins !== 1 ? "s" : ""}`
        : `${hours} hour${hours !== 1 ? "s" : ""}`;
}

export default function UsageBillingWidget(props: UsageBillingWidgetProps) {

    if (props.loading) {
        return (
            <div className="usage-billing-widget loading">
                <div className="widget-header">
                    <h3>Usage & Billing</h3>
                </div>
                <div className="loading-content">Loading...</div>
            </div>
        );
    }

    const usage = props.data?.currentUsage || 0;
    const limit = props.data?.monthlyLimit || 1;
    const usagePercentage = (usage / limit) * 100;
    const isNearLimit = usagePercentage > 80;

    return (
        <div className="usage-billing-widget">
            <div className="widget-header">
                <h3>Usage & Billing</h3>
                <span className="billing-period">{props.data?.billingPeriod}</span>
            </div>

            <div className="usage-section">
                <div className="usage-stats">
                    <div className="current-usage">
                        <span className="usage-number">{friendlyDuration(usage)}</span>
                    </div>
                    <div className="usage-limit">
                        of {friendlyDuration(limit)} limit
                    </div>
                </div>

                <div className="usage-bar">
                    <div
                        className={`usage-progress ${isNearLimit ? 'near-limit' : ''}`}
                        style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                    ></div>
                </div>

                <div className="usage-percentage">
                    <span>{usagePercentage.toFixed(1)}% used</span>
                    {isNearLimit && <span className="warning-badge">Near Limit</span>}
                </div>
            </div>

            <div className="billing-section">
                <div className="current-cost">
                    <span className="cost-label">Current Period Cost</span>
                    <span className="cost-amount">£{props.data?.currentCost?.toFixed(2) || "0.00"}</span>
                </div>
            </div>
        </div>
    );
}
