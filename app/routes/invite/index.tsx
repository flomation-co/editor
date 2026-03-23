import type {Route} from "../+types/home";
import {useEffect, useState} from "react";
import {useParams, useNavigate} from "react-router";
import api from "~/lib/api";
import useConfig from "~/components/config";
import useCookieToken from "~/components/cookie";
import {useOrganisation} from "~/context/organisation/use";

export function meta({}: Route.MetaArgs) {
    return [
        { title: "Flomation - Organisation Invite" },
        { name: "description", content: "Join an organisation" },
    ];
}

type InvitePreview = {
    organisation_name: string;
    role: string;
};

type InviteState = "loading" | "preview" | "accepting" | "success" | "error" | "invalid";

export default function AcceptInvite() {
    const { code } = useParams();
    const navigate = useNavigate();
    const config = useConfig();
    const token = useCookieToken();
    const { refreshOrganisations, setCurrentOrg } = useOrganisation();

    const [state, setState] = useState<InviteState>("loading");
    const [preview, setPreview] = useState<InvitePreview | null>(null);
    const [orgName, setOrgName] = useState("");
    const [errorMessage, setErrorMessage] = useState("");

    const API_URL = config("AUTOMATE_API_URL");
    const LOGIN_URL = config("LOGIN_URL");

    // Fetch invite preview (no auth required)
    useEffect(() => {
        if (!code || !API_URL) return;

        // If returning from login with acceptance intent, go straight to accepting
        const acceptanceKey = `flomation-invite-accept:${code}`;
        if (token && localStorage.getItem(acceptanceKey)) {
            setState("accepting");
            acceptInvite();
            return;
        }

        api.get(`${API_URL}/api/v1/invite/${code}`)
            .then(response => {
                setPreview(response.data);
                setState("preview");
            })
            .catch(() => {
                setState("invalid");
            });
    }, [code, API_URL]);

    function acceptInvite() {
        if (!code || !API_URL) return;

        const acceptanceKey = `flomation-invite-accept:${code}`;

        if (!token) {
            // Store acceptance intent and redirect to login
            localStorage.setItem(acceptanceKey, "true");
            const redirectUrl = `${window.location.origin}/invite/${code}`;
            if (LOGIN_URL) {
                window.location.replace(`${LOGIN_URL}?redirect_url=${encodeURIComponent(redirectUrl)}`);
            }
            return;
        }

        setState("accepting");

        api.post(`${API_URL}/api/v1/invite/${code}/accept`, {}, {
            headers: { Authorization: "Bearer " + token }
        })
            .then(response => {
                // Clear acceptance intent
                localStorage.removeItem(acceptanceKey);

                setState("success");
                setOrgName(response.data?.name || "the organisation");
                refreshOrganisations();

                if (response.data) {
                    setCurrentOrg({
                        id: response.data.id,
                        name: response.data.name,
                        icon: response.data.icon,
                        role: "member",
                    });
                }

                setTimeout(() => navigate("/organisation"), 2000);
            })
            .catch(error => {
                localStorage.removeItem(acceptanceKey);
                setState("error");
                if (error.response?.status === 404) {
                    setErrorMessage("This invite link is invalid or has expired.");
                } else {
                    setErrorMessage("Unable to accept invite. Please try again.");
                }
            });
    }

    function handleDismiss() {
        window.location.replace("https://www.flomation.co");
    }

    return (
        <div style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "radial-gradient(ellipse at top left, #1a0a24 0%, #0d0912 50%, #060409 100%)",
        }}>
            <div style={{
                width: "100%",
                maxWidth: "460px",
                margin: "0 20px",
                borderRadius: "16px",
                overflow: "hidden",
                background: "linear-gradient(180deg, rgba(70, 0, 112, 0.15) 0%, rgba(30, 20, 40, 0.9) 100%)",
                border: "1px solid rgba(174, 159, 185, 0.2)",
                boxShadow: "0 24px 80px rgba(70, 0, 112, 0.3), 0 0 0 1px rgba(70, 0, 112, 0.1)",
            }}>
                {/* Header with logo */}
                <div style={{
                    padding: "32px 32px 24px",
                    textAlign: "center",
                    borderBottom: "1px solid rgba(174, 159, 185, 0.1)",
                }}>
                    <img
                        src="/flomation_logo_dark.gif"
                        alt="Flomation"
                        style={{ height: "32px", marginBottom: "8px" }}
                    />
                </div>

                {/* Body */}
                <div style={{ padding: "32px" }}>
                    {state === "loading" && (
                        <div style={{ textAlign: "center" }}>
                            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "15px" }}>
                                Loading invite details...
                            </p>
                        </div>
                    )}

                    {state === "invalid" && (
                        <div style={{ textAlign: "center" }}>
                            <div style={{
                                width: "56px",
                                height: "56px",
                                borderRadius: "50%",
                                background: "rgba(248, 113, 113, 0.1)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                margin: "0 auto 20px",
                                fontSize: "24px",
                            }}>
                                &#10006;
                            </div>
                            <p style={{
                                color: "#f87171",
                                fontSize: "16px",
                                fontWeight: 600,
                                marginBottom: "8px",
                            }}>
                                Invalid Invite
                            </p>
                            <p style={{
                                color: "rgba(255,255,255,0.5)",
                                fontSize: "14px",
                                lineHeight: "1.5",
                                marginBottom: "24px",
                            }}>
                                This invite link is invalid or has already been used.
                            </p>
                            <button
                                onClick={handleDismiss}
                                style={{
                                    padding: "10px 24px",
                                    borderRadius: "8px",
                                    border: "1px solid rgba(174, 159, 185, 0.3)",
                                    background: "transparent",
                                    color: "rgba(255,255,255,0.7)",
                                    cursor: "pointer",
                                    fontSize: "14px",
                                }}
                            >
                                Go to Flomation
                            </button>
                        </div>
                    )}

                    {state === "preview" && preview && (
                        <div style={{ textAlign: "center" }}>
                            <div style={{
                                width: "56px",
                                height: "56px",
                                borderRadius: "50%",
                                background: "linear-gradient(135deg, #460070, #00aa9c)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                margin: "0 auto 20px",
                                fontSize: "24px",
                                color: "#fff",
                                fontWeight: 700,
                            }}>
                                {preview.organisation_name.charAt(0).toUpperCase()}
                            </div>
                            <p style={{
                                color: "rgba(255,255,255,0.5)",
                                fontSize: "13px",
                                textTransform: "uppercase",
                                letterSpacing: "1px",
                                marginBottom: "8px",
                            }}>
                                You've been invited to join
                            </p>
                            <p style={{
                                color: "#fff",
                                fontSize: "22px",
                                fontWeight: 700,
                                marginBottom: "8px",
                            }}>
                                {preview.organisation_name}
                            </p>
                            <p style={{
                                color: "rgba(255,255,255,0.4)",
                                fontSize: "13px",
                                marginBottom: "32px",
                            }}>
                                as <span style={{
                                    color: "#00aa9c",
                                    fontWeight: 600,
                                    textTransform: "capitalize",
                                }}>{preview.role}</span>
                            </p>

                            <div style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "10px",
                            }}>
                                <button
                                    onClick={acceptInvite}
                                    style={{
                                        padding: "12px 24px",
                                        borderRadius: "10px",
                                        border: "none",
                                        background: "linear-gradient(135deg, #460070, #5a0090)",
                                        color: "#fff",
                                        cursor: "pointer",
                                        fontSize: "15px",
                                        fontWeight: 600,
                                        transition: "all 0.2s ease",
                                        boxShadow: "0 4px 16px rgba(70, 0, 112, 0.4)",
                                    }}
                                >
                                    Accept Invite
                                </button>
                                <button
                                    onClick={handleDismiss}
                                    style={{
                                        padding: "12px 24px",
                                        borderRadius: "10px",
                                        border: "1px solid rgba(174, 159, 185, 0.2)",
                                        background: "transparent",
                                        color: "rgba(255,255,255,0.6)",
                                        cursor: "pointer",
                                        fontSize: "14px",
                                        transition: "all 0.2s ease",
                                    }}
                                >
                                    Dismiss
                                </button>
                            </div>
                        </div>
                    )}

                    {state === "accepting" && (
                        <div style={{ textAlign: "center" }}>
                            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "15px" }}>
                                Accepting invite...
                            </p>
                        </div>
                    )}

                    {state === "success" && (
                        <div style={{ textAlign: "center" }}>
                            <div style={{
                                width: "56px",
                                height: "56px",
                                borderRadius: "50%",
                                background: "rgba(74, 222, 128, 0.1)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                margin: "0 auto 20px",
                                fontSize: "24px",
                                color: "#4ade80",
                            }}>
                                &#10003;
                            </div>
                            <p style={{
                                color: "#4ade80",
                                fontSize: "18px",
                                fontWeight: 600,
                                marginBottom: "8px",
                            }}>
                                You've joined {orgName}!
                            </p>
                            <p style={{
                                color: "rgba(255,255,255,0.5)",
                                fontSize: "14px",
                            }}>
                                Redirecting to organisation page...
                            </p>
                        </div>
                    )}

                    {state === "error" && (
                        <div style={{ textAlign: "center" }}>
                            <div style={{
                                width: "56px",
                                height: "56px",
                                borderRadius: "50%",
                                background: "rgba(248, 113, 113, 0.1)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                margin: "0 auto 20px",
                                fontSize: "24px",
                                color: "#f87171",
                            }}>
                                &#10006;
                            </div>
                            <p style={{
                                color: "#f87171",
                                fontSize: "16px",
                                marginBottom: "24px",
                            }}>
                                {errorMessage}
                            </p>
                            <button
                                onClick={handleDismiss}
                                style={{
                                    padding: "10px 24px",
                                    borderRadius: "8px",
                                    border: "1px solid rgba(174, 159, 185, 0.3)",
                                    background: "transparent",
                                    color: "rgba(255,255,255,0.7)",
                                    cursor: "pointer",
                                    fontSize: "14px",
                                }}
                            >
                                Go to Flomation
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: "16px 32px",
                    borderTop: "1px solid rgba(174, 159, 185, 0.1)",
                    textAlign: "center",
                }}>
                    <a
                        href="https://www.flomation.co"
                        style={{
                            color: "rgba(255,255,255,0.3)",
                            fontSize: "12px",
                            textDecoration: "none",
                        }}
                    >
                        www.flomation.co
                    </a>
                </div>
            </div>
        </div>
    );
}
