"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Bell,
  Search,
  LogOut,
  User,
  Settings,
  Shield,
  Loader2,
  FileDown,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth-store";
import { getUserAvatarUrl } from "@/utils/imageUtils";
import { getFullName } from "@/lib/utils";
import { ThemeToggle } from "../theme-toggle";
import { useSidebarStore } from "@/stores/sidebar-store";
import { Menu } from "lucide-react";

export default function Header() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const { toggleMobile } = useSidebarStore();

  // Update time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);

    try {
      // Show immediate feedback
      toast.info("Logging out...", { duration: 1000 });

      // Perform logout (clears backend session + all local storage)
      await logout();

      // Show success message
      toast.success("Logged out successfully", { duration: 2000 });

      // Redirect to login page
      router.push("/login");
    } catch (error) {
      console.error("Logout error:", error);

      // Even if there's an error, logout clears everything locally
      toast.success("Logged out successfully", { duration: 2000 });

      // Redirect to login page
      router.push("/login");
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <header className="bg-background border-b border-border">
      <div className="flex items-center justify-between px-4 lg:px-6 py-3">
        <div className="flex items-center space-x-3">
          {/* Mobile hamburger to toggle sidebar */}
          <div className="lg:hidden">
            <Button variant="ghost" size="icon" onClick={() => toggleMobile()}>
              <Menu className="h-5 w-5" />
            </Button>
          </div>
          <div>
            <h1 className="text-lg lg:text-xl font-medium text-foreground">
              Welcome, {getFullName(user) || "Admin"}
            </h1>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
              {formatTime(currentTime)}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Notifications */}

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage
                    src={getUserAvatarUrl(user?.avatar)}
                    alt={getFullName(user) || ""}
                  />
                  <AvatarFallback className="from-primary to-accent text-white text-xs">
                    {getFullName(user).charAt(0).toUpperCase() || "A"}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {getFullName(user)}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email}
                  </p>
                  <div className="flex items-center space-x-1 mt-1">
                    <Shield className="h-3 w-3 text-muted-foreground" />
                    <Badge variant="secondary" className="text-xs">
                      {user?.role?.name}
                    </Badge>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-red-600"
                disabled={isLoggingOut}
              >
                {isLoggingOut ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <LogOut className="mr-2 h-4 w-4" />
                )}
                <span>{isLoggingOut ? "Logging out..." : "Log out"}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
