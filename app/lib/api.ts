import axios from "axios";
import Cookies from "js-cookie";

const api = axios.create();

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

        return Promise.reject(error);
    }
);

export default api;
