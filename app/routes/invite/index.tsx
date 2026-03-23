import type {Route} from "../+types/home";
import Container from "~/components/container";
import {useEffect, useState} from "react";
import {useParams, useNavigate} from "react-router";
import api from "~/lib/api";
import useConfig from "~/components/config";
import useCookieToken from "~/components/cookie";
import {useOrganisation} from "~/context/organisation/use";

export function meta({}: Route.MetaArgs) {
    return [
        { title: "Flomation - Accept Invite" },
        { name: "description", content: "Join an organisation" },
    ];
}

export default function AcceptInvite() {
    const { code } = useParams();
    const navigate = useNavigate();
    const config = useConfig();
    const token = useCookieToken();
    const { refreshOrganisations, setCurrentOrg } = useOrganisation();

    const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
    const [orgName, setOrgName] = useState("");
    const [errorMessage, setErrorMessage] = useState("");

    useEffect(() => {
        if (!token || !code) return;

        const API_URL = config("AUTOMATE_API_URL");
        api.post(`${API_URL}/api/v1/invite/${code}/accept`, {}, {
            headers: { Authorization: "Bearer " + token }
        })
            .then(response => {
                setStatus("success");
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
                setStatus("error");
                if (error.response?.status === 404) {
                    setErrorMessage("This invite link is invalid or has expired.");
                } else {
                    setErrorMessage("Unable to accept invite. Please try again.");
                }
            });
    }, [token, code]);

    return (
        <Container>
            <div className={"header"}>Organisation Invite</div>
            <div style={{padding: "20px", textAlign: "center", marginTop: "40px"}}>
                {status === "loading" && (
                    <p style={{color: "rgba(255,255,255,0.6)", fontSize: "16px"}}>Accepting invite...</p>
                )}
                {status === "success" && (
                    <div>
                        <p style={{color: "#4ade80", fontSize: "18px", fontWeight: 600, marginBottom: "8px"}}>
                            You've joined {orgName}!
                        </p>
                        <p style={{color: "rgba(255,255,255,0.5)", fontSize: "14px"}}>
                            Redirecting to organisation page...
                        </p>
                    </div>
                )}
                {status === "error" && (
                    <p style={{color: "#f87171", fontSize: "16px"}}>{errorMessage}</p>
                )}
            </div>
        </Container>
    );
}
