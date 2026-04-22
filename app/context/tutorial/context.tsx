import { createContext } from "react";

export interface TutorialContextType {
    currentStep: number;
    isActive: boolean;
    advanceStep: () => void;
    skipTutorial: () => void;
}

const TutorialContext = createContext<TutorialContextType | null>(null);

export default TutorialContext;
