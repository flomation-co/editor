import { useState, useEffect, useCallback, useRef } from "react";
import { useTutorial } from "~/context/tutorial/use";
import "./index.css";

type StepPlacement = "bottom" | "top" | "left" | "right";

interface TutorialStep {
    selector: string;
    title: string;
    body: string;
    placement: StepPlacement;
    page: string;
    /** Advance when the user navigates to a URL matching this prefix */
    advanceOnNavigate?: string;
    /** Advance when this selector appears in the DOM */
    advanceOnSelector?: string;
    /** Advance when the target element's value changes (input fields) */
    advanceOnInputChange?: boolean;
    /** Advance when this selector is clicked */
    advanceOnClick?: string;
}

const STEPS: TutorialStep[] = [
    {
        selector: ".flows-action-btn--primary",
        title: "Create a New Flow",
        body: "Click \"New\" to create your first automation flow.",
        placement: "bottom",
        page: "/flow",
        advanceOnNavigate: "/flo/",
    },
    {
        selector: ".flo-editor-title-textbox",
        title: "Name Your Flow",
        body: "Click the title and type a name for your flow.",
        placement: "bottom",
        page: "/flo",
        advanceOnInputChange: true,
    },
    {
        selector: "[data-tooltip-id=\"tooltip-action-add-node\"]",
        title: "Add a Node",
        body: "Click \"Add Node\" to add your first action to the flow.",
        placement: "bottom",
        page: "/flo",
        advanceOnSelector: ".react-flow__node",
    },
    {
        selector: ".property-menu-expanded-wrap",
        title: "Configure Properties",
        body: "Click on the node you added to see its properties.",
        placement: "left",
        page: "/flo",
        advanceOnSelector: ".property-menu-expanded-wrap",
    },
    {
        selector: ".flo-editor-env-button",
        title: "Choose an Environment",
        body: "Click the environment dropdown to see available environments.",
        placement: "bottom",
        page: "/flo",
        advanceOnClick: ".flo-editor-env-button",
    },
    {
        selector: "[data-tooltip-id=\"tooltip-action-execute\"]",
        title: "Execute Your Flow",
        body: "Click \"Execute\" to run your flow. You're all set!",
        placement: "bottom",
        page: "/flo",
        advanceOnNavigate: "/execution/",
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
    const observerRef = useRef<MutationObserver | null>(null);
    const rafRef = useRef<number>(0);
    const advancedRef = useRef(false);

    const step = STEPS[currentStep];

    const updateRect = useCallback(() => {
        if (!step) return;
        const el = document.querySelector(step.selector);
        if (!el) {
            setTargetRect(null);
            return;
        }
        const r = el.getBoundingClientRect();
        setTargetRect({
            top: r.top - PADDING,
            left: r.left - PADDING,
            width: r.width + PADDING * 2,
            height: r.height + PADDING * 2,
        });
    }, [step]);

    // Reset advanced flag when step changes
    useEffect(() => {
        advancedRef.current = false;
    }, [currentStep]);

    // Main effect: position tracking + action detection
    useEffect(() => {
        if (!isActive || !step) return;

        const pathname = window.location.pathname;
        if (!pathname.startsWith(step.page)) {
            setTargetRect(null);
            return;
        }

        const timer = setTimeout(updateRect, 150);

        // DOM observer for position updates and selector-based advancement
        observerRef.current = new MutationObserver(() => {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = requestAnimationFrame(() => {
                updateRect();

                // Check advanceOnSelector
                if (step.advanceOnSelector && !advancedRef.current) {
                    const el = document.querySelector(step.advanceOnSelector);
                    if (el) {
                        advancedRef.current = true;
                        setTimeout(advanceStep, 600);
                    }
                }
            });
        });
        observerRef.current.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["class", "style"],
        });

        // Navigation-based advancement
        let navInterval: ReturnType<typeof setInterval> | null = null;
        if (step.advanceOnNavigate) {
            const target = step.advanceOnNavigate;
            navInterval = setInterval(() => {
                if (window.location.pathname.startsWith(target) && !advancedRef.current) {
                    advancedRef.current = true;
                    advanceStep();
                }
            }, 300);
        }

        // Input change advancement
        let inputListener: (() => void) | null = null;
        if (step.advanceOnInputChange) {
            const checkInput = () => {
                const el = document.querySelector(step.selector) as HTMLInputElement | null;
                if (el && el.value && el.value.trim().length > 0 && !advancedRef.current) {
                    advancedRef.current = true;
                    setTimeout(advanceStep, 800);
                }
            };
            inputListener = checkInput;
            document.addEventListener("input", checkInput, true);
        }

        // Click-based advancement
        let clickListener: ((e: Event) => void) | null = null;
        if (step.advanceOnClick) {
            const clickSelector = step.advanceOnClick;
            clickListener = (e: Event) => {
                const target = e.target as HTMLElement;
                if (target.closest(clickSelector) && !advancedRef.current) {
                    advancedRef.current = true;
                    setTimeout(advanceStep, 500);
                }
            };
            document.addEventListener("click", clickListener, true);
        }

        window.addEventListener("resize", updateRect);
        window.addEventListener("scroll", updateRect, true);

        return () => {
            clearTimeout(timer);
            cancelAnimationFrame(rafRef.current);
            observerRef.current?.disconnect();
            if (navInterval) clearInterval(navInterval);
            if (inputListener) document.removeEventListener("input", inputListener, true);
            if (clickListener) document.removeEventListener("click", clickListener, true);
            window.removeEventListener("resize", updateRect);
            window.removeEventListener("scroll", updateRect, true);
        };
    }, [isActive, currentStep, step, updateRect, advanceStep]);

    if (!isActive || !step) return null;

    const pathname = window.location.pathname;
    if (!pathname.startsWith(step.page)) return null;

    // Clip-path for spotlight hole
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

    // Tooltip position
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
    }

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
                    <button className="tutorial-btn tutorial-btn--skip" onClick={skipTutorial}>
                        Skip
                    </button>
                </div>
                <h3 className="tutorial-tooltip-title">{step.title}</h3>
                <p className="tutorial-tooltip-body">{step.body}</p>
                <div className="tutorial-progress">
                    {STEPS.map((_, i) => (
                        <div
                            key={i}
                            className={`tutorial-dot ${i <= currentStep ? "active" : ""} ${i === currentStep ? "current" : ""}`}
                        />
                    ))}
                </div>
            </div>
        </>
    );
}
