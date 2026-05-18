import React from "react";
import { Link } from "react-router";
import { Icon } from "~/components/icons/Icon";
import "./usage-billing-widget.css";

interface UsageBillingData {
    currentUsage: number;
    monthlyLimit: number;
    billingPeriod: string;
    periodStart?: string;
    periodEnd?: string;
    nextBillingDate: string;
    currentCost: number;
    creditBalancePence?: number;
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
    const usage = props.data?.currentUsage || 0;
    const limit = props.data?.monthlyLimit || 1;
    const usagePercentage = (usage / limit) * 100;
    const isNearLimit = usagePercentage > 80;

    return (
        <div className="usage-widget">
            <div className="usage-widget-header">
                <div className="usage-widget-badge">
                    <Icon name="pie-chart" />
                </div>
                <h3>Usage</h3>
                <span className="usage-widget-period">{props.data?.billingPeriod || "Monthly"}</span>
            </div>

            <div className="usage-widget-stats">
                <span className="usage-widget-value">{friendlyDuration(usage)}</span>
                <span className="usage-widget-limit">of {friendlyDuration(limit)}</span>
            </div>

            <div className="usage-widget-bar">
                <div
                    className={`usage-widget-bar-fill ${isNearLimit ? "near-limit" : ""}`}
                    style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                />
            </div>

            <div className="usage-widget-footer">
                <span className="usage-widget-pct">{usagePercentage.toFixed(1)}% used</span>
                {isNearLimit && <span className="usage-widget-warn">Near Limit</span>}
            </div>

            {(props.data?.periodStart || props.data?.periodEnd) && (
                <div className="usage-widget-period-dates">
                    <span className="usage-widget-period-label">Billing Period</span>
                    <span className="usage-widget-period-range">
                        {props.data.periodStart ? new Date(props.data.periodStart).toLocaleDateString("en-GB", {day: "numeric", month: "short"}) : ""}
                        {" — "}
                        {props.data.periodEnd ? (() => {
                            const end = new Date(props.data.periodEnd!);
                            end.setDate(end.getDate() - 1);
                            return end.toLocaleDateString("en-GB", {day: "numeric", month: "short", year: "numeric"});
                        })() : ""}
                    </span>
                </div>
            )}

            {props.data?.currentCost ? (
                <div className="usage-widget-cost">
                    <span className="usage-widget-cost-label">Current Period</span>
                    <span className="usage-widget-cost-value">£{props.data.currentCost.toFixed(2)}</span>
                </div>
            ) : null}

            {props.data?.creditBalancePence !== undefined && (
                <div className="usage-widget-credit">
                    <span className="usage-widget-credit-label">Credit Balance</span>
                    <span className={`usage-widget-credit-value ${props.data.creditBalancePence <= 0 ? "empty" : props.data.creditBalancePence <= 500 ? "low" : ""}`}>
                        £{(props.data.creditBalancePence / 100).toFixed(2)}
                    </span>
                </div>
            )}

            <div className="usage-widget-actions">
                <Link to="/billing" className="usage-widget-upgrade">
                    <Icon name="bolt-lightning" />
                    <span>Manage Subscription</span>
                </Link>
                {props.data?.creditBalancePence !== undefined && props.data.creditBalancePence <= 500 && (
                    <Link to="/billing?tab=credits" className="usage-widget-upgrade usage-widget-add-credit">
                        <Icon name="coins" />
                        <span>Add Credit</span>
                    </Link>
                )}
            </div>
        </div>
    );
}
