import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SidebarStore {
    collapsed: boolean;
    setCollapsed: (collapsed: boolean) => void;
    toggleCollapsed: () => void;
    // mobile drawer (not persisted)
    openMobile: boolean;
    setOpenMobile: (open: boolean) => void;
    toggleMobile: () => void;
}

export const useSidebarStore = create<SidebarStore>()(
    persist(
        (set) => ({
            collapsed: false,
            setCollapsed: (collapsed) => set({ collapsed }),
            toggleCollapsed: () => set((state) => ({ collapsed: !state.collapsed })),
            // mobile state will be added outside persist via initial value below
            openMobile: false,
            setOpenMobile: (open: boolean) => set({ openMobile: open }),
            toggleMobile: () => set((state) => ({ openMobile: !state.openMobile })),
        }),
        {
            name: "sidebar-storage", // unique name for localStorage key
            // only persist collapsed state and its setters; keep mobile state non-persistent
            partialize: (state) => ({ collapsed: state.collapsed }),
        }
    )
);