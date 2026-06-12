import { useState, useEffect, useCallback } from "react";
import TutorialContext from "./context";
import { useAuth } from "~/context/auth/use";
import useConfig from "~/components/config";
import api from "~/lib/api";
import useCookieToken from "~/components/cookie";
import { useToast } from "~/components/toast";

const TOTAL_STEPS = 7;

export default function TutorialProvider({ children }: { children: React.ReactNode }) {
    const { user, setUser, token } = useAuth();
    const config = useConfig();
    const cookieToken = useCookieToken();
    const { showToast } = useToast();

    const [currentStep, setCurrentStep] = useState(0);
    const [isActive, setIsActive] = useState(false);

    useEffect(() => {
        if (!user) return;
        if (user.onboarding_completed_at) {
            setIsActive(false);
            return;
        }
        setCurrentStep(user.onboarding_step ?? 0);
        setIsActive(true);
    }, [user]);

    // persistStep returns a Promise so callers can await the server
    // round-trip and only apply local state changes if the write
    // succeeded. The previous fire-and-forget pattern hid API
    // failures and let the optimistic state drift from the DB —
    // most visibly with Gin's `binding:"required"` 400-ing step=0.
    const persistStep = useCallback((step: number, completed: boolean) => {
        const url = config("AUTOMATE_API_URL");
        const tkn = cookieToken || token;
        return api.post(url + "/api/v1/user/onboarding", { step, completed }, {
            headers: { Authorization: "Bearer " + tkn },
        });
    }, [config, cookieToken, token]);

    const advanceStep = useCallback(async () => {
        const nextStep = currentStep + 1;
        const completed = nextStep >= TOTAL_STEPS;
        const stepToPersist = completed ? TOTAL_STEPS : nextStep;
        try {
            await persistStep(stepToPersist, completed);
        } catch {
            showToast("Couldn't save your tutorial progress, please try again", "error");
            return;
        }
        if (completed) {
            setIsActive(false);
            setCurrentStep(TOTAL_STEPS);
            if (user) {
                setUser({ ...user, onboarding_step: TOTAL_STEPS, onboarding_completed_at: new Date().toISOString() });
            }
        } else {
            setCurrentStep(nextStep);
            if (user) {
                setUser({ ...user, onboarding_step: nextStep });
            }
        }
    }, [currentStep, user, persistStep, setUser, showToast]);

    const skipTutorial = useCallback(async () => {
        try {
            await persistStep(currentStep, true);
        } catch {
            showToast("Couldn't dismiss the tutorial, please try again", "error");
            return;
        }
        setIsActive(false);
        if (user) {
            setUser({ ...user, onboarding_completed_at: new Date().toISOString() });
        }
    }, [currentStep, user, persistStep, setUser, showToast]);

    return (
        <TutorialContext.Provider value={{ currentStep, isActive, advanceStep, skipTutorial }}>
            {children}
        </TutorialContext.Provider>
    );
}
