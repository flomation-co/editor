import { useState, useEffect } from "react";
import "./index.css";

const STORAGE_KEY = "flomation-cookie-consent";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const accepted = localStorage.getItem(STORAGE_KEY);
    if (!accepted) {
      setVisible(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(STORAGE_KEY, "accepted");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="cookie-banner" role="banner" aria-label="Cookie consent">
      <div className="cookie-banner-inner">
        <div className="cookie-banner-content">
          <svg
            className="cookie-banner-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5" />
            <circle cx="8.5" cy="8.5" r="0.5" fill="currentColor" />
            <circle cx="10.5" cy="15.5" r="0.5" fill="currentColor" />
            <circle cx="15.5" cy="13.5" r="0.5" fill="currentColor" />
            <circle cx="7.5" cy="12" r="0.5" fill="currentColor" />
            <circle cx="12" cy="11.5" r="0.5" fill="currentColor" />
          </svg>
          <span className="cookie-banner-text">
            This platform uses cookies to keep you signed in and to provide a
            seamless experience. By continuing, you accept our use of cookies.
            <a
              href="https://www.flomation.co/cookies"
              target="_blank"
              rel="noopener noreferrer"
              className="cookie-banner-link"
            >
              Cookie Policy
            </a>
          </span>
        </div>
        <button className="cookie-banner-accept" onClick={handleAccept}>
          Accept
        </button>
      </div>
    </div>
  );
}
