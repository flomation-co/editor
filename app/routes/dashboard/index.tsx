import type {Route} from "../+types/home";
import Container from "~/components/container";
import {useAuth} from "~/context/auth/use";
import React, {useEffect, useState} from "react";
import Card from "~/components/card";
import UsageBillingWidget from "~/components/widgets/usage-billing-widget";
import SubscriptionUpgradeWidget from "~/components/widgets/subscription-upgrade-widget";
import type {UpgradePlan} from "~/components/widgets/subscription-upgrade-widget";

import useCookieToken from "~/components/cookie";
import type {UserDashboard} from "~/types";
import api from "~/lib/api";
import useConfig from "~/components/config";
import SupportWidget from "~/components/widgets/support-widget";
import TipWidget from "~/components/widgets/tip-widget";
import ChecklistWidget from "~/components/widgets/checklist-widget";
import {
    fetchPlans, fetchQuota, fetchSubscription, upgradeSubscription,
    type BillingPlan, type QuotaResponse, type BillingSubscription,
} from "~/lib/billing";

export function meta({}: Route.MetaArgs) {
    return [
        { title: "Flomation" },
        { name: "description", content: "Flomate your workflows" },
    ];
}

/**
 * Convert a BillingPlan from the API into the shape the upgrade widget expects.
 */
function planToUpgradePlan(plan: BillingPlan): UpgradePlan {
    const price = plan.prices?.[0];
    const amountPounds = price ? price.amount_pence / 100 : 0;

    const features = plan.entitlements
        .filter(e => e.value_int !== undefined || e.value_bool !== undefined)
        .map(e => {
            if (e.entitlement_key === "execution_minutes") {
                const mins = e.value_int ?? 0;
                return {
                    name: mins === -1 ? "Unlimited execution time" : `${mins} minutes/month`,
                    included: true,
                };
            }
            if (e.entitlement_key === "flow_count") {
                const count = e.value_int ?? 0;
                return {
                    name: count === -1 ? "Unlimited flows" : `${count} flows`,
                    included: true,
                };
            }
            if (e.entitlement_key === "runner_count") {
                const count = e.value_int ?? 0;
                return {
                    name: count === -1 ? "Unlimited runners" : `${count} runner${count !== 1 ? "s" : ""}`,
                    included: true,
                };
            }
            if (e.entitlement_key === "agent_count") {
                const count = e.value_int ?? 0;
                if (count === 0) return { name: "AI Agents", included: false };
                return {
                    name: count === -1 ? "Unlimited AI agents" : `${count} AI agent${count !== 1 ? "s" : ""}`,
                    included: true,
                };
            }
            if (e.entitlement_key === "mfa_enabled") {
                return { name: "Multi-Factor Authentication", included: !!e.value_bool };
            }
            if (e.entitlement_key === "rbac_enabled") {
                return { name: "Role-Based Access Control", included: !!e.value_bool };
            }
            if (e.entitlement_key === "sso_enabled") {
                return { name: "SAML/SSO Integration", included: !!e.value_bool };
            }
            if (e.entitlement_key === "org_members") {
                const count = e.value_int ?? 0;
                if (count === 0) return { name: "Organisation members", included: false };
                return {
                    name: count === -1 ? "Unlimited organisation members" : `${count} organisation member${count !== 1 ? "s" : ""}`,
                    included: true,
                };
            }
            return { name: e.entitlement_key, included: true };
        });

    return {
        name: plan.name,
        slug: plan.slug,
        priceId: price?.id,
        price: amountPounds,
        billingPeriod: price?.billing_interval || "month",
        features,
        highlighted: plan.slug === "boost",
    };
}

