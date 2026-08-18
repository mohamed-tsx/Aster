import axios from "axios";
import { toast } from "sonner";

// Explicitly set the API URL to avoid Next.js interference
// Ensure URL has protocol to prevent relative URL issues
const getApiBaseUrl = () => {
    let url = process.env.NEXT_PUBLIC_API_URL;

    // If no environment variable is set, fall back to localhost for local dev
    if (!url && typeof window !== "undefined") {
        const hostname = window.location.hostname;

        if (hostname === "localhost" || hostname === "127.0.0.1") {
            url = "http://localhost:4321/api/v1";
        }
    }

    // Fallback to localhost for development
    if (!url) {
        url = "http://localhost:4321/api/v1";
    }

    // If URL doesn't start with http:// or https://, prepend https://
    if (url && !url.match(/^https?:\/\//i)) {
        const fullUrl = `https://${url}`;
        return fullUrl;
    }

    return url;
};

const API_BASE_URL = getApiBaseUrl();

// Create axios instance with default config
export const api = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
    timeout: 60000, // 60 second timeout
});

/**
 * Extracts error message from various error response formats
 * Handles: {error: ""}, {message: ""}, {error: {message: ""}}, etc.
 * @param error - The error object (could be axios error, response data, or any error)
 * @param defaultMessage - Fallback message if no error message found
 * @returns The error message string
 */
export function getErrorMessage(
    error: any,
    defaultMessage: string = "An error occurred"
): string {
    // If it's already a string, return it
    if (typeof error === "string") {
        return error;
    }

    // Check axios error response structure
    if (error?.response?.data) {
        const data = error.response.data;

        // Check for nested error.message first (e.g., {error: {message: "..."}})
        if (data.error?.message && typeof data.error.message === "string") {
            return data.error.message;
        }

        // Check for message in response.data
        if (data.message && typeof data.message === "string") {
            return data.message;
        }

        // Check if error is a string
        if (data.error && typeof data.error === "string") {
            return data.error;
        }
    }

    // Check direct response data (from res.data in success cases)
    if (error?.data) {
        // Check for nested error.message first (e.g., {error: {message: "..."}})
        if (
            error.data.error?.message &&
            typeof error.data.error.message === "string"
        ) {
            return error.data.error.message;
        }

        // Check for message in data
        if (error.data.message && typeof error.data.message === "string") {
            return error.data.message;
        }

        // Check if error is a string
        if (error.data.error && typeof error.data.error === "string") {
            return error.data.error;
        }
    }

    // Check for error object directly on root (e.g., {error: {message: "..."}})
    if (error?.error?.message && typeof error.error.message === "string") {
        return error.error.message;
    }

    // Check for message property directly on error
    if (error?.message && typeof error.message === "string") {
        return error.message;
    }

    // Check for error property directly on error
    if (error?.error && typeof error.error === "string") {
        return error.error;
    }

    // Fallback to default message
    return defaultMessage;
}

// Add request interceptor for logging
api.interceptors.request.use(
    (config) => {
        // Log the full URL being requested
        const fullUrl = config.baseURL
            ? `${config.baseURL}${config.url}`
            : config.url;
        return config;
    },
    (error) => {
        console.error("API Request Error:", error);
        return Promise.reject(error);
    }
);

/**
 * Decide whether the global interceptor should surface a toast for this error.
 * Only *unexpected* failures get a global toast — server errors (5xx), network
 * failures, and timeouts. Client errors (4xx) are left to the calling code,
 * which shows context-specific messages; auth (401) is handled by redirects.
 */
function shouldShowGlobalToast(error: any): boolean {
    if (typeof window === "undefined") return false;
    // Request was explicitly cancelled — not an error to show.
    if (axios.isCancel?.(error)) return false;

    const status = error?.response?.status;
    // No response → network error or timeout.
    if (!status) return true;
    // Surface server-side failures only.
    return status >= 500;
}

/** Friendly, non-technical message for unexpected failures. */
function friendlyErrorMessage(error: any): string {
    if (!error?.response) {
        if (error?.code === "ECONNABORTED") {
            return "The request timed out. Please try again.";
        }
        return "Unable to reach the server. Check your connection and try again.";
    }
    return "Something went wrong on our end. Please try again.";
}

// Add response interceptor for error handling
api.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        const fullUrl = error.config?.baseURL
            ? `${error.config.baseURL}${error.config.url}`
            : error.config?.url || "unknown";

        console.error("❌ API Response Error:");
        console.error("   URL:", fullUrl);
        console.error("   Status:", error.response?.status);
        console.error("   Response Data:", error.response?.data);

        // Check if we got HTML instead of JSON (Next.js 404 page)
        if (
            error.response?.data &&
            typeof error.response.data === "string" &&
            error.response.data.includes("<!DOCTYPE html>")
        ) {
            console.error("⚠️ WARNING: Received HTML response instead of JSON!");
            console.error(
                "   This means the request hit the Next.js frontend instead of the backend API."
            );
            console.error(
                "   Check that NEXT_PUBLIC_API_URL is set correctly in your production environment."
            );
            console.error("   Expected API URL:", API_BASE_URL);
        }

        // Handle specific error cases
        if (error.code === "ECONNREFUSED") {
            console.error("Backend server is not running or unreachable");
        } else if (error.code === "NETWORK_ERROR" || error.code === "ERR_NETWORK") {
            console.error("Network error - check your connection");
        } else if (error.code === "ERR_SSL_PROTOCOL_ERROR") {
            console.error("SSL Protocol Error - trying to use HTTPS instead of HTTP");
        }

        // Surface a friendly toast for unexpected failures. A stable id keeps a
        // burst of failed requests from stacking duplicate toasts.
        if (shouldShowGlobalToast(error)) {
            toast.error(friendlyErrorMessage(error), { id: "api-global-error" });
        }

        return Promise.reject(error);
    }
);

export default api;