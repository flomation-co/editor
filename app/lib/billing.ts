import api from "~/lib/api";
import useConfig from "~/components/config";

export interface BillingPlan {
    id: string;
    name: string;
    slug: string;
    description?: string;
    tier_order: number;
    is_active: boolean;
    is_purchasable: boolean;
    prices: BillingPlanPrice[];
    entitlements: BillingPlanEntitlement[];
}

export interface BillingPlanPrice {
    id: string;
    plan_id: string;
    currency: string;
    amount_pence: number;
    billing_interval: string;
    label?: string;
}

export interface BillingPlanEntitlement {
    id: string;
    plan_id: string;
    entitlement_key: string;
    value_type: string;
    value_int?: number;
    value_bool?: boolean;
    value_json?: unknown;
}

export interface QuotaResponse {
    plan_slug: string;
    status: string;
    entitlements: Record<string, number | boolean | unknown>;
    usage_ms?: number;
    allowance_ms?: number;
}

export interface BillingSubscription {
    id: string;
    plan_id: string;
    status: string;
    current_period_start: string;
    current_period_end: string;
    cancel_at_period_end: boolean;
    plan?: BillingPlan;
    price?: BillingPlanPrice;
}

/**
 * Returns the billing API base URL. Falls back to the main API URL
 * if no dedicated billing URL is configured.
 */
export function billingBaseURL(): string {
    const config = useConfig();
    return config("BILLING_API_URL") || config("AUTOMATE_API_URL") || "";
}

/**
 * Returns the main API base URL for quota and dashboard endpoints.
 */
export function apiBaseURL(): string {
    const config = useConfig();
    return config("AUTOMATE_API_URL") || "";
}

/**
 * Fetch available plans from the billing service.
 */
export async function fetchPlans(token: string, signal?: AbortSignal): Promise<BillingPlan[]> {
    const url = billingBaseURL() + "/api/v1/billing/plan";
    const response = await api.get(url, {
        signal,
        headers: { "Authorization": "Bearer " + token },
    });
    return response.data || [];
}

/**
 * Fetch the user's current quota and usage from the API service.
 */
export async function fetchQuota(token: string, signal?: AbortSignal): Promise<QuotaResponse> {
    const url = apiBaseURL() + "/api/v1/quota";
    const response = await api.get(url, {
        signal,
        headers: { "Authorization": "Bearer " + token },
    });
    return response.data;
}

/**
 * Fetch the user's current subscription from the billing service.
 */
export async function fetchSubscription(token: string, signal?: AbortSignal): Promise<BillingSubscription | null> {
    try {
        const url = billingBaseURL() + "/api/v1/billing/subscription";
        const response = await api.get(url, {
            signal,
            headers: { "Authorization": "Bearer " + token },
        });
        return response.data;
    } catch {
        return null;
    }
}

/**
 * Initiate the payment method setup flow via Stripe Checkout.
 * Returns a URL to redirect the user to.
 */
export async function setupPaymentMethod(token: string, successURL: string, cancelURL: string, email?: string, name?: string): Promise<string> {
    const url = billingBaseURL() + "/api/v1/billing/payment-method/setup";
    const response = await api.post(url, {
        success_url: successURL,
        cancel_url: cancelURL,
        email: email || "",
        name: name || "",
    }, {
        headers: { "Authorization": "Bearer " + token },
    });
    return response.data.url;
}

/**
 * Create a new subscription.
 */
export async function createSubscription(
    token: string,
    planSlug: string,
    priceId: string,
    paymentMethodId?: string,
    voucherCode?: string,
): Promise<BillingSubscription> {
    const url = billingBaseURL() + "/api/v1/billing/subscription";
    const response = await api.post(url, {
        plan_slug: planSlug,
        price_id: priceId,
        payment_method_id: paymentMethodId,
        voucher_code: voucherCode,
    }, {
        headers: { "Authorization": "Bearer " + token },
    });
    return response.data;
}

/**
 * Upgrade to a new plan.
 */
export async function upgradeSubscription(token: string, planSlug: string, priceId: string): Promise<unknown> {
    const url = billingBaseURL() + "/api/v1/billing/subscription/upgrade";
    const response = await api.post(url, { plan_slug: planSlug, price_id: priceId }, {
        headers: { "Authorization": "Bearer " + token },
    });
    return response.data;
}

/**
 * Downgrade to a lower plan (effective at period end).
 */
export async function downgradeSubscription(token: string, planSlug: string, priceId: string): Promise<unknown> {
    const url = billingBaseURL() + "/api/v1/billing/subscription/downgrade";
    const response = await api.post(url, { plan_slug: planSlug, price_id: priceId }, {
        headers: { "Authorization": "Bearer " + token },
    });
    return response.data;
}

/**
 * Cancel the current subscription (at period end).
 */
export async function cancelSubscription(token: string): Promise<void> {
    const url = billingBaseURL() + "/api/v1/billing/subscription/cancel";
    await api.post(url, {}, {
        headers: { "Authorization": "Bearer " + token },
    });
}
