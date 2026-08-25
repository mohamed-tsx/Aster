"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn, getFullName } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LayoutDashboard,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  Search,
  LogOut,
  User as UserIcon,
  Shield,
  ShieldCheck,
  ChevronDown,
  ChevronsUpDown,
  List,
  UserPlus,
  Building2,
  Handshake,
  ClipboardList,
  FilePlus2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Image from "next/image";
import { useSidebarStore } from "@/stores/sidebar-store";
import { useAuthStore } from "@/stores/auth-store";
import { getUserAvatarUrl } from "@/utils/imageUtils";
import { useRBAC } from "@/hooks/useRBAC";

type NavigationItem = {
  name: string;
  href: string;
  icon: any;
  badge?: any;
  children?: NavigationItem[] | null;
  permission?: string;
};

const navigation: NavigationItem[] = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    badge: null,
    children: null,
  },
  {
    name: "Cases",
    href: "/dashboard/cases",
    icon: ClipboardList,
    children: [
      { name: "All Cases", href: "/dashboard/cases", icon: List, permission: "VIEW_CASES" },
      { name: "Add New Case", href: "/dashboard/cases/new", icon: FilePlus2, permission: "CREATE_CASES" },
    ],
  },
  {
    name: "Users",
    href: "/dashboard/users",
    icon: Users,
    children: [
      {
        name: "All Users",
        href: "/dashboard/users",
        icon: List,
        permission: "VIEW_USERS",
      },
      {
        name: "Add New User",
        href: "/dashboard/users/new",
        icon: UserPlus,
        permission: "CREATE_USERS",
      },
    ],
  },
  {
    name: "Roles & Permissions",
    href: "/dashboard/roles",
    icon: ShieldCheck,
    children: null,
    permission: "MANAGE_ROLES",
  },
  {
    name: "Hospitals",
    href: "/dashboard/hospitals",
    icon: Building2,
    children: null,
    permission: "MANAGE_HOSPITALS",
  },
  {
    name: "Agencies",
    href: "/dashboard/agencies",
    icon: Handshake,
    children: null,
    permission: "MANAGE_AGENCIES",
  },
  {
    name: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
    children: null,
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const { collapsed, toggleCollapsed } = useSidebarStore();
  const { openMobile, setOpenMobile } = useSidebarStore();
  const [openItems, setOpenItems] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const { hasPermission } = useRBAC();

  // Filter navigation based on the current user's real permissions
  const roleFilteredNavigation = navigation
    .map((item): NavigationItem | null => {
      const children = item.children
        ? item.children.filter(
            (child) => !child.permission || hasPermission(child.permission),
          )
        : null;

      if (item.children && (!children || children.length === 0)) return null;
      if (
        !item.children &&
        item.permission &&
        !hasPermission(item.permission)
      ) {
        return null;
      }

      return { ...item, children };
    })
    .filter((item): item is NavigationItem => item !== null);

  // Filter navigation based on search term
  const filteredNavigation = roleFilteredNavigation.filter((item) => {
    if (!searchTerm.trim()) return true;

    const searchLower = searchTerm.toLowerCase();
    const matchesName = item.name.toLowerCase().includes(searchLower);
    const matchesChildren = item.children?.some((child: any) =>
      child.name.toLowerCase().includes(searchLower),
    );

    return matchesName || matchesChildren;
  });

  const handleLogout = async () => {
    await logout();
  };

  const toggleItem = (itemName: string) => {
    setOpenItems((prev) =>
      prev.includes(itemName)
        ? prev.filter((item) => item !== itemName)
        : [...prev, itemName],
    );
  };

  const isActive = (href: string) => pathname === href;
  const isParentActive = (children: any[]) => {
    return children?.some((child) => pathname === child.href) || false;
  };

  // Get badge value for navigation items (no badges defined yet)
  const getBadgeValue = (_itemName: string): number | null => null;

  const NavItem = ({
    item,
    isCollapsed,
  }: {
    item: any;
    isCollapsed: boolean;
  }) => {
    const hasChildren = item.children && item.children.length > 0;
    const isOpen = openItems.includes(item.name);
    const active = isActive(item.href);
    const parentActive = hasChildren ? isParentActive(item.children) : false;

    if (hasChildren) {
      const NavItemWithDropdown = () => (
        <Collapsible open={isOpen} onOpenChange={() => toggleItem(item.name)}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-start px-2 py-1 h-auto text-xs transition-all duration-200",
                (active || parentActive) &&
                  "bg-primary text-primary-foreground shadow-sm",
                !isCollapsed && "justify-between",
              )}
            >
              <div className="flex items-center space-x-2">
                <item.icon
                  className={cn(
                    "h-3.5 w-3.5",
                    active || parentActive
                      ? "text-primary-foreground"
                      : "text-muted-foreground",
                  )}
                />
                {!isCollapsed && (
                  <>
                    <span className="font-medium text-xs">{item.name}</span>
                    {getBadgeValue(item.name) !== null && (
                      <Badge
                        variant="secondary"
                        className="ml-auto text-xs px-1.5 py-0.5"
                      >
                        {getBadgeValue(item.name)}
                      </Badge>
                    )}
                  </>
                )}
              </div>
              {!isCollapsed && (
                <ChevronDown
                  className={cn(
                    "h-3 w-3 transition-transform",
                    isOpen && "rotate-180",
                  )}
                />
              )}
            </Button>
          </CollapsibleTrigger>
          {!isCollapsed && (
            <CollapsibleContent className="space-y-1 ml-4">
              {item.children.map((child: any) => (
                <Link
                  key={child.name}
                  href={child.href}
                  className={cn(
                    "flex items-center space-x-2 px-2 py-1 rounded transition-colors text-xs",
                    isActive(child.href)
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <child.icon className="h-3 w-3" />
                  <span className="text-xs">{child.name}</span>
                </Link>
              ))}
            </CollapsibleContent>
          )}
        </Collapsible>
      );

      if (isCollapsed) {
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <NavItemWithDropdown />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">
              <div className="space-y-1">
                <p className="font-medium">{item.name}</p>
                {item.children.map((child: any) => (
                  <p key={child.name} className="text-xs">
                    {child.name}
                  </p>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        );
      }

      return <NavItemWithDropdown />;
    }

    const SimpleNavItem = () => (
      <Link
        href={item.href}
        className={cn(
          "flex items-center space-x-2 px-2 py-1 rounded transition-all duration-200 text-xs",
          active
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <item.icon
          className={cn(
            "h-3.5 w-3.5",
            active ? "text-primary-foreground" : "text-muted-foreground",
          )}
        />
        {!isCollapsed && (
          <>
            <span className="font-medium text-xs">{item.name}</span>
            {getBadgeValue(item.name) !== null && (
              <Badge
                variant="secondary"
                className="ml-auto text-xs px-1.5 py-0.5"
              >
                {getBadgeValue(item.name)}
              </Badge>
            )}
          </>
        )}
      </Link>
    );

    if (isCollapsed) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <SimpleNavItem />
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">
            <div className="flex items-center gap-2">
              <span>{item.name}</span>
              {getBadgeValue(item.name) !== null && (
                <Badge variant="secondary" className="text-xs">
                  {getBadgeValue(item.name)}
                </Badge>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      );
    }

    return <SimpleNavItem />;
  };

  return (
    <TooltipProvider>
      <>
        {/* Mobile drawer + overlay */}
        {openMobile && (
          <>
            <div
              className="fixed inset-0 bg-black/40 z-40 lg:hidden"
              onClick={() => setOpenMobile(false)}
            />
            <div className="fixed inset-y-0 left-0 z-50 w-64 bg-background border-r border-border lg:hidden">
              <div className="flex items-center justify-between p-3 border-b border-border bg-linear-brand/10">
                <div className="flex items-center space-x-2">
                  <Image
                    src="/aster-logo.svg"
                    alt="Aster Hospital Referral Center"
                    width={96}
                    height={96}
                  />
                </div>
                <div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setOpenMobile(false)}
                  >
                    <ChevronLeft className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <nav className="p-3 space-y-1 overflow-y-auto h-full">
                {filteredNavigation.map((item) => (
                  <div key={item.name} className="mb-2">
                    <div className="text-xs font-medium px-2 pb-1">
                      {item.name}
                    </div>
                    {item.children ? (
                      <div className="space-y-1 ml-2">
                        {item.children.map((child: any) => (
                          <Link
                            key={child.name}
                            href={child.href}
                            className="block px-2 py-1 rounded text-sm text-muted-foreground hover:bg-muted"
                            onClick={() => setOpenMobile(false)}
                          >
                            <child.icon className="inline-block mr-2 h-3 w-3 align-middle" />
                            <span className="align-middle">{child.name}</span>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <Link
                        href={item.href}
                        key={item.name}
                        className="block px-2 py-1 rounded text-sm text-muted-foreground hover:bg-muted"
                        onClick={() => setOpenMobile(false)}
                      >
                        <item.icon className="inline-block mr-2 h-3 w-3 align-middle" />
                        <span className="align-middle">{item.name}</span>
                      </Link>
                    )}
                  </div>
                ))}
              </nav>
            </div>
          </>
        )}

        {/* Desktop / large sidebar */}
        <div
          className={cn(
            "hidden lg:flex bg-background border-r border-border transition-all duration-300 flex-col h-screen fixed left-0 top-0 z-50",
            collapsed ? "w-14" : "w-64",
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-border bg-muted/20">
            {!collapsed && (
              <div className="flex items-center space-x-2">
                <Image
                  src="/logo.svg"
                  alt="Aster Hospital Referral Center"
                  width={45}
                  height={45}
                />
                <div className="text-primary">
                  <h1 className="text-xl font-semibold">Aster</h1>
                  <p className="text-[10px]">We'll Treat You Well</p>
                </div>
              </div>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => toggleCollapsed()}
                  className="h-6 w-6"
                >
                  {collapsed ? (
                    <ChevronRight className="h-3 w-3" />
                  ) : (
                    <ChevronLeft className="h-3 w-3" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {collapsed ? "Expand sidebar" : "Collapse sidebar"}
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Search */}
          {!collapsed && (
            <div className="p-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-7 pr-3 py-1 text-xs bg-muted border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-ring focus:border-transparent"
                />
              </div>
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {filteredNavigation.map((item) => (
              <NavItem key={item.name} item={item} isCollapsed={collapsed} />
            ))}
          </nav>

          <Separator />

          {/* User Profile */}
          <div className="p-3">
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center justify-center">
                    <Avatar className="w-6 h-6">
                      <AvatarImage
                        src={getUserAvatarUrl(user?.avatar)}
                        alt={getFullName(user) || "User"}
                      />
                      <AvatarFallback className="from-primary to-accent text-white text-xs font-medium">
                        {getFullName(user).charAt(0).toUpperCase() || "A"}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <div className="text-center">
                    <p className="font-medium text-sm">{getFullName(user)}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {user?.role?.name.toLowerCase()}
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-start p-2 h-auto hover:bg-muted"
                  >
                    <div className="flex items-center space-x-2 w-full">
                      <Avatar className="w-6 h-6">
                        <AvatarImage
                          src={getUserAvatarUrl(user?.avatar)}
                          alt={getFullName(user) || "User"}
                        />
                        <AvatarFallback className="from-primary to-accent text-white text-xs font-medium">
                          {getFullName(user).charAt(0).toUpperCase() || "A"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-xs font-medium text-foreground truncate">
                          {getFullName(user) || "Admin User"}
                        </p>
                        <div className="flex items-center space-x-1">
                          <Shield className="h-2 w-2 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground capitalize">
                            {user?.role?.name.toLowerCase() || "Administrator"}
                          </p>
                        </div>
                      </div>
                      <ChevronsUpDown className="h-3 w-3 text-muted-foreground" />
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {getFullName(user)}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user?.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/profile" className="cursor-pointer">
                      <UserIcon className="mr-2 h-4 w-4" />
                      <span>Profile</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/settings" className="cursor-pointer">
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Settings</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="text-red-600 cursor-pointer"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </>
    </TooltipProvider>
  );
}
