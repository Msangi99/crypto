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
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
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

  return (
    <aside className="w-64 min-h-screen bg-[#111111] border-r border-[#2A2A2A] flex flex-col">
      <div className="p-6 border-b border-[#2A2A2A]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#F0B90B]/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-[#F0B90B]" />
          </div>
          <div>
            <h2 className="font-bold text-white text-lg">CLB Admin</h2>
            <p className="text-xs text-[#666]">Management Panel</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-[#F0B90B]/10 text-[#F0B90B]"
                  : "text-[#999] hover:text-white hover:bg-[#1A1A1A]"
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-[#2A2A2A]">
        <button
          onClick={() => {
            logout();
            window.location.href = "/login";
          }}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[#FF3D57] hover:bg-[#FF3D57]/10 w-full transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Logout
        </button>
      </div>
    </aside>
  );
}
