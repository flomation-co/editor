import { useState, useEffect, useCallback, useRef } from "react";
import { useTutorial } from "~/context/tutorial/use";
import { Icon } from "~/components/icons/Icon";
import "./index.css";

type StepPlacement = "bottom" | "top" | "left" | "right";

interface TutorialStep {
    selector: string;
    title: string;
    body: string;
    placement: StepPlacement;
    page: string;
    waitForSelector?: boolean;
    waitMessage?: string;
}

const STEPS: TutorialStep[] = [
    {
        selector: ".flows-action-btn--primary",
        title: "Create a New Flow",
        body: "Click \"New\" to create your first automation flow. Flows connect actions together to automate your workflows.",
        placement: "bottom",
        page: "/flow",
    },
    {
        selector: ".flo-editor-title-textbox",
        title: "Name Your Flow",
        body: "Give your flow a meaningful name so you can easily find and manage it later.",
        placement: "bottom",
        page: "/flo",
    },
    {
        selector: "[data-tooltip-id=\"tooltip-action-add-node\"]",
        title: "Add a Node",
        body: "Click \"Add Node\" to add your first action. Nodes are the building blocks of your flow — each one performs a specific task.",
        placement: "bottom",
        page: "/flo",
    },
    {
        selector: ".property-menu-expanded-wrap",
        title: "Configure Properties",
        body: "Each node has properties you can configure. Set input values, choose options, and connect data between nodes.",
        placement: "left",
        page: "/flo",
        waitForSelector: true,
        waitMessage: "Click on the node you just added to see its properties.",
    },
    {
        selector: ".flo-editor-env-button",
        title: "Choose an Environment",
        body: "Environments store variables and secrets your flow needs at runtime. Select one from the dropdown.",
        placement: "bottom",
        page: "/flo",
    },
    {
        selector: "[data-tooltip-id=\"tooltip-action-execute\"]",
        title: "Execute Your Flow",
        body: "Click \"Execute\" to run your flow. You'll see real-time progress and can inspect each node's inputs and outputs.",
        placement: "bottom",
        page: "/flo",
    },
];

const PADDING = 10;
const TOOLTIP_GAP = 12;

interface Rect {
    top: number;
    left: number;
    width: number;
    height: number;
}

export default function TutorialOverlay() {
    const { currentStep, isActive, advanceStep, skipTutorial } = useTutorial();
    const [targetRect, setTargetRect] = useState<Rect | null>(null);
    const [waiting, setWaiting] = useState(false);
    const observerRef = useRef<MutationObserver | null>(null);
    const rafRef = useRef<number>(0);

    const step = STEPS[currentStep];

    const updateRect = useCallback(() => {
        if (!step) return;
        const el = document.querySelector(step.selector);
        if (!el) {
            if (step.waitForSelector) {
                setWaiting(true);
                setTargetRect(null);
            }
            return;
        }
        setWaiting(false);
        const r = el.getBoundingClientRect();
        setTargetRect({
            top: r.top - PADDING,
            left: r.left - PADDING,
            width: r.width + PADDING * 2,
            height: r.height + PADDING * 2,
        });
    }, [step]);

    useEffect(() => {
        if (!isActive || !step) return;

        // Check if we're on the right page
        const pathname = window.location.pathname;
        if (!pathname.startsWith(step.page)) {
            setTargetRect(null);
            return;
        }

        // Initial position
        const timer = setTimeout(updateRect, 100);

        // Watch for DOM changes (element appearing/disappearing)
        observerRef.current = new MutationObserver(() => {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = requestAnimationFrame(updateRect);
        });
        observerRef.current.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["class", "style"],
        });

        // Reposition on resize/scroll
        window.addEventListener("resize", updateRect);
        window.addEventListener("scroll", updateRect, true);

        return () => {
            clearTimeout(timer);
            cancelAnimationFrame(rafRef.current);
            observerRef.current?.disconnect();
            window.removeEventListener("resize", updateRect);
            window.removeEventListener("scroll", updateRect, true);
        };
    }, [isActive, currentStep, step, updateRect]);

    if (!isActive || !step) return null;

    // Not on the right page — dormant
    const pathname = window.location.pathname;
    if (!pathname.startsWith(step.page)) return null;

    // Compute clip-path for the spotlight hole
    const clipPath = targetRect
        ? `polygon(
            0% 0%, 0% 100%, 100% 100%, 100% 0%, 0% 0%,
            ${targetRect.left}px ${targetRect.top}px,
            ${targetRect.left}px ${targetRect.top + targetRect.height}px,
            ${targetRect.left + targetRect.width}px ${targetRect.top + targetRect.height}px,
            ${targetRect.left + targetRect.width}px ${targetRect.top}px,
            ${targetRect.left}px ${targetRect.top}px
        )`
        : "none";

    // Calculate tooltip position
    const tooltipStyle: React.CSSProperties = {};
    if (targetRect) {
        switch (step.placement) {
            case "bottom":
                tooltipStyle.top = targetRect.top + targetRect.height + TOOLTIP_GAP;
                tooltipStyle.left = targetRect.left;
                break;
            case "top":
                tooltipStyle.bottom = window.innerHeight - targetRect.top + TOOLTIP_GAP;
                tooltipStyle.left = targetRect.left;
                break;
            case "left":
                tooltipStyle.top = targetRect.top;
                tooltipStyle.right = window.innerWidth - targetRect.left + TOOLTIP_GAP;
                break;
            case "right":
                tooltipStyle.top = targetRect.top;
                tooltipStyle.left = targetRect.left + targetRect.width + TOOLTIP_GAP;
                break;
        }
    } else if (waiting) {
        // Centre the tooltip when waiting for an element
        tooltipStyle.top = "50%";
        tooltipStyle.left = "50%";
        tooltipStyle.transform = "translate(-50%, -50%)";
    }

    const isLastStep = currentStep === STEPS.length - 1;

    return (
        <>
            <div
                className="tutorial-overlay"
                style={{ clipPath: targetRect ? clipPath : undefined }}
            />
            <div className="tutorial-tooltip" style={tooltipStyle}>
                <div className="tutorial-tooltip-header">
                    <span className="tutorial-step-indicator">
                        Step {currentStep + 1} of {STEPS.length}
                    </span>
                </div>
                <h3 className="tutorial-tooltip-title">{step.title}</h3>
                <p className="tutorial-tooltip-body">
                    {waiting && step.waitMessage ? step.waitMessage : step.body}
                </p>
                <div className="tutorial-progress">
                    {STEPS.map((_, i) => (
                        <div
                            key={i}
                            className={`tutorial-dot ${i <= currentStep ? "active" : ""} ${i === currentStep ? "current" : ""}`}
                        />
                    ))}
                </div>
                <div className="tutorial-actions">
                    <button className="tutorial-btn tutorial-btn--skip" onClick={skipTutorial}>
                        Skip Tutorial
                    </button>
                    {!waiting && (
                        <button className="tutorial-btn tutorial-btn--next" onClick={advanceStep}>
                            <Icon name={isLastStep ? "check" : "arrow-right"} />
                            {isLastStep ? "Finish" : "Next"}
                        </button>
                    )}
                </div>
            </div>
        </>
    );
}
