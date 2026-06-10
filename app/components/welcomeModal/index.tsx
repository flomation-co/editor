import { useEffect, useState } from "react";
import { useAuth } from "~/context/auth/use";
import useConfig from "~/components/config";
import api from "~/lib/api";
import "./index.css";

// WelcomeModal is mounted alongside EulaModal in root.tsx. It surfaces
// the post-EULA welcome flow described in plans/marketing_optin.md:
// the user confirms their display name (pre-populated from whatever
// SSO / signup process set it) and optionally opts into marketing
// emails. On submit, both choices are pushed atomically via
// /user/welcome-complete; the API stamps welcome_completed_at so the
// modal never re-appears.
//
// Visibility rule: user is authenticated, has accepted the EULA
// (eula_accepted_at populated), and has NOT yet completed the welcome
// (welcome_completed_at NULL). The EULA gate matters because we
// don't want this modal racing the EULA modal — they're sequential
// gates, not parallel.
//
// Display name is hard-required to dismiss the modal; marketing opt-in
// is genuinely optional with no nag if the user leaves it unchecked.
export default function WelcomeModal() {
  const { user, setUser, token } = useAuth();
  const config = useConfig();

  const [visible, setVisible] = useState(false);
  const [name, setName] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !token) return;
    if (!user.eula_accepted_at) return;          // EULA gate must clear first
    if (user.welcome_completed_at) return;       // Already done — never show
    setName(user.name ?? "");
    setVisible(true);
  }, [user, token]);

  const trimmedName = name.trim();
  const canSubmit = trimmedName.length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    try {
      const API_URL = config("AUTOMATE_API_URL");
      await api.post(
        API_URL + "/api/v1/user/welcome-complete",
        { name: trimmedName, marketing_opt_in: marketingOptIn },
        { headers: { Authorization: "Bearer " + token } }
      );

      if (user) {
        setUser({
          ...user,
          name: trimmedName,
          marketing_opt_in: marketingOptIn,
          welcome_completed_at: new Date().toISOString(),
        });
      }
      setVisible(false);
    } catch (e: unknown) {
      setError("Couldn't save — please try again.");
      setSubmitting(false);
    }
  };

  if (!visible || !user) return null;

  return (
    <div className="welcome-overlay">
      <div className="welcome-panel">
        <div className="welcome-header">
          <svg
            className="welcome-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
          <h2 className="welcome-title">Welcome to Flomation</h2>
        </div>

        <div className="welcome-body">
          Just two quick things before you dive in.
        </div>

        <div className="welcome-form">
          <div className="welcome-field">
            <label className="welcome-field-label" htmlFor="welcome-name">
              Display name
            </label>
            <input
              id="welcome-name"
              className="welcome-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="How should we address you?"
              autoFocus
              maxLength={120}
            />
            <span className="welcome-field-hint">
              Shown in your profile and on shared content. You can change this later.
            </span>
          </div>

          <label className="welcome-checkbox-row">
            <input
              className="welcome-checkbox"
              type="checkbox"
              checked={marketingOptIn}
              onChange={(e) => setMarketingOptIn(e.target.checked)}
            />
            <span className="welcome-checkbox-text">
              Send me occasional product updates and tips by email
              <span className="welcome-checkbox-subtext">
                We'll never share your email. Unsubscribe any time from your profile.
              </span>
            </span>
          </label>

          {error && (
            <div style={{ color: "#f87171", fontSize: 13 }}>{error}</div>
          )}
        </div>

        <div className="welcome-footer">
          <button
            className="welcome-btn-primary"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {submitting ? "Saving..." : "Get started"}
          </button>
        </div>
      </div>
    </div>
  );
}
