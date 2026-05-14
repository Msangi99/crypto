"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Smartphone, Loader2, Upload, Trash2, Rocket, EyeOff, Settings } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { toast } from "sonner";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

type ReleaseRow = {
  id: string;
  version: string;
  originalFileName: string;
  fileSizeBytes: number;
  releaseNotes: string | null;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
};

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n >= 1073741824) return `${(n / 1073741824).toFixed(2)} GB`;
  if (n >= 1048576) return `${(n / 1048576).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

export default function MobileAppReleasesPage() {
  const [releases, setReleases] = useState<ReleaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState("");
  const [releaseNotes, setReleaseNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [uploadPhase, setUploadPhase] = useState<"idle" | "upload" | "processing">("idle");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getAdminMobileReleases();
      setReleases(res.releases);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load releases");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onUpload = async () => {
    if (!version.trim()) {
      toast.error("Enter a version label (e.g. 1.2.0)");
      return;
    }
    if (!file) {
      toast.error("Choose an .apk file");
      return;
    }
    setUploading(true);
    setUploadPct(0);
    setUploadPhase("upload");
    try {
      await api.uploadAdminMobileRelease(
        {
          version: version.trim(),
          releaseNotes: releaseNotes.trim() || undefined,
          file,
        },
        (pct, phase) => {
          setUploadPct(pct);
          setUploadPhase(phase === "processing" ? "processing" : "upload");
        }
      );
      toast.success("APK uploaded. Publish it when you are ready.");
      setVersion("");
      setReleaseNotes("");
      setFile(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      setUploadPct(null);
      setUploadPhase("idle");
    }
  };

  const act = async (id: string, fn: () => Promise<unknown>, okMsg: string) => {
    setBusyId(id);
    try {
      await fn();
      toast.success(okMsg);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  };

  const published = releases.find((r) => r.isPublished);

  return (
    <div className="space-y-8 p-6 md:p-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Smartphone className="w-7 h-7 text-[#F0B90B]" />
          Mobile app (Android APK)
        </h1>
        <p className="text-[#999] mt-2 text-sm">
          Upload builds here. Only one release can be <strong className="text-white">published</strong> at a time — that
          build is offered on the public landing page (popup + direct link).
        </p>
        <p className="text-[#666] text-xs mt-2">
          Public download URL:{" "}
          <code className="text-[#00C896]">{API_BASE}/api/public/mobile-app/download</code>
        </p>
      </div>

      <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Upload className="w-5 h-5 text-[#F0B90B]" />
            Upload new build
          </CardTitle>
          <CardDescription className="text-[#999]">
            Max ~120 MB. After upload, publish the row you want visitors to download.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 max-w-lg">
          <div className="space-y-2">
            <Label className="text-[#ccc]">Version label</Label>
            <Input
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="e.g. 1.4.2"
              disabled={uploading}
              className="bg-[#0D0D0D] border-[#2A2A2A] disabled:opacity-50"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[#ccc]">Release notes (optional)</Label>
            <Input
              value={releaseNotes}
              onChange={(e) => setReleaseNotes(e.target.value)}
              placeholder="Short line shown on the landing popup"
              disabled={uploading}
              className="bg-[#0D0D0D] border-[#2A2A2A] disabled:opacity-50"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[#ccc]">APK file</Label>
            <Input
              type="file"
              accept=".apk,application/vnd.android.package-archive"
              disabled={uploading}
              className="bg-[#0D0D0D] border-[#2A2A2A] text-sm text-[#ccc] disabled:opacity-50"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <p className="text-xs text-[#888]">
                Selected: <span className="text-[#ccc]">{file.name}</span> · {formatBytes(file.size)}
              </p>
            ) : null}
          </div>

          {uploading ? (
            <div className="space-y-2 rounded-lg border border-[#2A2A2A] bg-[#0D0D0D] p-4">
              <div className="flex justify-between text-xs text-[#aaa]">
                <span>
                  {uploadPhase === "processing" ? "Saving on server…" : "Uploading to API…"}
                </span>
                <span>{uploadPct != null ? `${uploadPct}%` : "…"}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[#2A2A2A]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#F0B90B] to-[#00C896] transition-[width] duration-150 ease-out"
                  style={{
                    width: `${uploadPct != null ? Math.max(3, uploadPct) : uploadPhase === "processing" ? 100 : 8}%`,
                  }}
                />
              </div>
              <p className="text-[11px] text-[#666] leading-relaxed">
                First time can pause at ~99% while the server writes the file. If it fails with a network error, redeploy
                the API with the latest CORS settings and ensure nginx <code className="text-[#888]">client_max_body_size</code> is at least 128m.
              </p>
            </div>
          ) : null}

          <Button
            onClick={onUpload}
            disabled={uploading}
            className="bg-[#F0B90B] text-[#0D0D0D] hover:bg-[#FCD535] font-semibold"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
            {uploading ? "Uploading…" : "Upload APK"}
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
        <CardHeader>
          <CardTitle className="text-white">Releases</CardTitle>
          <CardDescription className="text-[#999]">
            {published ? (
              <span>
                Live on landing: <Badge className="bg-[#00C896]/20 text-[#00C896]">v{published.version}</Badge>
              </span>
            ) : (
              "No published APK — landing download is hidden until you publish one."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-[#999] text-sm py-8">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading…
            </div>
          ) : releases.length === 0 ? (
            <p className="text-[#666] text-sm py-6">No uploads yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-[#2A2A2A] text-[#999]">
                    <th className="py-2 pr-4">Version</th>
                    <th className="py-2 pr-4">File</th>
                    <th className="py-2 pr-4">Size</th>
                    <th className="py-2 pr-4">Uploaded</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {releases.map((r) => (
                    <tr key={r.id} className="border-b border-[#2A2A2A]/60 text-[#ddd]">
                      <td className="py-3 pr-4 font-mono text-[#F0B90B]">{r.version}</td>
                      <td className="py-3 pr-4 max-w-[180px] truncate" title={r.originalFileName}>
                        {r.originalFileName}
                      </td>
                      <td className="py-3 pr-4">{formatBytes(r.fileSizeBytes)}</td>
                      <td className="py-3 pr-4 text-[#888] whitespace-nowrap">
                        {new Date(r.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 pr-4">
                        {r.isPublished ? (
                          <Badge className="bg-[#00C896]/20 text-[#00C896]">Published</Badge>
                        ) : (
                          <Badge variant="outline" className="border-[#444] text-[#999]">
                            Draft
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 text-right space-x-2 whitespace-nowrap">
                        {!r.isPublished ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-[#F0B90B]/40 text-[#F0B90B] hover:bg-[#F0B90B]/10"
                            disabled={busyId === r.id}
                            onClick={() =>
                              act(r.id, () => api.publishAdminMobileRelease(r.id), "Published — live on landing")
                            }
                          >
                            {busyId === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Rocket className="w-3 h-3 mr-1" />}
                            Publish
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-[#666] text-[#ccc]"
                            disabled={busyId === r.id}
                            onClick={() =>
                              act(r.id, () => api.unpublishAdminMobileRelease(r.id), "Unpublished")
                            }
                          >
                            {busyId === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <EyeOff className="w-3 h-3 mr-1" />}
                            Unpublish
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-500/40 text-red-400 hover:bg-red-500/10"
                          disabled={busyId === r.id || r.isPublished}
                          title={r.isPublished ? "Unpublish first" : "Delete draft"}
                          onClick={() => {
                            if (!confirm("Delete this draft and its file?")) return;
                            act(r.id, () => api.deleteAdminMobileRelease(r.id), "Deleted");
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-sm text-[#666]">
        <Link href="/dashboard/settings" className="text-[#F0B90B] hover:underline inline-flex items-center gap-1">
          <Settings className="w-3.5 h-3.5" />
          Back to Settings
        </Link>
      </p>
    </div>
  );
}
