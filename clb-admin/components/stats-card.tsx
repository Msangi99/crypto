import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: number; label: string };
  color?: "gold" | "green" | "red" | "blue";
}

const colorMap = {
  gold: { bg: "bg-[#F0B90B]/10", text: "text-[#F0B90B]", border: "border-[#F0B90B]/20" },
  green: { bg: "bg-[#00C853]/10", text: "text-[#00C853]", border: "border-[#00C853]/20" },
  red: { bg: "bg-[#FF3D57]/10", text: "text-[#FF3D57]", border: "border-[#FF3D57]/20" },
  blue: { bg: "bg-[#3B82F6]/10", text: "text-[#3B82F6]", border: "border-[#3B82F6]/20" },
};

export function StatsCard({ title, value, subtitle, icon: Icon, trend, color = "gold" }: StatsCardProps) {
  const c = colorMap[color];
  return (
    <Card className={`bg-[#1A1A1A] border-[#2A2A2A] hover:${c.border} transition-colors`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm text-[#999]">{title}</p>
            <p className="text-2xl font-bold text-white">{value}</p>
            {subtitle && <p className="text-xs text-[#666]">{subtitle}</p>}
            {trend && (
              <p className={`text-xs ${trend.value >= 0 ? "text-[#00C853]" : "text-[#FF3D57]"}`}>
                {trend.value >= 0 ? "+" : ""}
                {trend.value}% {trend.label}
              </p>
            )}
          </div>
          <div className={`w-12 h-12 rounded-xl ${c.bg} flex items-center justify-center`}>
            <Icon className={`w-6 h-6 ${c.text}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
