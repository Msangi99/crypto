"use client";

import { Bell, Circle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";

export function Header() {
  const { user } = useAuth();

  const shortAddress = user?.walletAddress
    ? `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}`
    : "";

  return (
    <header className="h-16 border-b border-[#2A2A2A] bg-[#111111] flex items-center justify-between px-6">
      <div>
        <h1 className="text-lg font-semibold text-white">Dashboard</h1>
      </div>

      <div className="flex items-center gap-4">
        <button className="relative p-2 text-[#999] hover:text-white transition-colors">
          <Bell className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 pl-4 border-l border-[#2A2A2A]">
          <div className="w-8 h-8 rounded-full bg-[#F0B90B]/10 flex items-center justify-center">
            <span className="text-sm font-bold text-[#F0B90B]">
              {user?.username?.[0]?.toUpperCase() || "A"}
            </span>
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-white">
              {user?.username || "Admin"}
            </p>
            <p className="text-xs text-[#666] font-mono">{shortAddress}</p>
          </div>
          <Badge className="bg-[#F0B90B]/10 text-[#F0B90B] border-[#F0B90B]/20 text-xs">
            <Circle className="w-2 h-2 fill-[#00C853] text-[#00C853] mr-1" />
            Admin
          </Badge>
        </div>
      </div>
    </header>
  );
}
