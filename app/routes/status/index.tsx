import type { Route } from "../+types/home";
import { useEffect, useState, useCallback } from "react";
import Container from "~/components/container";
import SupportWidget from "~/components/widgets/support-widget";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleCheck, faTriangleExclamation, faCircleXmark, faRotate } from "@fortawesome/free-solid-svg-icons";
import useConfig from "~/components/config";
import dayjs from "dayjs";
import "./index.css";

export function meta({}: Route.MetaArgs) {
    return [
        { title: "Flomation - System Status" },
        { name: "description", content: "Service health overview" },
    ];
}

type ServiceStatus = {
    name: string;
    url: string;
    description: string;
    status: "checking" | "healthy" | "unhealthy";
    version?: string;
    latencyMs?: number;
};

const config = useConfig();

export default function Status() {
    const [services, setServices] = useState<ServiceStatus[]>([]);
    const [lastChecked, setLastChecked] = useState<Date | null>(null);

    const checkServices = useCallback(async () => {
        const apiUrl = config("AUTOMATE_API_URL");
        const loginUrl = config("LOGIN_URL");
        const triggerUrl = config("TRIGGER_URL");

        const checks: ServiceStatus[] = [
            { name: "Automation API", url: apiUrl, description: "Core API for flows, executions and data", status: "checking" },
            { name: "Identity (Sentinel)", url: loginUrl, description: "Authentication and user management", status: "checking" },
            { name: "Launch Service", url: triggerUrl, description: "Trigger polling and scheduling", status: "checking" },
        ];

        setServices([...checks]);

        const results = await Promise.all(
            checks.map(async (svc) => {
                const start = performance.now();
                try {
                    const controller = new AbortController();
                    const timeout = setTimeout(() => controller.abort(), 5000);

                    let endpoint = svc.url;
                    if (svc.name === "Identity (Sentinel)") {
                        endpoint += "/health";
                    } else {
                        endpoint += "/version";
                    }

                    const res = await fetch(endpoint, { signal: controller.signal });
                    clearTimeout(timeout);
                    const latencyMs = Math.round(performance.now() - start);

                    if (res.ok) {
                        let version: string | undefined;
                        try {
                            const data = await res.json();
                            version = data.version;
                        } catch {}
                        return { ...svc, status: "healthy" as const, version, latencyMs };
                    }
                    return { ...svc, status: "unhealthy" as const, latencyMs };
                } catch {
                    const latencyMs = Math.round(performance.now() - start);
                    return { ...svc, status: "unhealthy" as const, latencyMs };
                }
            })
        );

        setServices(results);
        setLastChecked(new Date());
    }, []);

    useEffect(() => {
        checkServices();
        const interval = setInterval(checkServices, 30000);
        return () => clearInterval(interval);
    }, [checkServices]);

    const healthyCount = services.filter(s => s.status === "healthy").length;
    const checkingCount = services.filter(s => s.status === "checking").length;
    const totalCount = services.length;

    const overallStatus = checkingCount > 0
        ? "checking"
        : healthyCount === totalCount
            ? "healthy"
            : healthyCount === 0
                ? "down"
                : "degraded";

    const bannerClass = overallStatus === "healthy" ? "status-banner--healthy"
        : overallStatus === "degraded" ? "status-banner--degraded"
        : overallStatus === "down" ? "status-banner--down"
        : "status-banner--degraded";

    const bannerIcon = overallStatus === "healthy" ? faCircleCheck
        : overallStatus === "down" ? faCircleXmark
        : faTriangleExclamation;

    const bannerTitle = overallStatus === "healthy" ? "All Systems Operational"
        : overallStatus === "degraded" ? "Partial Service Disruption"
        : overallStatus === "down" ? "Service Outage Detected"
        : "Checking Services...";

    const bannerSubtitle = overallStatus === "healthy"
        ? `All ${totalCount} services are responding normally`
        : overallStatus === "degraded"
            ? `${healthyCount} of ${totalCount} services are healthy`
            : overallStatus === "down"
                ? "Unable to reach any services"
                : "Running health checks...";

    return (
        <Container>
            <div className="header">System Status</div>

            <div className="status-page">
                <div className={`status-banner ${bannerClass}`}>
                    <div className="status-banner-icon">
                        <FontAwesomeIcon icon={bannerIcon} />
                    </div>
                    <div className="status-banner-text">
                        <h3>{bannerTitle}</h3>
                        <p>{bannerSubtitle}</p>
                    </div>
                </div>

                <div className="status-section-label">Services</div>
                <div className="status-services">
                    {services.map((svc) => (
                        <div key={svc.name} className="status-card">
                            <div className={`status-card-indicator status-card-indicator--${svc.status}`} />
                            <div className="status-card-info">
                                <div className="status-card-name">{svc.name}</div>
                                <div className="status-card-url">{svc.description}</div>
                            </div>
                            <div className="status-card-meta">
                                <span className={`status-card-badge status-card-badge--${svc.status}`}>
                                    {svc.status === "checking" ? "Checking" : svc.status === "healthy" ? "Operational" : "Unreachable"}
                                </span>
                                {svc.version && (
                                    <span className="status-card-version">v{svc.version}</span>
                                )}
                                {svc.latencyMs !== undefined && svc.status !== "checking" && (
                                    <span className="status-card-latency">{svc.latencyMs}ms</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {lastChecked && (
                    <div className="status-last-checked">
                        Last checked {dayjs(lastChecked).format("HH:mm:ss")}
                        <button className="status-refresh-btn" onClick={checkServices}>
                            <FontAwesomeIcon icon={faRotate} /> Refresh
                        </button>
                    </div>
                )}

                <SupportWidget />
            </div>
        </Container>
    );
}
