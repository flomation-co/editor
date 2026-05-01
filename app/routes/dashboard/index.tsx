import type {Route} from "../+types/home";
import Container from "~/components/container";
import {useAuth} from "~/context/auth/use";
import React, {useEffect, useState} from "react";
import Card from "~/components/card";
import UsageBillingWidget from "~/components/widgets/usage-billing-widget";

import useCookieToken from "~/components/cookie";
import type {UserDashboard} from "~/types";
import api from "~/lib/api";
import useConfig from "~/components/config";
import SupportWidget from "~/components/widgets/support-widget";
import TipWidget from "~/components/widgets/tip-widget";
import ChecklistWidget from "~/components/widgets/checklist-widget";
import {
    fetchQuota, fetchSubscription,
    type QuotaResponse, type BillingSubscription,
} from "~/lib/billing";

export function meta({}: Route.MetaArgs) {
    return [
        { title: "Flomation" },
        { name: "description", content: "Flomate your workflows" },
    ];
}

export default function Dashboard() {
    const auth = useAuth();
    const token = useCookieToken();

    const [userDashboard, setUserDashboard] = useState<UserDashboard>();
    const [subscription, setSubscription] = useState<BillingSubscription | null>(null);

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

        // Fetch current subscription for period dates.
        if (token) {
            fetchSubscription(token, controller.signal)
                .then(sub => setSubscription(sub))
                .catch(() => {});
        }

        return () => controller.abort();
    }, []);

    // Only show cost for paid subscriptions.
    const hasPaidSub = subscription?.status && subscription.status !== "none" && subscription.price;
    const currentCost = hasPaidSub && subscription?.price
        ? subscription.price.amount_pence / 100
        : 0;

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
                        nextBillingDate: "",
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
        </Container>
    )
}
