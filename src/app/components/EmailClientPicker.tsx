import React from "react";
import { X, Mail, Share2 } from "lucide-react";

interface EmailClientPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (clientId: string) => void;
  isDownloading: boolean;
}

export const EMAIL_CLIENTS = [
  // ── Email ──────────────────────────────────────────────
  {
    id: "gmail",
    group: "email",
    name: "Gmail",
    hint: "Opens in browser",
    color: "#EA4335",
    bg: "#FEF2F1",
    border: "#FCCAC7",
    Logo: () => (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <rect width="28" height="28" rx="6" fill="#FEF2F1" />
        <path d="M5 9.5L14 16L23 9.5" stroke="#EA4335" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M5 9.5V20.5H23V9.5L14 16L5 9.5Z" fill="white" stroke="#EA4335" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M5 9.5L14 16L23 9.5L22 8H6L5 9.5Z" fill="#EA4335" />
      </svg>
    ),
    getUrl: (subject: string, body: string) =>
      `https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${body}`,
    newTab: true,
    attachNote: true,
  },
  {
    id: "outlook",
    group: "email",
    name: "Outlook",
    hint: "Opens in browser",
    color: "#0078D4",
    bg: "#EFF6FD",
    border: "#BDD7F5",
    Logo: () => (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <rect width="28" height="28" rx="6" fill="#EFF6FD" />
        <rect x="5" y="8" width="18" height="13" rx="2" fill="white" stroke="#0078D4" strokeWidth="1.5" />
        <path d="M5 11L14 16.5L23 11" stroke="#0078D4" strokeWidth="1.5" strokeLinecap="round" />
        <rect x="5" y="8" width="9" height="13" rx="2" fill="#0078D4" />
        <text x="9.5" y="18" fontFamily="Arial" fontWeight="bold" fontSize="8" fill="white" textAnchor="middle">O</text>
      </svg>
    ),
    getUrl: (subject: string, body: string) =>
      `https://outlook.live.com/mail/0/deeplink/compose?subject=${subject}&body=${body}`,
    newTab: true,
    attachNote: true,
  },
  {
    id: "yahoo",
    group: "email",
    name: "Yahoo Mail",
    hint: "Opens in browser",
    color: "#6001D2",
    bg: "#F4EEF9",
    border: "#D5BAF0",
    Logo: () => (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <rect width="28" height="28" rx="6" fill="#F4EEF9" />
        <text x="14" y="20" fontFamily="Arial" fontWeight="900" fontSize="15" fill="#6001D2" textAnchor="middle">Y!</text>
      </svg>
    ),
    getUrl: (subject: string, body: string) =>
      `https://compose.mail.yahoo.com/?subject=${subject}&body=${body}`,
    newTab: true,
    attachNote: true,
  },
  {
    id: "default",
    group: "email",
    name: "Default Mail App",
    hint: "Mail, Apple Mail, Thunderbird…",
    color: "#06263F",
    bg: "#DCEBF7",
    border: "#A8CCE9",
    Logo: () => (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <rect width="28" height="28" rx="6" fill="#DCEBF7" />
        <rect x="5" y="8" width="18" height="13" rx="2" fill="white" stroke="#06263F" strokeWidth="1.5" />
        <path d="M5 11L14 16.5L23 11" stroke="#06263F" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    getUrl: (subject: string, body: string) =>
      `mailto:?subject=${subject}&body=${body}`,
    newTab: false,
    attachNote: true,
  },

  // ── Social Publishing ───────────────────────────────────
  {
    id: "sproutsocial",
    group: "social",
    name: "Sprout Social",
    hint: "Upload graphic in compose",
    color: "#3EAF7C",
    bg: "#EBF7F2",
    border: "#A3DDC2",
    Logo: () => (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <rect width="28" height="28" rx="6" fill="#EBF7F2" />
        {/* Sprout-style leaf/sprout mark */}
        <path d="M14 21V12" stroke="#3EAF7C" strokeWidth="2" strokeLinecap="round" />
        <path d="M14 15C14 15 11 13 9 10C11 9 14 10 14 15Z" fill="#3EAF7C" />
        <path d="M14 12C14 12 17 10 19 7C17 7 14 8.5 14 12Z" fill="#3EAF7C" />
        <circle cx="14" cy="22" r="1.5" fill="#3EAF7C" />
      </svg>
    ),
    getUrl: () => "https://app.sproutsocial.com/publishing/compose",
    newTab: true,
    attachNote: false,
  },
];

export function EmailClientPicker({ isOpen, onClose, onSelect, isDownloading }: EmailClientPickerProps) {
  if (!isOpen) return null;

  const emailClients = EMAIL_CLIENTS.filter((c) => c.group === "email");
  const socialClients = EMAIL_CLIENTS.filter((c) => c.group === "social");

  const renderClient = (client: typeof EMAIL_CLIENTS[number]) => {
    const { Logo } = client;
    return (
      <button
        key={client.id}
        onClick={() => onSelect(client.id)}
        disabled={isDownloading}
        className="w-full flex items-center gap-3.5 rounded-xl px-4 py-3 transition-all text-left disabled:opacity-50"
        style={{ border: `1.5px solid ${client.border}`, background: client.bg }}
        onMouseEnter={(e) => { if (!isDownloading) (e.currentTarget as HTMLElement).style.filter = "brightness(0.96)"; }}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.filter = "none")}
      >
        <Logo />
        <div className="flex-1 min-w-0">
          <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: "#06263F", fontSize: 13, lineHeight: 1.2 }}>
            {client.name}
          </p>
          <p style={{ fontFamily: "Montserrat, sans-serif", color: "#9AA7B4", fontSize: 11, marginTop: 1 }}>
            {client.hint}
          </p>
        </div>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
          <path d="M6 4L10 8L6 12" stroke={client.color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(6,38,63,0.65)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 flex items-center justify-between" style={{ background: "#06263F" }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.12)" }}>
              <Share2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 600, color: "#DCEBF7", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.18em", marginBottom: 2 }}>
                Share Graphic
              </p>
              <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "white", fontSize: 15, textTransform: "uppercase", lineHeight: 1.1 }}>
                Open With
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
            style={{ background: "rgba(255,255,255,0.1)" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.2)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.1)")}
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Email section */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <Mail className="w-3 h-3" style={{ color: "#9AA7B4" }} />
              <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: "#9AA7B4", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.18em" }}>
                Email
              </p>
            </div>
            {emailClients.map(renderClient)}
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: "#E3E8EE" }} />

          {/* Social publishing section */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <Share2 className="w-3 h-3" style={{ color: "#9AA7B4" }} />
              <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: "#9AA7B4", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.18em" }}>
                Social Publishing
              </p>
            </div>
            {socialClients.map(renderClient)}
            <div className="rounded-lg px-3 py-2" style={{ background: "#F5F7FA", border: "1px solid #E3E8EE" }}>
              <p style={{ fontFamily: "Montserrat, sans-serif", color: "#9AA7B4", fontSize: 11, lineHeight: 1.5 }}>
                Sprout Social doesn&apos;t support direct file links — the graphic will download first, then you can upload it in the compose window.
              </p>
            </div>
          </div>

          {/* Footer note for email options */}
          <p style={{ fontFamily: "Montserrat, sans-serif", color: "#9AA7B4", fontSize: 11, textAlign: "center", lineHeight: 1.5, paddingBottom: 2 }}>
            For email options, attach the downloaded graphic before sending.
          </p>
        </div>
      </div>
    </div>
  );
}
