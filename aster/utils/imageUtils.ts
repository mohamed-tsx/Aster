/**
 * Image utility functions for handling image URLs
 */

// Helper function to normalize backend URL (ensure it has protocol)
function normalizeBackendUrl(url: string | undefined): string {
    if (!url) {
        return "http://localhost:4321";
    }

    // Remove any trailing slashes
    url = url.trim().replace(/\/+$/, "");

    // If URL doesn't start with http:// or https://, add https://
    if (!url.match(/^https?:\/\//i)) {
        // If it starts with //, replace with https://
        if (url.startsWith("//")) {
            url = "https:" + url;
        } else {
            // Otherwise, prepend https://
            url = "https://" + url;
        }
    }

    return url;
}

// Get backend base URL for images (without /api/v1)
// Images are served from the root, not from /api/v1
function getBackendBaseUrl(): string {
    // Try dedicated backend URL first
    let url = process.env.NEXT_PUBLIC_BACKEND_URL;

    // If not set, extract from API URL (remove /api/v1)
    if (!url) {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL;
        if (apiUrl) {
            // Remove /api/v1 or /api/v1/ from the end
            url = apiUrl.replace(/\/api\/v1\/?$/, "");
        }
    }

    // If still no URL, fall back to localhost for local dev (browser only)
    if (!url && typeof window !== "undefined") {
        const hostname = window.location.hostname;
        if (hostname === "localhost" || hostname === "127.0.0.1") {
            url = "http://localhost:4321";
        }
    }

    // Fallback to localhost
    if (!url) {
        url = "http://localhost:4321";
    }

    return normalizeBackendUrl(url);
}

const BACKEND_BASE_URL = getBackendBaseUrl();

/**
 * Generate a proper image URL for any image
 * @param imagePath - The relative image path from the backend (e.g., "/uploads/products/BB-PRD-25-09-0001/cover.webp")
 * @returns Full URL to the image
 */
export function getImageUrl(imagePath: string | null | undefined): string {
    if (!imagePath) return "";

    // If it's already a full URL, return as is
    if (imagePath.startsWith("http")) {
        return imagePath;
    }

    // For relative paths, prepend the backend base URL
    return `${BACKEND_BASE_URL}${imagePath}`;
}

/**
 * Generate a proper image URL for product images
 * @param imagePath - The relative image path from the backend
 * @returns Full URL to the image
 */
export function getProductImageUrl(
    imagePath: string | null | undefined
): string {
    return getImageUrl(imagePath);
}

/**
 * Generate a proper image URL for user avatars
 * @param imagePath - The relative image path from the backend
 * @returns Full URL to the image
 */
export function getUserAvatarUrl(imagePath: string | null | undefined): string {
    // Use default avatar if no image path provided
    const defaultAvatar = "https://cdn.pixabay.com/photo/2023/02/18/11/00/icon-7797704_640.png";
    return getImageUrl(imagePath || defaultAvatar);
}

/**
 * Generate a proper image URL for author avatars
 * @param imagePath - The relative image path from the backend
 * @returns Full URL to the image
 */
export function getAuthorAvatarUrl(imagePath: string | null | undefined): string {
    // Use default avatar if no image path provided (same as user default)
    const defaultAvatar = "https://cdn.pixabay.com/photo/2023/02/18/11/00/icon-7797704_640.png";
    return getImageUrl(imagePath || defaultAvatar);
}

/**
 * Get a placeholder image URL for when no image is available
 * @param type - The type of placeholder (product, user, etc.)
 * @returns Placeholder image URL
 */
export function getPlaceholderImageUrl(
    type: "product" | "user" = "product"
): string {
    // Simple SVG placeholders
    switch (type) {
        case "product":
            return "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik01MCAzMEMzNS42NDE0IDMwIDI0IDQxLjY0MTQgMjQgNTZDMjQgNzAuMzU4NiAzNS42NDE0IDgyIDUwIDgyQzY0LjM1ODYgODIgNzYgNzAuMzU4NiA3NiA1NkM3NiA0MS42NDE0IDY0LjM1ODYgMzAgNTAgMzBaIiBmaWxsPSIjOUNBM0FGIi8+CjxwYXRoIGQ9Ik01MCA0MEM0Mi4yNjg5IDQwIDM2IDQ2LjI2ODkgMzYgNTRDMzYgNjEuNzMxMSA0Mi4yNjg5IDY4IDUwIDY4QzU3LjczMTEgNjggNjQgNjEuNzMxMSA2NCA1NEM2NCA0Ni4yNjg5IDU3LjczMTEgNDAgNTAgNDBaIiBmaWxsPSIjNjM3Mzg4Ii8+Cjwvc3ZnPgo=";
        case "user":
            return "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxjaXJjbGUgY3g9IjUwIiBjeT0iMzUiIHI9IjE1IiBmaWxsPSIjOUNBM0FGIi8+CjxwYXRoIGQ9Ik0yMCA3MEMyMCA2MS4xNjM0IDI3LjE2MzQgNTQgMzYgNTRINjRDNzIuODM2NiA1NCA4MCA2MS4xNjM0IDgwIDcwVjgwSDIwVjcwWiIgZmlsbD0iIzlDQTNBRiIvPgo8L3N2Zz4K";
        default:
            return "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik01MCAzMEMzNS42NDE0IDMwIDI0IDQxLjY0MTQgMjQgNTZDMjQgNzAuMzU4NiAzNS42NDE0IDgyIDUwIDgyQzY0LjM1ODYgODIgNzYgNzAuMzU4NiA3NiA1NkM3NiA0MS42NDE0IDY0LjM1ODYgMzAgNTAgMzBaIiBmaWxsPSIjOUNBM0FGIi8+Cjwvc3ZnPgo=";
    }
}