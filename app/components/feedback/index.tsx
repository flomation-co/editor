import { useState } from "react";
import { toast } from "react-toastify";
import api from "~/lib/api";
import useConfig from "~/components/config";
import useCookieToken from "~/components/cookie";
import "./index.css";
import { Icon } from "~/components/icons/Icon";

const CATEGORIES = [
    { value: "", label: "Select a category..." },
    { value: "bug", label: "Bug Report" },
    { value: "improvement", label: "Improvement Suggestion" },
    { value: "feature", label: "Feature Request" },
    { value: "account", label: "Account Management" },
    { value: "billing", label: "Billing Management" },
    { value: "other", label: "Other" },
];

const config = useConfig();
const API_URL = config("AUTOMATE_API_URL");

export default function FeedbackButton() {
    const token = useCookieToken();
    const [open, setOpen] = useState(false);
    const [sending, setSending] = useState(false);
    const [name, setName] = useState("");
    const [subject, setSubject] = useState("");
    const [category, setCategory] = useState("");
    const [message, setMessage] = useState("");

    const canSubmit = subject.trim() && category && message.trim();

    const handleSubmit = async () => {
        if (!canSubmit || sending) return;
        setSending(true);

        try {
            await api.post(API_URL + "/api/v1/feedback", {
                name,
                subject,
                category,
                message,
                url: window.location.href,
                user_agent: navigator.userAgent,
            }, {
                headers: { Authorization: "Bearer " + token },
            });
            toast.success("Feedback submitted — thank you!");
            setOpen(false);
            setName(""); setSubject(""); setCategory(""); setMessage("");
        } catch {
            toast.error("Failed to submit feedback");
        } finally {
            setSending(false);
        }
    };

    return (
        <>
            <button className="feedback-trigger" onClick={() => setOpen(true)}>
                <Icon name="comment-dots" style={{ marginBottom: 6 }} /> Feedback
            </button>

            {open && (
                <div className="feedback-overlay" onClick={() => setOpen(false)}>
                    <div className="feedback-panel" onClick={e => e.stopPropagation()}>
                        <div className="feedback-header">
                            <h3>Send Feedback</h3>
                            <button className="feedback-close" onClick={() => setOpen(false)}>&times;</button>
                        </div>
                        <div className="feedback-body">
                            <div className="feedback-field">
                                <label>Your Name (optional)</label>
                                <input type="text" placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
                            </div>
                            <div className="feedback-field">
                                <label>Subject</label>
                                <input type="text" placeholder="Brief summary" value={subject} onChange={e => setSubject(e.target.value)} />
                            </div>
                            <div className="feedback-field">
                                <label>Category</label>
                                <select value={category} onChange={e => setCategory(e.target.value)}>
                                    {CATEGORIES.map(c => (
                                        <option key={c.value} value={c.value}>{c.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="feedback-field">
                                <label>Message</label>
                                <textarea placeholder="Tell us more..." value={message} onChange={e => setMessage(e.target.value)} />
                            </div>
                            <div className="feedback-disclaimer">
                                By submitting, your user ID, current URL, and browser information will be collected to help us investigate your feedback.
                            </div>
                        </div>
                        <div className="feedback-footer">
                            <button className="feedback-submit" onClick={handleSubmit} disabled={!canSubmit || sending}>
                                {sending ? <><Icon name="spinner" spin /> Sending...</> : "Submit Feedback"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
