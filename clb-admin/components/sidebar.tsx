"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Waves,
  ArrowLeftRight,
  Users,
  Settings,
  LogOut,
  Shield,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useSidebar } from "@/lib/sidebar-context";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/pools", label: "Pools", icon: Waves },
  { href: "/dashboard/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/dashboard/referrals", label: "Referrals", icon: Users },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { logout } = useAuth();
  const { collapsed, toggle } = useSidebar();

  return (
    <aside
      className={cn(
        "min-h-screen bg-[#111111] border-r border-[#2A2A2A] flex flex-col transition-all duration-300 ease-in-out relative",
        collapsed ? "w-[68px]" : "w-64"
      )}
    >
      {/* Toggle button */}
      <button
        onClick={toggle}
        className="absolute -right-3 top-7 z-50 w-6 h-6 rounded-full bg-[#1A1A1A] border border-[#2A2A2A] flex items-center justify-center hover:bg-[#2A2A2A] hover:border-[#F0B90B]/30 transition-all group"
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? (
          <PanelLeftOpen className="w-3.5 h-3.5 text-[#999] group-hover:text-[#F0B90B]" />
        ) : (
          <PanelLeftClose className="w-3.5 h-3.5 text-[#999] group-hover:text-[#F0B90B]" />
        )}
      </button>

      {/* Logo */}
      <div className={cn("border-b border-[#2A2A2A] transition-all duration-300", collapsed ? "p-3" : "p-5")}>
        <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-3")}>
          <div className="w-10 h-10 rounded-xl bg-[#F0B90B]/10 flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5 text-[#F0B90B]" />
          </div>
          <div className={cn("overflow-hidden transition-all duration-300", collapsed ? "w-0 opacity-0" : "w-auto opacity-100")}>
            <h2 className="font-bold text-white text-lg whitespace-nowrap">CLB Admin</h2>
            <p className="text-xs text-[#666] whitespace-nowrap">Management Panel</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className={cn("flex-1 space-y-1 transition-all duration-300", collapsed ? "p-2" : "p-4")}>
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center rounded-lg text-sm font-medium transition-all duration-200",
                collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5",
                isActive
                  ? "bg-[#F0B90B]/10 text-[#F0B90B]"
                  : "text-[#999] hover:text-white hover:bg-[#1A1A1A]"
              )}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              <span className={cn("overflow-hidden transition-all duration-300 whitespace-nowrap", collapsed ? "w-0 opacity-0" : "w-auto opacity-100")}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className={cn("border-t border-[#2A2A2A] transition-all duration-300", collapsed ? "p-2" : "p-4")}>
        <button
          onClick={() => { logout(); window.location.href = "/login"; }}
          title={collapsed ? "Logout" : undefined}
          className={cn(
            "flex items-center rounded-lg text-sm font-medium text-[#FF3D57] hover:bg-[#FF3D57]/10 w-full transition-all duration-200",
            collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5"
          )}
        >
          <LogOut className="w-5 h-5 shrink-0" />
          <span className={cn("overflow-hidden transition-all duration-300 whitespace-nowrap", collapsed ? "w-0 opacity-0" : "w-auto opacity-100")}>
            Logout
          </span>
        </button>
      </div>
    </aside>
  );
}
