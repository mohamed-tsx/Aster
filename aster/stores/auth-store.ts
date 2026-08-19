import api from "@/utils/api";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface Role {
  id: string;
  name: string;
  permissions: { id: string; name: string }[];
  createdAt: string;
  updatedAt: string;
}

interface User {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  avatar: string | null;
  createdAt: string;
  updatedAt?: string;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasCheckedAuth: boolean;
  login: (
    username: string,
    password: string
  ) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearAuth: () => void;
  updateUser: (userData: Partial<User>) => void;
}

// Guards against overlapping /auth/me calls. hasCheckedAuth alone cannot do
// this: it only flips once the response lands, so two callers firing in the
// same tick (e.g. React StrictMode's double effect invocation in dev) would
// both get past it and issue duplicate requests.
let authCheckInFlight = false;

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isLoading: true,
      isAuthenticated: false,
      hasCheckedAuth: false,

      login: async (username: string, password: string) => {
        try {
          set({ isLoading: true });

          const response = await api.post("/auth/login", {
            username,
            password,
          });

          if (response.data.success) {
            set({
              user: response.data.data.user,
              isAuthenticated: true,
              isLoading: false,
              hasCheckedAuth: true,
            });
            return { success: true, message: response.data.message };
          } else {
            set({ isLoading: false });
            return { success: false, message: "Login failed" };
          }
        } catch (error: any) {
          set({ isLoading: false });
          console.error("Login error:", error);
          const message =
            error.response?.data?.error || error.message || "Login failed";
          return { success: false, message };
        }
      },

      logout: async () => {
        try {
          // Call backend logout endpoint to invalidate server-side session
          await api.post("/auth/logout", {});
        } catch (error) {
          console.error("Logout error:", error);
          // Continue with local cleanup even if backend call fails
        } finally {
          // Clear all authentication data immediately
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            hasCheckedAuth: false, // Reset to false so auth check runs on next login
          });

          // Clear localStorage/sessionStorage
          if (typeof window !== "undefined") {
            // Clear auth storage
            localStorage.removeItem("auth-storage");
            sessionStorage.clear();

            // Clear any other potential auth-related storage
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (
                key &&
                (key.includes("auth") ||
                  key.includes("token") ||
                  key.includes("user"))
              ) {
                keysToRemove.push(key);
              }
            }
            keysToRemove.forEach((key) => localStorage.removeItem(key));

            // Clear client-accessible cookies with multiple path/domain combinations.
            // HttpOnly cookies are cleared by the backend /auth/logout endpoint.
            const cookieNames = document.cookie
              .split(";")
              .map((cookie) => cookie.split("=")[0]?.trim())
              .filter(Boolean);

            const host = window.location.hostname;
            const hostParts = host.split(".");
            const domains = new Set<string>([""]);
            for (let i = 0; i < hostParts.length - 1; i++) {
              const domain = hostParts.slice(i).join(".");
              domains.add(domain);
              domains.add(`.${domain}`);
            }

            const paths = ["/", "/api", "/api/v1"];

            cookieNames.forEach((name) => {
              paths.forEach((path) => {
                domains.forEach((domain) => {
                  const domainAttr = domain ? `;domain=${domain}` : "";
                  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;max-age=0;path=${path}${domainAttr}`;
                });
              });
            });
          }
        }
      },

      checkAuth: async () => {
        const { hasCheckedAuth } = get();

        // Prevent multiple simultaneous auth checks
        if (hasCheckedAuth || authCheckInFlight) {
          return;
        }
        authCheckInFlight = true;

        try {
          set({ isLoading: true });

          const response = await api.get("/auth/me");

          if (response.data.success) {
            set({
              user: response.data.data || response.data.user,
              isAuthenticated: true,
              isLoading: false,
              hasCheckedAuth: true,
            });
          } else {
            set({
              user: null,
              isAuthenticated: false,
              isLoading: false,
              hasCheckedAuth: true,
            });
          }
        } catch (error: any) {
          console.error("Auth check error:", error);
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            hasCheckedAuth: true,
          });
        } finally {
          authCheckInFlight = false;
        }
      },

      clearAuth: () => {
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          hasCheckedAuth: false,
        });
      },

      updateUser: (userData: Partial<User>) => {
        const { user } = get();
        if (user) {
          set({
            user: { ...user, ...userData },
          });
        }
      },
    }),
    {
      name: "auth-storage",
      // hasCheckedAuth is deliberately NOT persisted: it must default to false
      // on every fresh load so the dashboard layout's checkAuth() re-validates
      // against /auth/me and picks up role/permission changes without a logout.
      // user/isAuthenticated stay persisted for instant paint before it lands.
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      // Sessions persisted before hasCheckedAuth was dropped from partialize
      // still carry `hasCheckedAuth: true` in localStorage, and that stale value
      // would be merged back in and make checkAuth() short-circuit forever.
      // Force it false on every rehydrate so the flag is purely per-page-load.
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as Partial<AuthState>),
        hasCheckedAuth: false,
      }),
    }
  )
);
