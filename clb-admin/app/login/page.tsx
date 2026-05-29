"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, Shield, Loader2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { toast } from "sonner";

export default function LoginPage() {
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();
  const { login } = useAuth();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error("Enter email and password"); return; }
    setIsLoading(true);
    try {
      const res = await api.adminLogin(email, password);
      if (!res.success) throw new Error("Login failed");
      login(res.token, res.user);
      toast.success("Welcome, Admin!");
      router.push("/dashboard");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Invalid email or password");
    } finally {
      setIsLoading(false);
    }
  };

  const handleWalletLogin = async () => {
    setIsLoading(true);
    try {
      if (typeof window === "undefined" || !(window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<string[]> } }).ethereum) {
        toast.error("MetaMask not found. Please install MetaMask extension.");
        return;
      }
      const ethereum = (window as unknown as { ethereum: { request: (args: { method: string; params?: unknown[] }) => Promise<string | string[]> } }).ethereum;
      const accounts = await ethereum.request({ method: "eth_requestAccounts" }) as string[];
      const walletAddress = accounts[0];

      const { nonce } = await api.getNonce(walletAddress);
      const message = `Sign this message to authenticate.\nNonce: ${nonce}`;
      const signature = await ethereum.request({ method: "personal_sign", params: [message, walletAddress] }) as string;
      const res = await api.verify(walletAddress, signature);

      if (!res.success) throw new Error("Verification failed");
      if (res.user.role !== "ADMIN") { toast.error("Access denied — Admin only"); return; }

      login(res.token, res.user);
      toast.success("Welcome, Admin!");
      router.push("/dashboard");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Wallet login failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#F0B90B]/10 mb-4">
            <Shield className="w-8 h-8 text-[#F0B90B]" />
          </div>
          <h1 className="text-3xl font-bold text-white">CLB Admin</h1>
          <p className="text-[#999] mt-2">Management Dashboard</p>
        </div>

        <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
          <CardHeader>
            <CardTitle className="text-white">Admin Login</CardTitle>
            <CardDescription className="text-[#999]">
              Sign in to manage the CLB platform
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!mounted ? (
              <div className="space-y-4" aria-hidden="true">
                <div className="h-10 rounded-lg bg-[#0D0D0D] border border-[#2A2A2A] animate-pulse" />
                <div className="h-11 rounded-md bg-[#0D0D0D] border border-[#2A2A2A] animate-pulse" />
                <div className="h-11 rounded-md bg-[#0D0D0D] border border-[#2A2A2A] animate-pulse" />
                <div className="h-12 rounded-md bg-[#F0B90B]/20 animate-pulse" />
              </div>
            ) : (
            <Tabs defaultValue="email" className="w-full">
              <TabsList className="w-full bg-[#0D0D0D] border border-[#2A2A2A] mb-4">
                <TabsTrigger value="email" className="flex-1 data-[state=active]:bg-[#F0B90B] data-[state=active]:text-[#0D0D0D]">
                  <Mail className="w-4 h-4 mr-2" /> Email
                </TabsTrigger>
                <TabsTrigger value="wallet" className="flex-1 data-[state=active]:bg-[#F0B90B] data-[state=active]:text-[#0D0D0D]">
                  <Wallet className="w-4 h-4 mr-2" /> Wallet
                </TabsTrigger>
              </TabsList>

              <TabsContent value="email">
                <form onSubmit={handleEmailLogin} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm text-[#999]">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666]" />
                      <input
                        type="email"
                        name="email"
                        autoComplete="username"
                        placeholder="admin@clb.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full h-11 rounded-md border border-[#2A2A2A] bg-[#0D0D0D] pl-10 pr-3 text-sm text-white placeholder:text-[#666] focus:outline-none focus:ring-1 focus:ring-[#F0B90B]"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-[#999]">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666]" />
                      <input
                        type="password"
                        name="password"
                        autoComplete="current-password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full h-11 rounded-md border border-[#2A2A2A] bg-[#0D0D0D] pl-10 pr-3 text-sm text-white placeholder:text-[#666] focus:outline-none focus:ring-1 focus:ring-[#F0B90B]"
                      />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-12 bg-[#F0B90B] text-[#0D0D0D] hover:bg-[#FCD535] font-semibold text-base"
                  >
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Shield className="w-5 h-5 mr-2" />}
                    Sign In
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="wallet">
                <div className="space-y-4">
                  <p className="text-sm text-[#999]">Connect your admin wallet via MetaMask or Trust Wallet</p>
                  <Button
                    onClick={handleWalletLogin}
                    disabled={isLoading}
                    className="w-full h-12 bg-[#F0B90B] text-[#0D0D0D] hover:bg-[#FCD535] font-semibold text-base"
                  >
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Wallet className="w-5 h-5 mr-2" />}
                    Connect Wallet
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
            )}

            <p className="text-xs text-[#666] text-center mt-6">
              Only ADMIN accounts can access this dashboard
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
