import { useState, useRef, useCallback, useEffect } from "react";
import type { EulaResponse } from "~/types";
import { useAuth } from "~/context/auth/use";
import useConfig from "~/components/config";
import api from "~/lib/api";
import "./index.css";

export default function EulaModal() {
  const { user, setUser, token } = useAuth();
  const config = useConfig();

  const [eula, setEula] = useState<EulaResponse | null>(null);
  const [hasScrolledToEnd, setHasScrolledToEnd] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [visible, setVisible] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user || !token) return;

    const API_URL = config("AUTOMATE_API_URL");
    api
      .get(API_URL + "/api/v1/eula")
      .then((res) => {
        const data: EulaResponse = res.data;
        if (data.version && (!user.eula_version || user.eula_version < data.version)) {
          setEula(data);
          setVisible(true);
        }
      })
      .catch(() => {
        // If we can't fetch the EULA, don't block the user
      });
  }, [user, token]);

  const handleScroll = useCallback(() => {
    const el = contentRef.current;
    if (!el || hasScrolledToEnd) return;

    const threshold = 20;
    if (el.scrollHeight - el.scrollTop - el.clientHeight <= threshold) {
      setHasScrolledToEnd(true);
    }
  }, [hasScrolledToEnd]);

  // Check if content is short enough that no scroll is needed
  useEffect(() => {
    const el = contentRef.current;
    if (!el || hasScrolledToEnd) return;

    // If the content fits without scrolling, enable accept immediately
    if (el.scrollHeight <= el.clientHeight + 20) {
      setHasScrolledToEnd(true);
    }
  }, [eula]);

  const handleAccept = async () => {
    if (!eula || accepting) return;
    setAccepting(true);

    try {
      const API_URL = config("AUTOMATE_API_URL");
      await api.post(
        API_URL + "/api/v1/user/eula/accept",
        { version: eula.version },
        { headers: { Authorization: "Bearer " + token } }
      );

      if (user) {
        setUser({ ...user, eula_version: eula.version });
      }
      setVisible(false);
    } catch {
      setAccepting(false);
    }
  };

  const handleDecline = () => {
    window.location.replace("https://www.flomation.co");
  };

  if (!visible || !eula) return null;

  return (
    <div className="eula-overlay">
      <div className="eula-panel">
        <div className="eula-header">
          <svg
            className="eula-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          <h2 className="eula-title">End User Licence Agreement</h2>
          <div className="eula-meta">
            <span className="eula-version">Version {eula.version}</span>
            <span className="eula-date">
              Updated {new Date(eula.created_at).toLocaleDateString("en-GB", {
                day: "numeric", month: "long", year: "numeric",
              })}
            </span>
          </div>
        </div>

        <div
          className="eula-content"
          ref={contentRef}
          onScroll={handleScroll}
        >
          <pre className="eula-text">{eula.content}</pre>
        </div>

        {!hasScrolledToEnd && (
          <div className="eula-scroll-hint">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="eula-scroll-icon"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
            Please read the entire agreement to continue
          </div>
        )}

        <div className="eula-footer">
          <button className="eula-btn-decline" onClick={handleDecline}>
            Decline
          </button>
          <button
            className="eula-btn-accept"
            onClick={handleAccept}
            disabled={!hasScrolledToEnd || accepting}
          >
            {accepting ? "Accepting..." : "Accept"}
          </button>
        </div>
      </div>
    </div>
  );
}
