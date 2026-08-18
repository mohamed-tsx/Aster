"use client";

import Header from "@/components/Layout/Header";
import Sidebar from "@/components/Layout/Sidebar";
import { useSidebarStore } from "@/stores/sidebar-store";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { collapsed } = useSidebarStore();

    const marginClass = collapsed ? "ml-0 lg:ml-14" : "ml-0 lg:ml-64";

    return (
        <div className="min-h-screen bg-background">
            <Sidebar />
            <div className={`flex-1 flex flex-col transition-all duration-300 ${marginClass}`}>
                <Header />
                <main className="flex-1 p-4 lg:p-6 bg-background">{children}</main>
            </div>
        </div>
    );
}