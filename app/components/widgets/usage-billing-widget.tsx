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

    const usagePercentage = (props.data?.currentUsage / props.data?.monthlyLimit) * 100;
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
                        <span className="usage-number">{Math.floor(props.data?.currentUsage / 1000).toLocaleString()}</span>
                        <span className="usage-label">minutes used</span>
                    </div>
                    <div className="usage-limit">
                        of {Math.floor(props.data?.monthlyLimit / 1000).toLocaleString()} limit
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
                    {isNearLimit && <span className="warning-badge">⚠️ Near Limit</span>}
                </div>
            </div>

            <div className="billing-section">
                <div className="current-cost">
                    <span className="cost-label">Current Period Cost</span>
                    <span className="cost-amount">£{props.data?.currentCost}</span>
                </div>

                <div className="next-billing">
                    <span className="billing-label">Next billing</span>
                    <span className="billing-date">
                        {/*{new Date(props.data?.nextBillingDate?).toLocaleDateString()}*/}
                    </span>
                </div>
            </div>
        </div>
    );
}