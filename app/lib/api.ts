import axios from "axios";
import Cookies from "js-cookie";

const ORG_STORAGE_KEY = "flomation-current-org";

const api = axios.create();

// Append organisation query parameter to API requests when in org mode.
api.interceptors.request.use((config) => {
    if (typeof window !== "undefined") {
        const orgId = localStorage.getItem(ORG_STORAGE_KEY);
        if (orgId && config.url) {
            const separator = config.url.includes("?") ? "&" : "?";
            config.url = config.url + separator + "organisation=" + encodeURIComponent(orgId);
        }
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            Cookies.remove("flomation-token");

            const loginUrl = typeof window !== "undefined"
                && window.properties
                && window.properties["LOGIN_URL"];

            if (loginUrl) {
                window.location.replace(loginUrl + "?redirect_url=" + window.location.href);
            }
        }

        if (error.response && error.response.status === 403 && typeof window !== "undefined") {
            const path = window.location.pathname;
            const segments = path.split("/").filter(Boolean);
            if (segments.length > 1) {
                window.location.replace("/" + segments[0]);
            }
        }

        return Promise.reject(error);
    }
);

export default api;
