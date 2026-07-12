import {createContext, useCallback, useContext, useEffect, useState} from "react";
import "./index.css";

type ToastType = "success" | "error" | "info" | "warning";

type Toast = {
    id: number;
    message: string;
    type: ToastType;
}

type ToastContextType = {
    showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

let nextId = 0;

// activeShowToast is a module-level handle to the mounted provider's showToast,
// so the imperative `toast` API below can fire from anywhere — including module
// scope and non-component code — the way react-toastify's toast() did. There is
// a single ToastProvider (mounted in root.tsx), so this is unambiguous.
let activeShowToast: ((message: string, type: ToastType) => void) | null = null;

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback((message: string, type: ToastType = "success") => {
        const id = nextId++;
        setToasts(prev => [...prev, { id, message, type }]);

        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 4000);
    }, []);

    // Publish this provider's showToast as the module-level handle used by the
    // imperative `toast` API. Cleared on unmount so a stale handle never lingers.
    useEffect(() => {
        activeShowToast = showToast;
        return () => { if (activeShowToast === showToast) activeShowToast = null; };
    }, [showToast]);

    const dismissToast = (id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div className="toast-container">
                {toasts.map(t => (
                    <div
                        key={t.id}
                        className={`toast toast-${t.type}`}
                        onClick={() => dismissToast(t.id)}
                    >
                        {t.message}
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error("useToast must be used within ToastProvider");
    }
    return context;
}

// toast is an imperative, drop-in replacement for react-toastify's `toast`
// object. It dispatches to the mounted ToastProvider from anywhere (module scope
// included), so existing `toast.success(...)` / `toast.error(...)` call sites
// work unchanged against the app's single, actually-mounted toast system. Any
// extra arguments (react-toastify's options object) are accepted and ignored.
const emit = (type: ToastType) =>
    (message: string, ..._ignored: unknown[]) => { activeShowToast?.(message, type); };

export const toast = {
    success: emit("success"),
    error: emit("error"),
    info: emit("info"),
    warning: emit("warning"),
};
