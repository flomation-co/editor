import type {Route} from "../+types/home";
import Container from "~/components/container";
import type {HelpContent} from "~/components/helpPane";
import React, {useEffect, useState} from "react";
import {useAuth} from "~/context/auth/use";
import {useOrganisation} from "~/context/organisation/use";
import useCookieToken from "~/components/cookie";
import {Icon} from "~/components/icons/Icon";
import ProtectedRoute from "~/components/protected-route";
import {PERMISSIONS} from "~/types";
import "./index.css";
import {
    fetchPlans, fetchSubscription, fetchQuota,
    setupPaymentMethod, upgradeSubscription, downgradeSubscription, cancelSubscription,
    previewUpgrade, type UpgradePreview,
    type BillingPlan, type BillingSubscription, type QuotaResponse,
    type BillingPlanPrice,
    type CreditAccount, type CreditTransaction,
    fetchCreditAccount, fetchCreditTransactions, purchaseCredit, previewCreditPurchase, updateCreditSettings,
    type CreditPurchasePreview,
} from "~/lib/billing";
import api from "~/lib/api";
import {billingBaseURL} from "~/lib/billing";

export function meta({}: Route.MetaArgs) {
    return [
        {title: "Flomation - Billing"},
        {name: "description", content: "Manage your subscription and billing"},
    ];
}

type Tab = "subscription" | "payment" | "invoices" | "voucher" | "credits";

function cardBrandIcon(brand?: string): React.ReactNode {
    switch (brand?.toLowerCase()) {
        case "visa":
            return <svg viewBox="0 0 48 32" width="32" height="20"><path fill="#1A1F71" d="M19.5 21.5h-3.2l2-12.3h3.2l-2 12.3zm13.4-12c-.6-.3-1.6-.5-2.9-.5-3.2 0-5.4 1.7-5.4 4.1 0 1.8 1.6 2.8 2.8 3.4 1.2.6 1.7 1 1.7 1.5 0 .8-1 1.2-1.9 1.2-1.3 0-2-.2-3-.7l-.4-.2-.5 2.8c.8.3 2.2.6 3.6.6 3.4 0 5.6-1.7 5.6-4.2 0-1.4-.8-2.5-2.7-3.3-1.1-.6-1.8-1-1.8-1.5 0-.5.6-1 1.8-1 1 0 1.8.2 2.4.5l.3.1.4-2.8zm8.3-.3h-2.5c-.8 0-1.3.2-1.7 1l-4.7 11.3h3.4l.7-1.8h4.1l.4 1.8h3l-2.7-12.3zm-4 8l1.7-4.6.9 4.6h-2.6zM16 9.2l-3 8.4-.3-1.6c-.6-1.9-2.3-4-4.3-5l2.9 11h3.4l5.1-12.8H16z"/><path fill="#F9A533" d="M10.4 9.2H5.1l-.1.3c4 1 6.7 3.5 7.8 6.5l-1.1-5.7c-.2-.8-.8-1-1.3-1.1z"/></svg>;
        case "mastercard":
            return <svg viewBox="0 0 48 32" width="32" height="20"><circle cx="18" cy="16" r="10" fill="#EB001B"/><circle cx="30" cy="16" r="10" fill="#F79E1B"/><path d="M24 8.8a10 10 0 0 0-3.7 7.2A10 10 0 0 0 24 23.2a10 10 0 0 0 3.7-7.2A10 10 0 0 0 24 8.8z" fill="#FF5F00"/></svg>;
        case "amex":
            return <svg viewBox="0 0 48 32" width="32" height="20"><rect width="48" height="32" rx="4" fill="#2E77BC"/><text x="24" y="19" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold" fontFamily="sans-serif">AMEX</text></svg>;
        default:
            return <svg viewBox="0 0 48 32" width="32" height="20"><rect width="48" height="32" rx="4" fill="rgba(255,255,255,0.1)"/><text x="24" y="19" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="8" fontFamily="sans-serif">{brand?.toUpperCase() || "CARD"}</text></svg>;
    }
}

interface PaymentMethod {
    id: string;
    card_last4?: string;
    card_brand?: string;
    card_exp_month?: number;
    card_exp_year?: number;
    is_default: boolean;
}

interface Invoice {
    id: string;
    invoice_number: string;
    status: string;
    currency: string;
    total_pence: number;
    period_start: string;
    period_end: string;
    paid_at?: string;
    created_at: string;
}

interface ModalState {
    visible: boolean;
    title: string;
    message?: string;
    content?: React.ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: "primary" | "danger";
    onConfirm?: () => void;
}

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("en-GB", {
        day: "numeric", month: "short", year: "numeric",
    });
}

function formatCurrency(pence: number, currency: string = "GBP"): string {
    const symbol = currency === "GBP" ? "\u00a3" : currency === "USD" ? "$" : currency === "EUR" ? "\u20ac" : currency + " ";
    return `${symbol}${(pence / 100).toFixed(2)}`;
}

const ENTITLEMENT_LABELS: Record<string, string> = {
    execution_minutes: "Execution Minutes / Month",
    flow_count: "Flows",
    runner_count: "Runners",
    agent_count: "AI Agents",
    org_members: "Organisation Members",
    mfa_enabled: "Multi-Factor Authentication",
    rbac_enabled: "Role-Based Access Control",
    sso_enabled: "Single Sign-On (SSO)",
};

function statusBadgeClass(status: string): string {
    switch (status) {
        case "active": return "billing-badge--active";
        case "trialling": return "billing-badge--trialling";
        case "past_due": return "billing-badge--past-due";
        case "cancelled":
        case "expired": return "billing-badge--cancelled";
        default: return "";
    }
}

// ── Modal component ───────────────────────────────────────────────────

