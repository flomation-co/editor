import type {Route} from "../+types/home";
import Container from "~/components/container";
import React, {useEffect, useState} from "react";
import {useAuth} from "~/context/auth/use";
import {useOrganisation} from "~/context/organisation/use";
import useCookieToken from "~/components/cookie";
import {Icon} from "~/components/icons/Icon";
import "./index.css";
import {
    fetchPlans, fetchSubscription, fetchQuota,
    setupPaymentMethod, upgradeSubscription, downgradeSubscription, cancelSubscription,
    previewUpgrade, type UpgradePreview,
    type BillingPlan, type BillingSubscription, type QuotaResponse,
    type BillingPlanPrice,
} from "~/lib/billing";
import api from "~/lib/api";
import {billingBaseURL} from "~/lib/billing";

export function meta({}: Route.MetaArgs) {
    return [
        {title: "Flomation - Billing"},
        {name: "description", content: "Manage your subscription and billing"},
    ];
}

type Tab = "subscription" | "payment" | "invoices" | "voucher";

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
}

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
                        <span className={`billing-badge ${v.active ? (v.preloaded ? "billing-badge--trialling" : "billing-badge--active") : "billing-badge--cancelled"}`}>
                            {v.preloaded ? "preloaded" : v.active ? "active" : "used"}
                        </span>
                    </span>
                </div>
            ))}
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────

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

    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [voucherCode, setVoucherCode] = useState("");
    const [voucherResult, setVoucherResult] = useState<{ success: boolean; message: string } | null>(null);

    const [modal, setModal] = useState<ModalState>({visible: false, title: "", message: ""});
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
        ]).then(([subRes, plansRes, quotaRes, pmRes, invRes, vhRes]) => {
            if (subRes.status === "fulfilled") setSubscription(subRes.value);
            if (plansRes.status === "fulfilled") setPlans(plansRes.value);
            if (quotaRes.status === "fulfilled") setQuota(quotaRes.value);
            if (pmRes.status === "fulfilled") setPMs(pmRes.value?.data || []);
            if (vhRes.status === "fulfilled") setVoucherHistory(vhRes.value?.data || []);
            if (invRes.status === "fulfilled") setInvoices(invRes.value?.data || []);
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

    const buildOrderSummary = (plan: BillingPlan, isUpgrade: boolean) => {
        const price = plan.prices?.[0];
        if (!price) return null;
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + 1);

        // If we have server-provided preview data for an upgrade, use it.
        const p = isUpgrade ? upgradePreviewData : null;

        const chargeGross = p ? p.charge_gross : price.amount_pence;
        const creditGross = p ? p.credit_gross : 0;
        const voucherLines = p ? p.vouchers.map(v => ({label: v.label, amount: v.amount})) : [];
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
                <div className="billing-order-line" style={{fontWeight: 600}}>
                    <span className="billing-order-label">{hasProration ? "Due today (inc. VAT)" : "Total (inc. VAT)"}</span>
                    <span className="billing-order-value">{formatCurrency(totalDue)}</span>
                </div>
                {!hasProration && (
                    <div className="billing-order-line billing-order-line--muted">
                        <span className="billing-order-label">Billed {price.billing_interval}ly</span>
                        <span className="billing-order-value">{formatCurrency(price.amount_pence)} / {price.billing_interval}</span>
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
                    All prices include VAT. VAT No: GB 000 0000 00
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
            setUpgradePreviewData(preview);

            // Show modal with server data (buildOrderSummary will read upgradePreviewData).
            // Use setTimeout to let state update before rendering.
            setTimeout(() => {
                setModal({
                    visible: true,
                    title: `Upgrade to ${plan.name}`,
                    content: buildOrderSummary(plan, true),
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
            }, 0);
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
            <Container>
                <div className="header">Billing</div>
                <div className="billing-page">
                    <div className="billing-empty">Loading...</div>
                </div>
            </Container>
        );
    }

    return (
        <Container>
            <div className="header">Billing</div>

            {notification && (
                <BillingNotification
                    message={notification.message}
                    variant={notification.variant}
                    onDismiss={() => setNotification(null)}
                />
            )}

            <BillingModal modal={modal} onClose={closeModal} />

            <div className="billing-page">
                <div className="billing-tabs">
                    <button className={`billing-tab ${activeTab === "subscription" ? "active" : ""}`} onClick={() => setActiveTab("subscription")}>
                        <Icon name="star" /> Subscription
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
                                            {upgrades.map(plan => (
                                                <div key={plan.id} className="billing-plan-row">
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
                                            ))}
                                        </div>
                                    )}

                                    {downgrades.length > 0 && (
                                        <div className="billing-card">
                                            <div className="billing-section-label">Downgrade Options</div>
                                            {downgrades.map(plan => (
                                                <div key={plan.id} className="billing-plan-row">
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
                                            ))}
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
                                        <div className="billing-pm-icon">{pm.card_brand || "card"}</div>
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
        </Container>
    );
}