export default function Dashboard() {
    const auth = useAuth();
    const token = useCookieToken();

    const [userDashboard, setUserDashboard] = useState<UserDashboard>();
    const [quota, setQuota] = useState<QuotaResponse>();
    const [plans, setPlans] = useState<UpgradePlan[]>([]);
    const [currentPlan, setCurrentPlan] = useState<string>("Start");
    const [subscription, setSubscription] = useState<BillingSubscription | null>(null);
    const [upgrading, setUpgrading] = useState(false);

    const handleUpgradeClick = async (planName: string) => {
        if (!token || upgrading) return;

        const plan = plans.find(p => p.name === planName);
        if (!plan?.priceId) {
            alert(`Unable to upgrade to ${planName} — no pricing available.`);
            return;
        }

        setUpgrading(true);
        try {
            await upgradeSubscription(token, plan.slug!, plan.priceId);
            // Refresh data after upgrade.
            window.location.reload();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Unknown error";
            alert(`Upgrade failed: ${message}. Please try again or contact support.`);
        } finally {
            setUpgrading(false);
        }
    };

    useEffect(() => {
        const controller = new AbortController();
        const config = useConfig();

        // Fetch dashboard usage data (existing endpoint).
        const dashboardURL = config("AUTOMATE_API_URL") + "/api/v1/dashboard";
        api.get(dashboardURL, {
            signal: controller.signal,
            headers: { "Authorization": "Bearer " + token },
        }).then(response => {
            if (response) {
                setUserDashboard(response.data);
            }
        }).catch(() => {});

        // Fetch quota from the API (includes entitlement data).
        if (token) {
            fetchQuota(token, controller.signal)
                .then(q => {
                    setQuota(q);
                    if (q.plan_slug) {
                        setCurrentPlan(q.plan_slug.charAt(0).toUpperCase() + q.plan_slug.slice(1));
                    }
                })
                .catch(() => {});

            // Fetch available plans from the billing service.
            fetchPlans(token, controller.signal)
                .then(billingPlans => {
                    const upgradePlans = billingPlans
                        .filter(p => p.prices?.[0]?.amount_pence > 0)
                        .map(planToUpgradePlan);
                    setPlans(upgradePlans);
                })
                .catch(() => {
                    // Billing service not available — leave plans empty,
                    // the widget won't render.
                });

            // Fetch current subscription.
            fetchSubscription(token, controller.signal)
                .then(sub => setSubscription(sub))
                .catch(() => {});
        }

        return () => controller.abort();
    }, []);

    // Calculate cost from subscription price (only for paid subs).
    const hasPaidSub = subscription?.status && subscription.status !== "none" && subscription.price;
    const currentCost = hasPaidSub && subscription?.price
        ? subscription.price.amount_pence / 100
        : 0;

    // Calculate next billing date from subscription period end.
    const nextBillingDate = hasPaidSub && subscription?.current_period_end
        ? new Date(subscription.current_period_end).toLocaleDateString("en-GB", {
            day: "numeric", month: "long", year: "numeric",
        })
        : "";

    return (
        <Container>
            <div className={"header"}>{auth.user ? "Welcome, " + auth.user?.name : ""}</div>

            <div className={"card-container"}>
                <Card>
                    <TipWidget />
                </Card>
            </div>

            <div className={"card-container"}>
                <Card>
                    <UsageBillingWidget data={{
                        currentUsage: userDashboard ? userDashboard.usage : 0,
                        monthlyLimit: userDashboard ? userDashboard.allowance : 0,
                        billingPeriod: "Monthly",
                        periodStart: subscription?.current_period_start,
                        periodEnd: subscription?.current_period_end,
                        nextBillingDate: nextBillingDate,
                        currentCost: currentCost,
                    }} />
                </Card>
                <Card>
                    <SupportWidget />
                </Card>
                <Card>
                    <ChecklistWidget />
                </Card>
            </div>

            {plans.length > 0 && (
                <div className={"card-container"}>
                    <Card>
                        <SubscriptionUpgradeWidget
                            currentPlan={currentPlan}
                            availablePlans={plans}
                            onUpgradeClick={handleUpgradeClick}
                        />
                    </Card>
                </div>
            )}
        </Container>
    )
}
