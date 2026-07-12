export function generateSessionCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "KCT";
  for (let i = 0; i < 3; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function joinUrl(code: string): string {
  const envBase = (import.meta as any).env?.VITE_PUBLIC_APP_URL as string | undefined;
  const base = (envBase && envBase.replace(/\/$/, "")) ||
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/join/${code}`;
}

// True when the app is being viewed on a Lovable editor preview host that
// requires a Lovable account to load — QR codes pointing here won't open on
// a student phone. Faculty should publish the app first.
export function isPrivatePreviewHost(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return /(^|\.)id-preview--/.test(h) || h.includes("lovableproject.com") || h === "localhost" || h === "127.0.0.1";
}