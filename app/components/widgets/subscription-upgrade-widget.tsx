import React from "react";

interface PlanFeature {
    name: string;
    included: boolean;
}

interface UpgradePlan {
    name: string;
    price: number;
    billingPeriod: string;
    features: PlanFeature[];
    highlighted?: boolean;
    savings?: string;
}

interface SubscriptionUpgradeWidgetProps {
    currentPlan?: string;
    availablePlans?: UpgradePlan[];
    onUpgradeClick?: (planName: string) => void;
}

export default function SubscriptionUpgradeWidget({
                                                      currentPlan = "Start",
                                                      availablePlans = [
                                                          {
                                                              name: "Boost",
                                                              price: 49.99,
                                                              billingPeriod: "month",
                                                              highlighted: true,
                                                              features: [
                                                                  { name: "200 minutes/month", included: true },
                                                                  { name: "2 Factor Authentication (2FA)", included: true }
                                                              ]
                                                          },
                                                          {
                                                              name: "Grow",
                                                              price: 149.99,
                                                              billingPeriod: "month",
                                                              features: [
                                                                  { name: "1000 minutes/month", included: true },
                                                                  { name: "2 Factor Authentication (2FA)", included: true },
                                                                  { name: "Role-Based Access Control (RBAC)", included: true },
                                                                  { name: "SAML/SSO Integration", included: true }
                                                              ]
                                                          },
                                                          {
                                                              name: "Scale",
                                                              price: 299.99,
                                                              billingPeriod: "month",
                                                              features: [
                                                                  { name: "5000 minutes/month", included: true },
                                                                  { name: "2 Factor Authentication (2FA)", included: true },
                                                                  { name: "Role-Based Access Control (RBAC)", included: true },
                                                                  { name: "SAML/SSO Integration", included: true },
                                                                  { name: "Unlimited Teams", included: true },
                                                                  { name: "Organisations", included: true },
                                                                  { name: "Consolidated Billing", included: true },
                                                                  { name: "Audit Logging", included: true },
                                                                  { name: "Real-time Security & Alerting", included: true },
                                                                  { name: "3rd Party AI tooling & API usage Monitoring", included: true },
                                                                  { name: "Node Allow/Deny Listing", included: true }
                                                              ]
                                                          }
                                                      ],
                                                      onUpgradeClick = (planName: string) => {
                                                          console.log(`Upgrade to ${planName} clicked`);
                                                          // You'll implement the actual upgrade logic here
                                                      }
                                                  }: SubscriptionUpgradeWidgetProps) {

    return (
        <div className="subscription-upgrade-widget">
            <div className="widget-header">
                <h3>Upgrade Your Plan</h3>
                <span className="current-plan-badge">Current: {currentPlan}</span>
            </div>

            <div className="upgrade-content">
                <div className="upgrade-message">
                    <p>Get more power with advanced features and higher limits!</p>
                </div>

                <div className="plans-container">
                    {availablePlans.map((plan, index) => (
                        <div
                            key={plan.name}
                            className={`plan-card ${plan.highlighted ? 'highlighted' : ''}`}
                        >
                            {plan.highlighted && (
                                <div className="plan-badge">Most Popular</div>
                            )}

                            {plan.savings && (
                                <div className="savings-badge">{plan.savings}</div>
                            )}

                            <div className="plan-header">
                                <h4 className="plan-name">{plan.name}</h4>
                                <div className="plan-price">
                                    <span className="price-amount">£{plan.price}</span>
                                    <span className="price-period">/{plan.billingPeriod}</span>
                                </div>
                            </div>

                            <div className="plan-features">
                                {plan.features.map((feature, featureIndex) => (
                                    <div key={featureIndex} className="feature-item">
                                        <span className={`feature-icon ${feature.included ? 'included' : 'not-included'}`}>
                                            {feature.included ? '✓' : '✗'}
                                        </span>
                                        <span className="feature-text">{feature.name}</span>
                                    </div>
                                ))}
                            </div>

                            <button
                                className={`upgrade-button ${plan.highlighted ? 'primary' : 'secondary'}`}
                                onClick={() => onUpgradeClick(plan.name)}
                            >
                                Upgrade to {plan.name}
                            </button>
                        </div>
                    ))}
                </div>

                <div className="upgrade-footer">
                    <p className="upgrade-note">
                        ✨ All plans include access to all plugins and integrations.
                    </p>
                </div>
            </div>
        </div>
    );
}