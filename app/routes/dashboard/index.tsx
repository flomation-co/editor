import type {Route} from "../+types/home";
import Container from "~/components/container";
import {useAuth} from "~/context/auth/use";
import React, {useEffect, useState} from "react";
import Card from "~/components/card";
import UsageBillingWidget from "~/components/widgets/usage-billing-widget";
import SubscriptionUpgradeWidget from "~/components/widgets/subscription-upgrade-widget";

import "~/components/widgets/widgets.css";
import useCookieToken from "~/components/cookie";
import type {UserDashboard} from "~/types";
import api from "~/lib/api";
import useConfig from "~/components/config";
import SupportWidget from "~/components/widgets/support-widget";
import TipWidget from "~/components/widgets/tip-widget";

export function meta({}: Route.MetaArgs) {
    return [
        { title: "Flomation" },
        { name: "description", content: "Flomate your workflows" },
    ];
}

export default function Dashboard() {
    const auth = useAuth();
    const controller = new AbortController();
    const token = useCookieToken();

    const [ userDashboard, setUserDashboard ] = useState<UserDashboard>();

    // Handle upgrade button clicks
    const handleUpgradeClick = (planName: string) => {
        // TODO: Implement your upgrade logic here
        // This might redirect to a payment page, open a modal, etc.
        console.log(`User wants to upgrade to: ${planName}`);

        // Example implementation options:

        // Option 1: Redirect to upgrade page
        // window.location.href = `/upgrade?plan=${planName.toLowerCase()}`;

        // Option 2: Call your API endpoint
        // fetch('/api/upgrade/initiate', {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify({ plan: planName })
        // }).then(response => response.json())
        //   .then(data => window.location.href = data.checkoutUrl);

        // Option 3: Show confirmation for now
        alert(`Upgrading to ${planName} plan. This will redirect to payment processing.`);
    };

    useEffect(() => {
        const config = useConfig();
        let url = config("AUTOMATE_API_URL") + '/api/v1/dashboard';
        api.get(url, {
            signal: controller.signal,
            headers: {
                "Authorization": "Bearer " + token,
            }
        })
            .then(response => {
                if (response) {
                    setUserDashboard(response.data);
                }
            })
    }, []);

    return (
        <Container>
            <div className={"header"}>{auth.user ? "Welcome, " + auth.user?.name : ""}</div>


            <div className={"card-container"}>
                <Card>
                    <UsageBillingWidget data={{
                        currentUsage: userDashboard ? userDashboard.usage : 0,
                        monthlyLimit: userDashboard ? userDashboard.allowance : 0,
                        billingPeriod: "Monthly",
                        nextBillingDate: "2025-10-21",
                        currentCost: 0.00
                    }} />
                </Card>
            </div>

            <div className={"card-container"}>
                <Card>
                    <TipWidget />
                </Card>
                <Card>
                    <SupportWidget />
                </Card>
            </div>

            {/*<div className={"card-container"}>*/}
            {/*    <Card></Card>*/}
            {/*    <Card></Card>*/}
            {/*    <Card></Card>*/}
            {/*</div>*/}
            {/*<div className={"card-container"}>*/}
            {/*    <Card>*/}
            {/*        /!*<SubscriptionUpgradeWidget />*!/*/}
            {/*    </Card>*/}
            {/*</div>*/}
        </Container>
    )
}