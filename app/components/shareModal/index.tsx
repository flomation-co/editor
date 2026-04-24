import React, { useState } from "react";
import { Icon } from "~/components/icons/Icon";
import useConfig from "~/components/config";
import useCookieToken from "~/components/cookie";
import { useAuth } from "~/context/auth/use";
import api from "~/lib/api";
import "./index.css";

interface ShareModalProps {
    visible: boolean;
    onDismiss: () => void;
    url?: string;
    title?: string;
    text?: string;
    onShared?: () => void;
}

const DEFAULT_URL = "https://www.flomation.co";
const DEFAULT_TEXT = "Check out Flomation — a powerful workflow automation platform that connects your tools, teams, and processes into seamless flows.";

export default function ShareModal({ visible, onDismiss, url, title, text, onShared }: ShareModalProps) {
    const { token } = useAuth();
    const config = useConfig();
    const cookieToken = useCookieToken();

    const [copied, setCopied] = useState(false);
    const [emailTo, setEmailTo] = useState("");
    const [emailMessage, setEmailMessage] = useState("");
    const [emailSending, setEmailSending] = useState(false);
    const [emailSent, setEmailSent] = useState(false);
    const [emailError, setEmailError] = useState("");

    if (!visible) return null;

    const shareUrl = url || DEFAULT_URL;
    const shareText = text || DEFAULT_TEXT;
    const shareTitle = title || "Share Flomation";

    const handleShare = (platform: string) => {
        const encoded = encodeURIComponent(shareUrl);
        const encodedText = encodeURIComponent(shareText);
        let targetUrl = "";

        switch (platform) {
            case "twitter":
                targetUrl = `https://x.com/intent/tweet?text=${encodedText}&url=${encoded}`;
                break;
            case "linkedin":
                targetUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encoded}`;
                break;
            case "facebook":
                targetUrl = `https://www.facebook.com/sharer/sharer.php?u=${encoded}`;
                break;
        }

        if (targetUrl) {
            window.open(targetUrl, "_blank", "noopener,noreferrer,width=600,height=400");
        }
        onShared?.();
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        onShared?.();
    };

    const handleSendEmail = () => {
        if (!emailTo.trim() || emailSending) return;
        setEmailSending(true);
        setEmailError("");

        const apiUrl = config("AUTOMATE_API_URL");
        const tkn = cookieToken || token;
        api.post(`${apiUrl}/api/v1/user/share`, {
            to: emailTo.trim(),
            message: emailMessage.trim(),
        }, {
            headers: { Authorization: "Bearer " + tkn },
        })
            .then(() => {
                setEmailSent(true);
                setEmailTo("");
                setEmailMessage("");
                onShared?.();
                setTimeout(() => setEmailSent(false), 3000);
            })
            .catch(err => {
                const msg = err?.response?.data?.error || "Failed to send email";
                setEmailError(msg);
            })
            .finally(() => setEmailSending(false));
    };

    return (
        <div className="share-modal-overlay" onClick={onDismiss}>
            <div className="share-modal" onClick={e => e.stopPropagation()}>
                <div className="share-modal-header">
                    <h3>{shareTitle}</h3>
                    <button className="share-modal-close" onClick={onDismiss}>&times;</button>
                </div>

                <div className="share-modal-section">
                    <div className="share-modal-section-label">Invite by email</div>
                    <div className="share-modal-email-form">
                        <input
                            className="share-modal-email-input"
                            type="email"
                            value={emailTo}
                            onChange={e => setEmailTo(e.target.value)}
                            placeholder="colleague@company.com"
                        />
                        <textarea
                            className="share-modal-email-message"
                            value={emailMessage}
                            onChange={e => setEmailMessage(e.target.value)}
                            placeholder="Add a personal message (optional)"
                            rows={2}
                        />
                        <button
                            className="share-modal-email-send"
                            onClick={handleSendEmail}
                            disabled={!emailTo.trim() || emailSending}
                        >
                            <Icon name="envelope" />
                            {emailSending ? "Sending..." : emailSent ? "Sent!" : "Send Invite"}
                        </button>
                        {emailError && <div className="share-modal-email-error">{emailError}</div>}
                    </div>
                </div>

                <div className="share-modal-section">
                    <div className="share-modal-section-label">Share on social</div>
                    <div className="share-modal-options">
                        <button className="share-modal-btn" onClick={() => handleShare("twitter")}>
                            <div className="share-modal-icon share-modal-icon--twitter">
                                <Icon name="x-twitter" />
                            </div>
                            <span>X / Twitter</span>
                        </button>
                        <button className="share-modal-btn" onClick={() => handleShare("linkedin")}>
                            <div className="share-modal-icon share-modal-icon--linkedin">
                                <Icon name="linkedin" />
                            </div>
                            <span>LinkedIn</span>
                        </button>
                        <button className="share-modal-btn" onClick={() => handleShare("facebook")}>
                            <div className="share-modal-icon share-modal-icon--facebook">
                                <Icon name="facebook" />
                            </div>
                            <span>Facebook</span>
                        </button>
                    </div>
                </div>

                <div className="share-modal-copy">
                    <input
                        className="share-modal-url"
                        readOnly
                        value={shareUrl}
                    />
                    <button className="share-modal-copy-btn" onClick={handleCopy}>
                        <Icon name={copied ? "check" : "copy"} />
                        {copied ? "Copied" : "Copy"}
                    </button>
                </div>
            </div>
        </div>
    );
}