function BillingModal({modal, onClose}: { modal: ModalState; onClose: () => void }) {
    if (!modal.visible) return null;

    return (
        <div className="billing-modal-overlay" onClick={onClose}>
            <div className="billing-modal" onClick={e => e.stopPropagation()}>
                <div className="billing-modal-header">
                    <h3>{modal.title}</h3>
                    <button className="billing-modal-close" onClick={onClose}>
                        <Icon name="xmark" />
                    </button>
                </div>
                <div className="billing-modal-body">
                    {modal.content ? modal.content : <p>{modal.message}</p>}
                </div>
                <div className="billing-modal-footer">
                    <button className="billing-btn billing-btn--secondary" onClick={onClose}>
                        {modal.cancelLabel || "Cancel"}
                    </button>
                    {modal.onConfirm && (
                        <button
                            className={`billing-btn ${modal.variant === "danger" ? "billing-btn--danger" : "billing-btn--primary"}`}
                            onClick={() => { modal.onConfirm?.(); onClose(); }}
                        >
                            {modal.confirmLabel || "Confirm"}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Notification toast ────────────────────────────────────────────────

function BillingNotification({message, variant, onDismiss}: { message: string; variant: "success" | "error"; onDismiss: () => void }) {
    useEffect(() => {
        const timer = setTimeout(onDismiss, 5000);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div className={`billing-notification billing-notification--${variant}`} onClick={onDismiss}>
            <Icon name={variant === "success" ? "check-circle" : "circle-exclamation"} />
            <span>{message}</span>
        </div>
    );
}

// ── Voucher history component ─────────────────────────────────────────

interface VoucherHistoryItem {
    code: string;
    description?: string;
    discount_type: string;
    discount_value: number;
    months_remaining?: number;
    redeemed_at: string;
    active: boolean;
    preloaded: boolean;
    // status is the server-computed badge state. Older API responses may
    // omit it, in which case the renderer falls back to the active/
    // preloaded booleans to derive a sensible label.
    status?: "ready" | "used" | "expired";
}

// VOUCHER_STATUS_LABELS / VOUCHER_STATUS_BADGE_CLASSES are the visible
// rendering of the three server-side states. Centralised here so a future
// re-style touches one place rather than every voucher row.
const VOUCHER_STATUS_LABELS: Record<string, string> = {
    ready: "READY",
    used: "USED",
    expired: "EXPIRED",
};

const VOUCHER_STATUS_BADGE_CLASSES: Record<string, string> = {
    ready: "billing-badge--active",
    used: "billing-badge--cancelled",
    expired: "billing-badge--expired",
};

function VoucherHistory({token}: { token: string | null }) {
    const [history, setHistory] = useState<VoucherHistoryItem[]>([]);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        if (!token) return;
        const base = billingBaseURL();
        api.get(base + "/api/v1/billing/voucher/history", {
            headers: {"Authorization": "Bearer " + token},
        }).then(res => {
            setHistory(res.data || []);
            setLoaded(true);
        }).catch(() => setLoaded(true));
    }, []);

    if (!loaded) return <div className="billing-empty">Loading...</div>;
    if (history.length === 0) return <div className="billing-empty">No vouchers have been used.</div>;

    return (
        <div className="billing-invoice-list">
            {history.map((v, i) => (
                <div key={i} className="billing-invoice-row">
                    <span className="billing-invoice-number" style={{flex: 1}}>{v.code}</span>
                    <span className="billing-invoice-date">
                        {v.discount_type === "percentage" ? `${v.discount_value}% off` : formatCurrency(v.discount_value) + " off"}
                    </span>
                    <span className="billing-invoice-date">
                        {v.months_remaining !== null && v.months_remaining !== undefined
                            ? `${v.months_remaining} month${v.months_remaining !== 1 ? "s" : ""} remaining`
                            : "Ongoing"}
                    </span>
                    <span className="billing-invoice-date">{formatDate(v.redeemed_at)}</span>
                    <span className="billing-invoice-status">
                        {(() => {
                            // Prefer the server-computed `status`; fall
                            // back to the legacy `active`/`preloaded`
                            // booleans only if a stale API response is
                            // missing the new field (deploy-skew safety).
                            const status = v.status ?? (v.active ? "ready" : "used");
                            const label = VOUCHER_STATUS_LABELS[status] ?? status.toUpperCase();
                            const badgeClass = VOUCHER_STATUS_BADGE_CLASSES[status] ?? "billing-badge--cancelled";
                            return (
                                <span className={`billing-badge ${badgeClass}`}>
                                    {label}
                                </span>
                            );
                        })()}
                    </span>
                </div>
            ))}
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────

const BILLING_HELP: HelpContent = {
    title: "About Billing",
    intro: "Everything about your subscription in one place: your plan, what you are using and your invoices.",
    points: [
        "See your current plan and what it includes",
        "Upgrade, downgrade or cancel when you need to",
        "Add or update your payment card",
        "Download past invoices",
    ],
    tip: "Upgrades take effect straight away; downgrades and cancellations apply at the end of your billing period.",
};

export default function Billing() {
    const auth = useAuth();
    const {currentOrg, isOrgMode} = useOrganisation();
    const token = useCookieToken();
    const [activeTab, setActiveTab] = useState<Tab>("subscription");

    const [subscription, setSubscription] = useState<BillingSubscription | null>(null);
    const [plans, setPlans] = useState<BillingPlan[]>([]);
    const [quota, setQuota] = useState<QuotaResponse | null>(null);
    const [paymentMethods, setPMs] = useState<PaymentMethod[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [voucherHistory, setVoucherHistory] = useState<VoucherHistoryItem[]>([]);

    const [creditAccount, setCreditAccount] = useState<CreditAccount | null>(null);
    const [creditTransactions, setCreditTransactions] = useState<CreditTransaction[]>([]);
    const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
    const [purchaseAmount, setPurchaseAmount] = useState<number>(1000);
    const [topupThreshold, setTopupThreshold] = useState<number>(500);
    const [topupAmount, setTopupAmount] = useState<number>(1000);
    const [autoTopupEnabled, setAutoTopupEnabled] = useState(false);

    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [voucherCode, setVoucherCode] = useState("");
    const [voucherResult, setVoucherResult] = useState<{ success: boolean; message: string } | null>(null);

    const [modal, setModal] = useState<ModalState>({visible: false, title: "", message: ""});

    // Top-up confirmation modal — separate from the generic modal because the
    // voucher input is interactive (Apply re-fetches the preview), which means
    // the modal body has to react to live state. The generic setModal pattern
    // snapshots its content at open-time so we'd lose voucher updates if we
    // tried to share it.
    const [creditModalOpen, setCreditModalOpen] = useState(false);
    const [creditPreview, setCreditPreview] = useState<CreditPurchasePreview | null>(null);
    const [creditVoucherCode, setCreditVoucherCode] = useState("");
    const [creditVoucherError, setCreditVoucherError] = useState<string | null>(null);
    const [creditPreviewLoading, setCreditPreviewLoading] = useState(false);
    const [notification, setNotification] = useState<{ message: string; variant: "success" | "error" } | null>(null);

    const closeModal = () => setModal(m => ({...m, visible: false}));
    const notify = (message: string, variant: "success" | "error") => setNotification({message, variant});

    const currentPrice: BillingPlanPrice | undefined = subscription
        ? plans.flatMap(p => p.prices).find(pr => pr.plan_id === subscription.plan_id)
        : undefined;

    const currentPlanName = plans.find(p => p.id === subscription?.plan_id)?.name
        ?? (quota?.plan_slug ? quota.plan_slug.charAt(0).toUpperCase() + quota.plan_slug.slice(1) : "Start");

    useEffect(() => {
        if (!token) return;
        const controller = new AbortController();
        const base = billingBaseURL();

        Promise.allSettled([
            fetchSubscription(token, controller.signal),
            fetchPlans(token, controller.signal),
            fetchQuota(token, controller.signal),
            api.get(base + "/api/v1/billing/payment-method", {
                signal: controller.signal,
                headers: {"Authorization": "Bearer " + token},
            }),
            api.get(base + "/api/v1/billing/invoice", {
                signal: controller.signal,
                headers: {"Authorization": "Bearer " + token},
            }),
            api.get(base + "/api/v1/billing/voucher/history", {
                signal: controller.signal,
                headers: {"Authorization": "Bearer " + token},
            }),
            fetchCreditAccount(token, controller.signal),
            fetchCreditTransactions(token, controller.signal),
        ]).then(([subRes, plansRes, quotaRes, pmRes, invRes, vhRes, creditRes, txRes]) => {
            if (subRes.status === "fulfilled") setSubscription(subRes.value);
            if (plansRes.status === "fulfilled") setPlans(plansRes.value);
            if (quotaRes.status === "fulfilled") setQuota(quotaRes.value);
            if (pmRes.status === "fulfilled") setPMs(pmRes.value?.data || []);
            if (vhRes.status === "fulfilled") setVoucherHistory(vhRes.value?.data || []);
            if (invRes.status === "fulfilled") setInvoices(invRes.value?.data || []);
            if (creditRes.status === "fulfilled") {
                const ca = creditRes.value as CreditAccount;
                setCreditAccount(ca);
                setAutoTopupEnabled(ca.auto_topup);
                setTopupThreshold(ca.topup_threshold_pence || 500);
                setTopupAmount(ca.topup_amount_pence || 1000);
            }
            if (txRes.status === "fulfilled") setCreditTransactions(txRes.value as CreditTransaction[]);
            setLoading(false);
        });

        // Check for setup success redirect.
        const params = new URLSearchParams(window.location.search);
        if (params.get("setup") === "success") {
            setActiveTab("payment");
            notify("Payment method added successfully.", "success");
            window.history.replaceState({}, "", "/billing?tab=payment");
        }
        if (params.get("tab")) {
            setActiveTab(params.get("tab") as Tab);
        }

        return () => controller.abort();
    }, []);

    // ── Actions ───────────────────────────────────────────────────────

    const handleAddPaymentMethod = async () => {
        if (!token) return;
        setActionLoading(true);
        try {
            const url = await setupPaymentMethod(
                token,
                window.location.origin + "/billing?tab=payment&setup=success",
                window.location.origin + "/billing?tab=payment",
                auth.user?.email_address,
                auth.user?.name,
                isOrgMode ? currentOrg?.name : undefined,
            );
            window.location.href = url;
        } catch {
            notify("Failed to start payment method setup. Please try again.", "error");
        } finally {
            setActionLoading(false);
        }
    };

    const handleDeletePM = (pmId: string) => {
        setModal({
            visible: true,
            title: "Remove Payment Method",
            message: "Are you sure you want to remove this payment method? This cannot be undone.",
            confirmLabel: "Remove",
            variant: "danger",
            onConfirm: async () => {
                if (!token) return;
                try {
                    const base = billingBaseURL();
                    await api.delete(base + "/api/v1/billing/payment-method/" + pmId, {
                        headers: {"Authorization": "Bearer " + token},
                    });
                    setPMs(pms => pms.filter(p => p.id !== pmId));
                    notify("Payment method removed.", "success");
                } catch {
                    notify("Failed to remove payment method.", "error");
                }
            },
        });
    };

    const handleSetDefaultPM = async (pmId: string) => {
        if (!token) return;
        try {
            const base = billingBaseURL();
            await api.post(base + "/api/v1/billing/payment-method/" + pmId + "/default", {}, {
                headers: {"Authorization": "Bearer " + token},
            });
            setPMs(pms => pms.map(p => ({...p, is_default: p.id === pmId})));
            notify("Default payment method updated.", "success");
        } catch {
            notify("Failed to update default payment method.", "error");
        }
    };

    const defaultPM = paymentMethods.find(pm => pm.is_default) || paymentMethods[0];

    const [upgradePreviewData, setUpgradePreviewData] = useState<UpgradePreview | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);

    const buildOrderSummary = (plan: BillingPlan, isUpgrade: boolean, previewData?: UpgradePreview | null) => {
        const price = plan.prices?.[0];
        if (!price) return null;
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + 1);

        // Use server-provided preview data if available.
        const p = previewData || null;

        const chargeGross = p ? p.charge_gross : price.amount_pence;
        const creditGross = p ? p.credit_gross : 0;
        const voucherLines = p && p.vouchers ? p.vouchers.map(v => ({label: v.label, amount: v.amount})) : [];
        const totalDue = p ? p.total_due : price.amount_pence;
        const subtotalNet = p ? p.subtotal_net : Math.round(price.amount_pence / 1.20);
        const vatPence = p ? p.vat_amount : price.amount_pence - subtotalNet;
        const hasProration = p ? p.is_prorated : false;
        const remainingDaysDisplay = p ? p.remaining_days : 0;
        const effectiveDate = p ? p.effective_date : new Date().toISOString().split("T")[0];

        return (
            <div className="billing-order-summary">
                <div className="billing-order-line">
                    <span className="billing-order-label">{plan.name} Plan (monthly, inc. VAT)</span>
                    <span className="billing-order-value">{formatCurrency(price.amount_pence)}</span>
                </div>
                {hasProration && remainingDaysDisplay < 28 && (
                    <div className="billing-order-line billing-order-line--muted">
                        <span className="billing-order-label">Prorated for {remainingDaysDisplay} day{remainingDaysDisplay !== 1 ? "s" : ""} remaining</span>
                        <span className="billing-order-value">{formatCurrency(chargeGross)}</span>
                    </div>
                )}
                {hasProration && creditGross > 0 && (
                    <div className="billing-order-line billing-order-line--credit">
                        <span className="billing-order-label">Credit for unused {currentPlanName}</span>
                        <span className="billing-order-value">-{formatCurrency(creditGross)}</span>
                    </div>
                )}
                {voucherLines.map((vl, i) => (
                    <div key={i} className="billing-order-line billing-order-line--voucher">
                        <span className="billing-order-label">{vl.label}</span>
                        <span className="billing-order-value">-{formatCurrency(vl.amount)}</span>
                    </div>
                ))}
                <div className="billing-order-divider" />
                <div className="billing-order-line billing-order-line--muted">
                    <span className="billing-order-label">Subtotal (ex. VAT)</span>
                    <span className="billing-order-value">{formatCurrency(subtotalNet)}</span>
                </div>
                <div className="billing-order-line billing-order-line--muted">
                    <span className="billing-order-label">VAT (20%)</span>
                    <span className="billing-order-value">{formatCurrency(vatPence)}</span>
                </div>
                <div className="billing-order-divider" />
                <div className="billing-order-total">
                    <span className="billing-order-total-label">{hasProration ? "Due today (inc. VAT)" : "Total (inc. VAT)"}</span>
                    <span className="billing-order-total-value">{formatCurrency(totalDue)}</span>
                </div>
                {!hasProration && (
                    <div className="billing-order-line billing-order-line--muted">
                        <span className="billing-order-label">Billed {price.billing_interval}ly *</span>
                        <span className="billing-order-value">{formatCurrency(price.amount_pence)} / {price.billing_interval}</span>
                    </div>
                )}
                {voucherLines.length > 0 && !hasProration && (
                    <div className="billing-order-asterisk">
                        * Recurring charge may be lower while active vouchers are applied
                    </div>
                )}
                <div className="billing-order-line billing-order-line--muted">
                    <span className="billing-order-label">{isUpgrade ? "Effective immediately" : "Effective from"}</span>
                    <span className="billing-order-value">
                        {isUpgrade ? formatDate(effectiveDate) : formatDate(subscription?.current_period_end || endDate.toISOString())}
                    </span>
                </div>
                <div className="billing-order-divider" />
                {defaultPM ? (
                    <div className="billing-order-line">
                        <span className="billing-order-label">Payment method</span>
                        <span className="billing-order-value">
                            {defaultPM.card_brand?.toUpperCase()} &bull;&bull;&bull;&bull; {defaultPM.card_last4}
                        </span>
                    </div>
                ) : (
                    <div className="billing-order-warning">
                        <Icon name="exclamation-triangle" />
                        <span>No payment method on file. Please add a card on the Payment tab first.</span>
                    </div>
                )}
                <div className="billing-order-vat-note">
                    All prices include VAT. VAT No: 517 5918 67
                </div>
            </div>
        );
    };

    // refreshCreditPreview fetches the server-calculated breakdown for the
    // current purchaseAmount + optional voucherCode. On 400 (invalid voucher)
    // it surfaces the message inline and re-fetches the preview without the
    // voucher so the user still sees a sensible order summary.
    const refreshCreditPreview = async (voucherCode?: string) => {
        if (!token) return;
        setCreditPreviewLoading(true);
        setCreditVoucherError(null);
        try {
            const preview = await previewCreditPurchase(token, purchaseAmount, voucherCode || undefined);
            setCreditPreview(preview);
        } catch (err: unknown) {
            const msg = (err as {response?: {data?: {error?: string}}})?.response?.data?.error
                || "Unable to load purchase preview.";
            if (voucherCode) {
                setCreditVoucherError(msg);
                try {
                    const fallback = await previewCreditPurchase(token, purchaseAmount);
                    setCreditPreview(fallback);
                } catch {
                    // already showing the voucher error; nothing further to do.
                }
            } else {
                notify(msg, "error");
            }
        } finally {
            setCreditPreviewLoading(false);
        }
    };

    const openCreditPurchaseModal = async () => {
        setCreditVoucherCode("");
        setCreditVoucherError(null);
        setCreditPreview(null);
        setCreditModalOpen(true);
        await refreshCreditPreview();
    };

    const confirmCreditPurchase = async () => {
        if (!token) return;
        setActionLoading(true);
        try {
            await purchaseCredit(token, purchaseAmount, creditVoucherCode.trim() || undefined);
            notify("Credit purchased successfully.", "success");
            const updated = await fetchCreditAccount(token);
            setCreditAccount(updated);
            const txs = await fetchCreditTransactions(token);
            setCreditTransactions(txs);
            setCreditModalOpen(false);
        } catch (err: unknown) {
            const msg = (err as {response?: {data?: {error?: string}}})?.response?.data?.error
                || "Failed to purchase credit.";
            notify(msg, "error");
        } finally {
            setActionLoading(false);
        }
    };

    // buildCreditOrderSummary renders the credit-purchase modal body. It mirrors
    // the subscription order summary (line items, VAT breakdown, voucher line,
    // payment method) but adds an interactive voucher input — vouchers are
    // applied on a per-purchase basis for top-ups, unlike subscriptions where
    // they're attached at sign-up.
    const buildCreditOrderSummary = () => {
        const p = creditPreview;
        const grossNet = p ? p.subtotal_net : 0;
        const discountNet = p ? p.discount_net : 0;
        const vat = p ? p.vat_amount : 0;
        const totalDue = p ? p.total_due : purchaseAmount;
        const vouchers = p?.vouchers ?? [];
        const paymentMethod = p?.payment_method;
        // The manual code is only "applied" if it's in the vouchers list
        // — distinguishes between "user typed it and it stacked" vs
        // "vouchers came purely from existing redemptions". The Remove
        // button only makes sense for the manual case.
        const manualCodeEntered = creditVoucherCode.trim();
        const manualVoucherApplied = manualCodeEntered !== "" &&
            vouchers.some(v => v.code === manualCodeEntered);

        return (
            <div className="billing-order-summary">
                <div className="billing-order-line">
                    <span className="billing-order-label">Execution credit top-up</span>
                    <span className="billing-order-value">{formatCurrency(purchaseAmount)}</span>
                </div>
                {vouchers.map((v, i) => (
                    <div key={i} className="billing-order-line billing-order-line--voucher">
                        <span className="billing-order-label">{v.label}</span>
                        <span className="billing-order-value">-{formatCurrency(v.amount)}</span>
                    </div>
                ))}
                <div className="billing-order-divider" />
                <div className="billing-order-line billing-order-line--muted">
                    <span className="billing-order-label">Subtotal (ex. VAT)</span>
                    <span className="billing-order-value">{formatCurrency(grossNet - discountNet)}</span>
                </div>
                <div className="billing-order-line billing-order-line--muted">
                    <span className="billing-order-label">VAT (20%)</span>
                    <span className="billing-order-value">{formatCurrency(vat)}</span>
                </div>
                <div className="billing-order-divider" />
                <div className="billing-order-total">
                    <span className="billing-order-total-label">Total (inc. VAT)</span>
                    <span className="billing-order-total-value">{formatCurrency(totalDue)}</span>
                </div>
                <div className="billing-order-divider" />

                <div style={{marginTop: 8, marginBottom: 8}}>
                    <label style={{fontSize: 12, color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 6}}>
                        Voucher code (optional)
                    </label>
                    <div style={{display: "flex", gap: 8}}>
                        <input
                            type="text"
                            className="billing-voucher-input"
                            style={{flex: 1, textTransform: "uppercase"}}
                            placeholder="Enter code"
                            value={creditVoucherCode}
                            onChange={e => setCreditVoucherCode(e.target.value.toUpperCase())}
                            disabled={creditPreviewLoading}
                        />
                        {manualVoucherApplied ? (
                            <button
                                className="billing-btn billing-btn--secondary"
                                onClick={() => {
                                    setCreditVoucherCode("");
                                    refreshCreditPreview();
                                }}
                                disabled={creditPreviewLoading}
                            >
                                Remove
                            </button>
                        ) : (
                            <button
                                className="billing-btn billing-btn--secondary"
                                onClick={() => refreshCreditPreview(creditVoucherCode.trim())}
                                disabled={creditPreviewLoading || !creditVoucherCode.trim()}
                            >
                                {creditPreviewLoading ? "..." : "Apply"}
                            </button>
                        )}
                    </div>
                    {creditVoucherError && (
                        <div style={{fontSize: 12, color: "#ef4444", marginTop: 6}}>
                            {creditVoucherError}
                        </div>
                    )}
                </div>

                <div className="billing-order-divider" />
                {paymentMethod ? (
                    <div className="billing-order-line">
                        <span className="billing-order-label">Payment method</span>
                        <span className="billing-order-value">
                            {paymentMethod.card_brand?.toUpperCase()} &bull;&bull;&bull;&bull; {paymentMethod.card_last4}
                        </span>
                    </div>
                ) : (
                    <div className="billing-order-warning">
                        <Icon name="exclamation-triangle" />
                        <span>No payment method on file. Please add a card on the Payment tab first.</span>
                    </div>
                )}
                <div className="billing-order-vat-note">
                    All prices include VAT. VAT No: 517 5918 67
                </div>
            </div>
        );
    };

    const handleUpgrade = async (plan: BillingPlan) => {
        const price = plan.prices?.[0];
        if (!price || !token) return;

        // Fetch the server-calculated preview.
        setPreviewLoading(true);
        try {
            const preview = await previewUpgrade(token, plan.slug, price.id);

            setModal({
                visible: true,
                title: `Upgrade to ${plan.name}`,
                content: buildOrderSummary(plan, true, preview),
                confirmLabel: defaultPM ? `Confirm Upgrade` : undefined,
                variant: "primary",
                onConfirm: defaultPM ? async () => {
                    if (!token) return;
                    setActionLoading(true);
                    try {
                        await upgradeSubscription(token, plan.slug, price.id);
                        notify(`Successfully upgraded to ${plan.name}!`, "success");
                        setTimeout(() => window.location.reload(), 1500);
                    } catch {
                        notify("Upgrade failed. Please try again or contact support.", "error");
                    } finally {
                        setActionLoading(false);
                    }
                } : undefined,
            });
        } catch {
            notify("Failed to load upgrade details. Please try again.", "error");
        } finally {
            setPreviewLoading(false);
        }
    };

    const handleDowngrade = (plan: BillingPlan) => {
        const price = plan.prices?.[0];
        if (!price) return;

        setModal({
            visible: true,
            title: `Downgrade to ${plan.name}`,
            content: buildOrderSummary(plan, false),
            confirmLabel: "Confirm Downgrade",
            variant: "danger",
            onConfirm: async () => {
                if (!token) return;
                setActionLoading(true);
                try {
                    await downgradeSubscription(token, plan.slug, price.id);
                    notify(`Downgrade to ${plan.name} scheduled for end of billing period.`, "success");
                    setTimeout(() => window.location.reload(), 1500);
                } catch {
                    notify("Downgrade failed. Please try again or contact support.", "error");
                } finally {
                    setActionLoading(false);
                }
            },
        });
    };

    const handleCancel = () => {
        setModal({
            visible: true,
            title: "Cancel Subscription",
            message: "Are you sure you want to cancel? You'll retain access to all features until the end of your current billing period.",
            confirmLabel: "Cancel Subscription",
            cancelLabel: "Keep Subscription",
            variant: "danger",
            onConfirm: async () => {
                if (!token) return;
                setActionLoading(true);
                try {
                    await cancelSubscription(token);
                    notify("Subscription cancelled. You'll retain access until the end of your billing period.", "success");
                    setTimeout(() => window.location.reload(), 1500);
                } catch {
                    notify("Failed to cancel subscription. Please try again.", "error");
                } finally {
                    setActionLoading(false);
                }
            },
        });
    };

    const handleReactivate = async () => {
        if (!token || actionLoading) return;
        setActionLoading(true);
        try {
            const base = billingBaseURL();
            await api.post(base + "/api/v1/billing/subscription/reactivate", {}, {
                headers: {"Authorization": "Bearer " + token},
            });
            notify("Subscription reactivated!", "success");
            setTimeout(() => window.location.reload(), 1500);
        } catch {
            notify("Failed to reactivate. Please try again.", "error");
        } finally {
            setActionLoading(false);
        }
    };

    const handleDownloadInvoice = async (invoiceId: string, invoiceNumber: string) => {
        if (!token) return;
        try {
            const base = billingBaseURL();
            const response = await api.get(base + "/api/v1/billing/invoice/" + invoiceId + "/pdf", {
                headers: {"Authorization": "Bearer " + token},
                responseType: "blob",
            });

            // Create a download link from the blob.
            const blob = new Blob([response.data], {type: "application/pdf"});
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `${invoiceNumber}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch {
            notify("Failed to download invoice. Please try again.", "error");
        }
    };

    const handleValidateVoucher = async () => {
        if (!token || !voucherCode.trim()) return;
        setVoucherResult(null);
        try {
            const base = billingBaseURL();
            const res = await api.post(base + "/api/v1/billing/voucher/validate", {code: voucherCode.trim()}, {
                headers: {"Authorization": "Bearer " + token},
            });
            const v = res.data;
            const desc = v.discount_type === "percentage"
                ? `${v.discount_value}% off`
                : formatCurrency(v.discount_value);
            const duration = v.duration_months ? ` for ${v.duration_months} month${v.duration_months > 1 ? "s" : ""}` : "";
            setVoucherResult({success: true, message: `Valid: ${desc}${duration}`});
        } catch {
            setVoucherResult({success: false, message: "Invalid or expired voucher code"});
        }
    };

    const handleRedeemVoucher = async () => {
        if (!token || !voucherCode.trim()) return;
        setActionLoading(true);
        try {
            const base = billingBaseURL();
            await api.post(base + "/api/v1/billing/voucher/redeem", {code: voucherCode.trim()}, {
                headers: {"Authorization": "Bearer " + token},
            });
            setVoucherResult({success: true, message: "Voucher applied to your subscription!"});
            setVoucherCode("");
            notify("Voucher applied successfully!", "success");
        } catch {
            setVoucherResult({success: false, message: "Failed to apply voucher"});
        } finally {
            setActionLoading(false);
        }
    };

    // ── Render ─────────────────────────────────────────────────────────

    if (loading) {
        return (
            <Container help={BILLING_HELP}>
                <ProtectedRoute permission={PERMISSIONS.BILLING_VIEW}>
                <div className="header">Billing</div>
                <div className="billing-page">
                    <div className="billing-empty">Loading...</div>
                </div>
                </ProtectedRoute>
            </Container>
        );
    }

    return (
        <Container help={BILLING_HELP}>
            <ProtectedRoute permission={PERMISSIONS.BILLING_VIEW}>
            <div className="header">Billing</div>

            {notification && (
                <BillingNotification
                    message={notification.message}
                    variant={notification.variant}
                    onDismiss={() => setNotification(null)}
                />
            )}

            <BillingModal modal={modal} onClose={closeModal} />

            <BillingModal
                modal={{
                    visible: creditModalOpen,
                    title: `Purchase ${formatCurrency(purchaseAmount)} Credit`,
                    content: buildCreditOrderSummary(),
                    confirmLabel: creditPreview?.payment_method
                        ? (actionLoading ? "Processing..." : "Confirm Purchase")
                        : undefined,
                    variant: "primary",
                    onConfirm: creditPreview?.payment_method ? confirmCreditPurchase : undefined,
                }}
                onClose={() => setCreditModalOpen(false)}
            />

            <div className="billing-page">
                <div className="billing-tabs">
                    <button className={`billing-tab ${activeTab === "subscription" ? "active" : ""}`} onClick={() => setActiveTab("subscription")}>
                        <Icon name="star" /> Subscription
                    </button>
                    <button className={`billing-tab ${activeTab === "credits" ? "active" : ""}`} onClick={() => setActiveTab("credits")}>
                        <Icon name="coins" /> Credits
                    </button>
                    <button className={`billing-tab ${activeTab === "payment" ? "active" : ""}`} onClick={() => setActiveTab("payment")}>
                        <Icon name="shield-halved" /> Payment
                    </button>
                    <button className={`billing-tab ${activeTab === "invoices" ? "active" : ""}`} onClick={() => setActiveTab("invoices")}>
                        <Icon name="file-lines" /> Invoices
                    </button>
                    <button className={`billing-tab ${activeTab === "voucher" ? "active" : ""}`} onClick={() => setActiveTab("voucher")}>
                        <Icon name="bolt" /> Voucher
                    </button>
                </div>

                {/* ── Subscription tab ── */}
                {activeTab === "subscription" && (
                    <>
                        <div className="billing-card">
                            <div className="billing-section-label">Current Plan</div>
                            <div className="billing-plan-summary">
                                <div className="billing-plan-icon">
                                    <Icon name="bolt-lightning" />
                                </div>
                                <div>
                                    <div className="billing-plan-name">{currentPlanName}</div>
                                    <div className="billing-plan-price">
                                        {currentPrice
                                            ? `${formatCurrency(currentPrice.amount_pence)} / ${currentPrice.billing_interval}`
                                            : "Free"}
                                    </div>
                                </div>
                                {subscription?.status && subscription.status !== "none" && (
                                    <div style={{marginLeft: "auto"}}>
                                        <span className={`billing-badge ${statusBadgeClass(subscription.status)}`}>
                                            {subscription.status}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {subscription?.current_period_start && subscription.status !== "none" && (
                                <div className="billing-plan-details">
                                    <div className="billing-detail-item">
                                        <span className="billing-detail-label">Period Start</span>
                                        <span className="billing-detail-value">{formatDate(subscription.current_period_start)}</span>
                                    </div>
                                    <div className="billing-detail-item">
                                        <span className="billing-detail-label">Period End</span>
                                        <span className="billing-detail-value">{formatDate(subscription.current_period_end)}</span>
                                    </div>
                                </div>
                            )}

                            {quota?.entitlements && Object.keys(quota.entitlements).length > 0 && (
                                <div className="billing-entitlements">
                                    <div className="billing-section-label" style={{marginTop: 16}}>Plan Entitlements</div>
                                    <div className="billing-entitlement-grid">
                                        {Object.entries(quota.entitlements).map(([key, value]) => {
                                            const label = ENTITLEMENT_LABELS[key] || key.replace(/_/g, " ");
                                            let display: string;
                                            if (typeof value === "boolean") {
                                                display = value ? "Included" : "Not included";
                                            } else if (typeof value === "number") {
                                                display = value === -1 ? "Unlimited" : String(value);
                                            } else {
                                                display = String(value);
                                            }
                                            const isIncluded = value === true || (typeof value === "number" && value !== 0);
                                            const isUnlimited = typeof value === "number" && value === -1;
                                            return (
                                                <div key={key} className="billing-entitlement-item">
                                                    <span className={`billing-entitlement-icon ${isIncluded ? "included" : "excluded"}`}>
                                                        <Icon name={isIncluded ? "check" : "xmark"} />
                                                    </span>
                                                    <span className="billing-entitlement-label">{label}</span>
                                                    <span className={`billing-entitlement-value ${isUnlimited ? "unlimited" : ""}`}>{display}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {subscription?.cancel_at_period_end && subscription.status !== "none" && (
                                <div className="billing-cancel-warning">
                                    <Icon name="exclamation-triangle" />
                                    Subscription will be cancelled at the end of the current billing period.
                                    <button className="billing-btn billing-btn--secondary billing-btn--small" onClick={handleReactivate} disabled={actionLoading}>
                                        Reactivate
                                    </button>
                                </div>
                            )}
                        </div>

                        {(() => {
                            const currentAmount = currentPrice?.amount_pence || 0;
                            const upgrades = plans.filter(p => p.prices?.[0]?.amount_pence > currentAmount);
                            const downgrades = plans.filter(p => {
                                const amt = p.prices?.[0]?.amount_pence ?? 0;
                                return amt < currentAmount && subscription?.status !== "none";
                            });

                            return (
                                <>
                                    {upgrades.length > 0 && (
                                        <div className="billing-card">
                                            <div className="billing-section-label">Available Upgrades</div>
                                            {upgrades.map(plan => {
                                                const isExpanded = expandedPlanId === plan.id;
                                                return (
                                                    <div key={plan.id} className="billing-plan-row-wrapper">
                                                        <div className="billing-plan-row">
                                                            <button className="billing-plan-expand" onClick={() => setExpandedPlanId(isExpanded ? null : plan.id)}>
                                                                <Icon name={isExpanded ? "chevron-down" : "chevron-right"} />
                                                            </button>
                                                            <div className="billing-plan-row-info">
                                                                <div className="billing-plan-row-name">{plan.name}</div>
                                                                <div className="billing-plan-row-desc">
                                                                    {plan.description || `${formatCurrency(plan.prices[0].amount_pence)} / ${plan.prices[0].billing_interval}`}
                                                                </div>
                                                            </div>
                                                            <div className="billing-plan-row-price">
                                                                {formatCurrency(plan.prices[0].amount_pence)}
                                                                <span className="billing-plan-row-period">/{plan.prices[0].billing_interval}</span>
                                                            </div>
                                                            <button className="billing-btn billing-btn--primary billing-btn--small" onClick={() => handleUpgrade(plan)} disabled={actionLoading}>
                                                                Upgrade
                                                            </button>
                                                        </div>
                                                        {isExpanded && plan.entitlements?.length > 0 && (
                                                            <div className="billing-plan-entitlements-accordion">
                                                                <div className="billing-entitlement-grid">
                                                                    {plan.entitlements.map(ent => {
                                                                        const label = ENTITLEMENT_LABELS[ent.entitlement_key] || ent.entitlement_key.replace(/_/g, " ");
                                                                        let display: string;
                                                                        let isIncluded: boolean;
                                                                        let isUnlimited = false;
                                                                        if (ent.value_bool !== undefined && ent.value_bool !== null) {
                                                                            display = ent.value_bool ? "Included" : "Not included";
                                                                            isIncluded = ent.value_bool;
                                                                        } else if (ent.value_int !== undefined && ent.value_int !== null) {
                                                                            isUnlimited = ent.value_int === -1;
                                                                            display = isUnlimited ? "Unlimited" : String(ent.value_int);
                                                                            isIncluded = ent.value_int !== 0;
                                                                        } else {
                                                                            display = "—";
                                                                            isIncluded = false;
                                                                        }
                                                                        return (
                                                                            <div key={ent.entitlement_key} className="billing-entitlement-item">
                                                                                <span className={`billing-entitlement-icon ${isIncluded ? "included" : "excluded"}`}>
                                                                                    <Icon name={isIncluded ? "check" : "xmark"} />
                                                                                </span>
                                                                                <span className="billing-entitlement-label">{label}</span>
                                                                                <span className={`billing-entitlement-value ${isUnlimited ? "unlimited" : ""}`}>{display}</span>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {downgrades.length > 0 && (
                                        <div className="billing-card">
                                            <div className="billing-section-label">Downgrade Options</div>
                                            {downgrades.map(plan => {
                                                const isExpanded = expandedPlanId === plan.id;
                                                return (
                                                    <div key={plan.id} className="billing-plan-row-wrapper">
                                                        <div className="billing-plan-row">
                                                            <button className="billing-plan-expand" onClick={() => setExpandedPlanId(isExpanded ? null : plan.id)}>
                                                                <Icon name={isExpanded ? "chevron-down" : "chevron-right"} />
                                                            </button>
                                                            <div className="billing-plan-row-info">
                                                                <div className="billing-plan-row-name">{plan.name}</div>
                                                                <div className="billing-plan-row-desc">
                                                                    {plan.prices[0].amount_pence === 0
                                                                        ? "Free"
                                                                        : `${formatCurrency(plan.prices[0].amount_pence)} / ${plan.prices[0].billing_interval}`}
                                                                </div>
                                                            </div>
                                                            <div className="billing-plan-row-price">
                                                                {plan.prices[0].amount_pence === 0 ? "Free" : formatCurrency(plan.prices[0].amount_pence)}
                                                                {plan.prices[0].amount_pence > 0 && <span className="billing-plan-row-period">/{plan.prices[0].billing_interval}</span>}
                                                            </div>
                                                            <button className="billing-btn billing-btn--secondary billing-btn--small" onClick={() => handleDowngrade(plan)} disabled={actionLoading}>
                                                                Downgrade
                                                            </button>
                                                        </div>
                                                        {isExpanded && plan.entitlements?.length > 0 && (
                                                            <div className="billing-plan-entitlements-accordion">
                                                                <div className="billing-entitlement-grid">
                                                                    {plan.entitlements.map(ent => {
                                                                        const label = ENTITLEMENT_LABELS[ent.entitlement_key] || ent.entitlement_key.replace(/_/g, " ");
                                                                        let display: string;
                                                                        let isIncluded: boolean;
                                                                        let isUnlimited = false;
                                                                        if (ent.value_bool !== undefined && ent.value_bool !== null) {
                                                                            display = ent.value_bool ? "Included" : "Not included";
                                                                            isIncluded = ent.value_bool;
                                                                        } else if (ent.value_int !== undefined && ent.value_int !== null) {
                                                                            isUnlimited = ent.value_int === -1;
                                                                            display = isUnlimited ? "Unlimited" : String(ent.value_int);
                                                                            isIncluded = ent.value_int !== 0;
                                                                        } else {
                                                                            display = "—";
                                                                            isIncluded = false;
                                                                        }
                                                                        return (
                                                                            <div key={ent.entitlement_key} className="billing-entitlement-item">
                                                                                <span className={`billing-entitlement-icon ${isIncluded ? "included" : "excluded"}`}>
                                                                                    <Icon name={isIncluded ? "check" : "xmark"} />
                                                                                </span>
                                                                                <span className="billing-entitlement-label">{label}</span>
                                                                                <span className={`billing-entitlement-value ${isUnlimited ? "unlimited" : ""}`}>{display}</span>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </>
                            );
                        })()}

                        {subscription && subscription.status === "active" && subscription.status !== "none" && !subscription.cancel_at_period_end && currentPrice && currentPrice.amount_pence > 0 && (
                            <div className="billing-card">
                                <div className="billing-section-label">Cancel Subscription</div>
                                <p style={{fontSize: 13, color: "rgba(255,255,255,0.45)", marginBottom: 14}}>
                                    You'll retain access to all features until the end of your current billing period.
                                </p>
                                <button className="billing-btn billing-btn--danger" onClick={handleCancel} disabled={actionLoading}>
                                    Cancel Subscription
                                </button>
                            </div>
                        )}
                    </>
                )}

                {/* ── Payment tab ── */}
                {activeTab === "payment" && (
                    <div className="billing-card">
                        <div className="billing-card-header">
                            <div className="billing-card-title">Payment Methods</div>
                            <button className="billing-btn billing-btn--primary billing-btn--small" onClick={handleAddPaymentMethod} disabled={actionLoading}>
                                <Icon name="plus" /> Add Card
                            </button>
                        </div>

                        {paymentMethods.length === 0 ? (
                            <div className="billing-empty">
                                No payment methods on file. Add a card to subscribe to a paid plan.
                            </div>
                        ) : (
                            <div className="billing-pm-list">
                                {paymentMethods.map(pm => (
                                    <div key={pm.id} className="billing-pm-item">
                                        <div className="billing-pm-icon" title={pm.card_brand || "card"}>{cardBrandIcon(pm.card_brand)}</div>
                                        <div className="billing-pm-details">
                                            <div className="billing-pm-number">&bull;&bull;&bull;&bull; &bull;&bull;&bull;&bull; &bull;&bull;&bull;&bull; {pm.card_last4 || "????"}</div>
                                            <div className="billing-pm-expiry">
                                                Expires {pm.card_exp_month?.toString().padStart(2, "0")}/{pm.card_exp_year}
                                            </div>
                                        </div>
                                        {pm.is_default && <span className="billing-pm-default">Default</span>}
                                        <div className="billing-pm-actions">
                                            {!pm.is_default && (
                                                <button className="billing-btn billing-btn--secondary billing-btn--small" onClick={() => handleSetDefaultPM(pm.id)}>
                                                    Set Default
                                                </button>
                                            )}
                                            <button className="billing-btn billing-btn--danger billing-btn--small" onClick={() => handleDeletePM(pm.id)}>
                                                Remove
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ── Invoices tab ── */}
                {activeTab === "invoices" && (
                    <div className="billing-card">
                        <div className="billing-card-title" style={{marginBottom: 18}}>Invoice History</div>

                        {invoices.length === 0 ? (
                            <div className="billing-empty">No invoices yet.</div>
                        ) : (
                            <div className="billing-invoice-list">
                                {invoices.map(inv => (
                                    <div key={inv.id} className="billing-invoice-row">
                                        <span className="billing-invoice-number">{inv.invoice_number}</span>
                                        <span className="billing-invoice-date">{formatDate(inv.created_at)}</span>
                                        <span className="billing-invoice-amount">{formatCurrency(inv.total_pence, inv.currency)}</span>
                                        <span className="billing-invoice-status">
                                            <span className={`billing-badge ${inv.status === "paid" ? "billing-badge--active" : "billing-badge--past-due"}`}>
                                                {inv.status}
                                            </span>
                                        </span>
                                        <button
                                            className="billing-btn billing-btn--secondary billing-btn--small"
                                            onClick={() => handleDownloadInvoice(inv.id, inv.invoice_number)}
                                            title="Download PDF"
                                        >
                                            <Icon name="file-export" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ── Voucher tab ── */}
                {/* ── Credits tab ── */}
                {activeTab === "credits" && (
                    <>
                    {/* Balance card */}
                    <div className="billing-card">
                        <div className="billing-section-label">Credit Balance</div>
                        <div className="billing-credit-balance">
                            <span className="billing-credit-amount">{formatCurrency(creditAccount?.balance_pence ?? 0)}</span>
                            <span className={`billing-badge ${
                                (creditAccount?.balance_pence ?? 0) > 500 ? "billing-badge--active" :
                                (creditAccount?.balance_pence ?? 0) > 0 ? "billing-badge--trialling" :
                                "billing-badge--cancelled"
                            }`}>
                                {(creditAccount?.balance_pence ?? 0) > 500 ? "Healthy" :
                                 (creditAccount?.balance_pence ?? 0) > 0 ? "Low" : "Empty"}
                            </span>
                        </div>
                        <p style={{fontSize: 13, color: "rgba(255,255,255,0.35)", marginTop: 8}}>
                            Credits are used when your subscription execution allowance is exceeded.
                        </p>
                    </div>

                    {/* Purchase credits */}
                    <div className="billing-card">
                        <div className="billing-card-title" style={{marginBottom: 18}}>Purchase Credits</div>
                        <p style={{fontSize: 13, color: "rgba(255,255,255,0.45)", marginBottom: 16}}>
                            Add credit to your account. Minimum purchase is £5.00. All prices include VAT.
                        </p>

                        <div className="billing-credit-presets">
                            {[500, 1000, 2000, 5000].map(amount => (
                                <button
                                    key={amount}
                                    className={`billing-btn ${purchaseAmount === amount ? "billing-btn--primary" : "billing-btn--secondary"}`}
                                    onClick={() => setPurchaseAmount(amount)}
                                >
                                    {formatCurrency(amount)}
                                </button>
                            ))}
                        </div>

                        <div style={{display: "flex", gap: 12, alignItems: "center", marginTop: 16}}>
                            <div style={{position: "relative", flex: 1}}>
                                <span style={{position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.4)", fontSize: 14}}>£</span>
                                <input
                                    type="number"
                                    className="billing-voucher-input"
                                    style={{paddingLeft: 28, width: "100%"}}
                                    placeholder="Custom amount"
                                    value={(purchaseAmount / 100).toFixed(2)}
                                    onChange={e => {
                                        const val = Math.round(parseFloat(e.target.value || "0") * 100);
                                        setPurchaseAmount(val);
                                    }}
                                    min="5"
                                    step="0.01"
                                />
                            </div>
                            <button
                                className="billing-btn billing-btn--primary"
                                disabled={actionLoading || purchaseAmount < 500}
                                onClick={openCreditPurchaseModal}
                            >
                                {actionLoading ? "Processing..." : `Purchase ${formatCurrency(purchaseAmount)}`}
                            </button>
                        </div>
                    </div>

                    {/* Auto top-up settings */}
                    <div className="billing-card">
                        <div className="billing-card-title" style={{marginBottom: 18}}>Auto Top-up</div>
                        <p style={{fontSize: 13, color: "rgba(255,255,255,0.45)", marginBottom: 16}}>
                            Automatically top up your credit balance when it falls below a threshold. Minimum values are £5.00.
                        </p>

                        <div style={{display: "flex", alignItems: "center", gap: 12, marginBottom: 16}}>
                            <label className="billing-credit-toggle">
                                <input
                                    type="checkbox"
                                    checked={autoTopupEnabled}
                                    onChange={e => setAutoTopupEnabled(e.target.checked)}
                                />
                                <span className="billing-credit-toggle-slider" />
                            </label>
                            <span style={{fontSize: 14, color: "rgba(255,255,255,0.7)"}}>
                                {autoTopupEnabled ? "Enabled" : "Disabled"}
                            </span>
                        </div>

                        {autoTopupEnabled && (
                            <div style={{display: "flex", gap: 16, marginBottom: 16}}>
                                <div style={{flex: 1}}>
                                    <label style={{fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 4, display: "block"}}>
                                        When balance falls below
                                    </label>
                                    <div style={{position: "relative"}}>
                                        <span style={{position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.4)", fontSize: 14}}>£</span>
                                        <input
                                            type="number"
                                            className="billing-voucher-input"
                                            style={{paddingLeft: 28, width: "100%"}}
                                            value={(topupThreshold / 100).toFixed(2)}
                                            onChange={e => setTopupThreshold(Math.round(parseFloat(e.target.value || "0") * 100))}
                                            min="5"
                                            step="0.01"
                                        />
                                    </div>
                                </div>
                                <div style={{flex: 1}}>
                                    <label style={{fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 4, display: "block"}}>
                                        Top up by
                                    </label>
                                    <div style={{position: "relative"}}>
                                        <span style={{position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.4)", fontSize: 14}}>£</span>
                                        <input
                                            type="number"
                                            className="billing-voucher-input"
                                            style={{paddingLeft: 28, width: "100%"}}
                                            value={(topupAmount / 100).toFixed(2)}
                                            onChange={e => setTopupAmount(Math.round(parseFloat(e.target.value || "0") * 100))}
                                            min="5"
                                            step="0.01"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        <button
                            className="billing-btn billing-btn--primary billing-btn--small"
                            disabled={actionLoading}
                            onClick={async () => {
                                if (!token) return;
                                setActionLoading(true);
                                try {
                                    await updateCreditSettings(token, {
                                        auto_topup: autoTopupEnabled,
                                        topup_threshold_pence: autoTopupEnabled ? topupThreshold : 0,
                                        topup_amount_pence: autoTopupEnabled ? topupAmount : 0,
                                    });
                                    notify("Auto top-up settings saved.", "success");
                                    const updated = await fetchCreditAccount(token);
                                    setCreditAccount(updated);
                                } catch {
                                    notify("Failed to save auto top-up settings.", "error");
                                } finally {
                                    setActionLoading(false);
                                }
                            }}
                        >
                            Save Settings
                        </button>
                    </div>

                    {/* Transaction history */}
                    <div className="billing-card">
                        <div className="billing-card-title" style={{marginBottom: 18}}>Transaction History</div>
                        {creditTransactions.length === 0 ? (
                            <div className="billing-empty">No transactions yet.</div>
                        ) : (
                            <div className="billing-invoice-list">
                                {creditTransactions.map(tx => (
                                    <div key={tx.id} className="billing-invoice-row">
                                        <span className="billing-invoice-date" style={{minWidth: 90}}>{formatDate(tx.created_at)}</span>
                                        <span style={{flex: 1, fontSize: 13, color: "rgba(255,255,255,0.6)"}}>
                                            {tx.description || tx.transaction_type}
                                        </span>
                                        <span style={{
                                            fontSize: 13,
                                            fontWeight: 600,
                                            color: tx.amount_pence >= 0 ? "#34d399" : "#f87171",
                                            minWidth: 80,
                                            textAlign: "right",
                                        }}>
                                            {tx.amount_pence >= 0 ? "+" : ""}{formatCurrency(Math.abs(tx.amount_pence))}
                                        </span>
                                        <span style={{fontSize: 12, color: "rgba(255,255,255,0.3)", minWidth: 80, textAlign: "right"}}>
                                            Bal: {formatCurrency(tx.balance_after)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    </>
                )}

                {activeTab === "voucher" && (
                    <>
                    <div className="billing-card">
                        <div className="billing-card-title" style={{marginBottom: 18}}>Redeem a Voucher</div>
                        <p style={{fontSize: 13, color: "rgba(255,255,255,0.45)", marginBottom: 16}}>
                            Enter a voucher or promotional code to apply a discount to your subscription.
                        </p>

                        <div className="billing-voucher-form">
                            <input
                                type="text"
                                className="billing-voucher-input"
                                placeholder="Enter voucher code"
                                value={voucherCode}
                                onChange={e => {
                                    setVoucherCode(e.target.value);
                                    setVoucherResult(null);
                                }}
                                onKeyDown={e => e.key === "Enter" && handleValidateVoucher()}
                            />
                            <button className="billing-btn billing-btn--secondary" onClick={handleValidateVoucher} disabled={!voucherCode.trim()}>
                                Validate
                            </button>
                            <button className="billing-btn billing-btn--primary" onClick={handleRedeemVoucher} disabled={!voucherResult?.success || actionLoading}>
                                Apply
                            </button>
                        </div>

                        {voucherResult && (
                            <div className={`billing-voucher-result ${voucherResult.success ? "billing-voucher-result--success" : "billing-voucher-result--error"}`}>
                                {voucherResult.message}
                            </div>
                        )}
                    </div>

                    <div className="billing-card">
                        <div className="billing-card-title" style={{marginBottom: 18}}>Voucher History</div>
                        <div id="voucher-history-container">
                            <VoucherHistory token={token} />
                        </div>
                    </div>
                    </>
                )}
            </div>
            </ProtectedRoute>
        </Container>
    );
}
