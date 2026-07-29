import React, { useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { supabase } from "@/lib/stores/supabase/client";
import {
  profileInitials,
  saveOwnProfile,
  uploadAvatar,
  type UserProfile,
} from "@/lib/profile";

/** Circular photo picker: preview + change/remove. The file stays local
 * until save. */
export function AvatarPicker({
  email,
  profile,
  file,
  onFile,
  currentUrl,
  onClearCurrent,
}: {
  email: string;
  profile: UserProfile | null;
  file: File | null;
  onFile(f: File | null): void;
  /** Existing avatar URL (edit dialog); cleared via onClearCurrent. */
  currentUrl?: string | null;
  onClearCurrent?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const shownUrl = previewUrl ?? currentUrl ?? null;

  const pick = (f: File | null) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(f ? URL.createObjectURL(f) : null);
    onFile(f);
  };

  return (
    <div className="flex items-center gap-4">
      <span
        className="flex items-center justify-center flex-shrink-0 overflow-hidden"
        style={{
          width: 64,
          height: 64,
          borderRadius: 999,
          background: "var(--mint)",
          color: "#003b71",
          fontSize: 18,
          fontWeight: 600,
          border: "1px solid var(--hairline)",
        }}
      >
        {shownUrl ? (
          <img src={shownUrl} alt="Profile photo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          profileInitials(profile, email)
        )}
      </span>
      <div className="space-y-1">
        <button type="button" className="sp-btn sp-btn-ghost" style={{ minHeight: 32 }} onClick={() => inputRef.current?.click()}>
          <Camera style={{ width: 13, height: 13 }} />
          {shownUrl ? "Change photo" : "Add photo"}
        </button>
        {(file || (currentUrl && onClearCurrent)) && (
          <button
            type="button"
            className="flex items-center gap-1"
            style={{ fontSize: 11, color: "var(--fg-3)" }}
            onClick={() => {
              pick(null);
              onClearCurrent?.();
            }}
          >
            <X style={{ width: 11, height: 11 }} />
            Remove
          </button>
        )}
        <p style={{ fontSize: 11, color: "var(--fg-4)" }}>PNG, JPEG, or WebP · under 4 MB · optional</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}

export function ProfileFields({
  firstName,
  lastName,
  title,
  onChange,
}: {
  firstName: string;
  lastName: string;
  title: string;
  onChange(patch: Partial<{ firstName: string; lastName: string; title: string }>): void;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="sp-eyebrow block mb-1" htmlFor="profile-first">First name</label>
          <input
            id="profile-first"
            className="sp-input"
            value={firstName}
            onChange={(e) => onChange({ firstName: e.target.value })}
            autoComplete="given-name"
          />
        </div>
        <div>
          <label className="sp-eyebrow block mb-1" htmlFor="profile-last">Last name</label>
          <input
            id="profile-last"
            className="sp-input"
            value={lastName}
            onChange={(e) => onChange({ lastName: e.target.value })}
            autoComplete="family-name"
          />
        </div>
      </div>
      <div>
        <label className="sp-eyebrow block mb-1" htmlFor="profile-title">Title</label>
        <input
          id="profile-title"
          className="sp-input"
          placeholder="e.g. Director of Marketing"
          value={title}
          onChange={(e) => onChange({ title: e.target.value })}
          autoComplete="organization-title"
        />
      </div>
    </>
  );
}

/** Full account setup for INVITE arrivals: who you are + your password,
 * one screen, before the app. */
export function AccountSetupGate({
  userId,
  email,
  onDone,
}: {
  userId: string;
  email: string;
  onDone(): void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [title, setTitle] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = !busy && firstName.trim().length > 0 && lastName.trim().length > 0 && password.length >= 12;

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const avatarUrl = photo ? await uploadAvatar(userId, photo) : undefined;
      await saveOwnProfile(userId, { firstName, lastName, title, avatarUrl });
      const { error: err } = await supabase().auth.updateUser({ password });
      if (err) throw err;
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--linen)" }}>
      <div className="w-full space-y-4" style={{ maxWidth: 420 }}>
        <div>
          <p className="sp-eyebrow mb-1">{email}</p>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", fontSize: 20, color: "var(--ink)" }}>
            Set up your account
          </h1>
          <p style={{ fontSize: 13, color: "var(--fg-3)", marginTop: 4 }}>
            Your name and title are shown to your teammates; the photo is
            optional.
          </p>
        </div>
        <AvatarPicker email={email} profile={null} file={photo} onFile={setPhoto} />
        <ProfileFields
          firstName={firstName}
          lastName={lastName}
          title={title}
          onChange={(p) => {
            if (p.firstName !== undefined) setFirstName(p.firstName);
            if (p.lastName !== undefined) setLastName(p.lastName);
            if (p.title !== undefined) setTitle(p.title);
          }}
        />
        <div>
          <label className="sp-eyebrow block mb-1" htmlFor="setup-password">Password</label>
          <input
            id="setup-password"
            type="password"
            className="sp-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          <p style={{ fontSize: 11, color: "var(--fg-4)", marginTop: 4 }}>
            At least 12 characters — you'll sign in with this from now on.
          </p>
        </div>
        {error && <p role="alert" style={{ fontSize: 12, color: "var(--danger)" }}>{error}</p>}
        <button className="sp-btn sp-btn-primary w-full" disabled={!canSave} onClick={() => void save()}>
          {busy ? "Creating your account…" : "Create account"}
        </button>
      </div>
    </div>
  );
}
