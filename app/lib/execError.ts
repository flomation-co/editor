import type {AxiosError} from "axios";

// executionErrorMessage extracts a human-friendly message from a failed flow
// execution request. When the API blocks execution because the acting
// organisation has not completed its legal details (HTTP 403,
// organisation_legal_details_required), it returns that specific guidance so
// the user knows to complete the details in Organisation settings; otherwise it
// returns the API's message, or the supplied fallback.
export function executionErrorMessage(error: unknown, fallback = "Failed to run flow"): string {
    const err = error as AxiosError<{ error?: string; message?: string }>;
    const data = err?.response?.data;
    if (data?.error === "organisation_legal_details_required") {
        return (
            data.message ||
            "This organisation must complete its legal details before its flows can run. An administrator can add them in Organisation settings."
        );
    }
    if (data?.message) return data.message;
    return fallback;
}
