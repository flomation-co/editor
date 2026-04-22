import { useState, useEffect, useCallback } from "react";
import TutorialContext from "./context";
import { useAuth } from "~/context/auth/use";
import useConfig from "~/components/config";
import api from "~/lib/api";
import useCookieToken from "~/components/cookie";

const TOTAL_STEPS = 6;

export default function TutorialProvider({ children }: { children: React.ReactNode }) {
    const { user, setUser, token } = useAuth();
    const config = useConfig();
    const cookieToken = useCookieToken();

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
    }, [user?.id]);

    const persistStep = useCallback((step: number, completed: boolean) => {
        const url = config("AUTOMATE_API_URL");
        const tkn = cookieToken || token;
        api.post(url + "/api/v1/user/onboarding", { step, completed }, {
            headers: { Authorization: "Bearer " + tkn },
        }).catch(() => {});
    }, [config, cookieToken, token]);

    const advanceStep = useCallback(() => {
        const nextStep = currentStep + 1;
        if (nextStep >= TOTAL_STEPS) {
            setIsActive(false);
            setCurrentStep(TOTAL_STEPS);
            persistStep(TOTAL_STEPS, true);
            if (user) {
                setUser({ ...user, onboarding_step: TOTAL_STEPS, onboarding_completed_at: new Date().toISOString() });
            }
        } else {
            setCurrentStep(nextStep);
            persistStep(nextStep, false);
            if (user) {
                setUser({ ...user, onboarding_step: nextStep });
            }
        }
    }, [currentStep, user, persistStep, setUser]);

    const skipTutorial = useCallback(() => {
        setIsActive(false);
        persistStep(currentStep, true);
        if (user) {
            setUser({ ...user, onboarding_completed_at: new Date().toISOString() });
        }
    }, [currentStep, user, persistStep, setUser]);

    return (
        <TutorialContext.Provider value={{ currentStep, isActive, advanceStep, skipTutorial }}>
            {children}
        </TutorialContext.Provider>
    );
}
