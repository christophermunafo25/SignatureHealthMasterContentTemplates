import React, { useState } from "react";
import { X } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { saveOwnProfile, uploadAvatar } from "@/lib/profile";
import { AvatarPicker, ProfileFields } from "./auth/AccountSetup";

/** Edit your own profile (name, title, photo) from the sidebar user block.
 * Password changes go through "Forgot password?" — not here. Real auth
 * only: the dev backend has no user row to edit. */
export function ProfileDialog({ onClose }: { onClose(): void }) {
  const { user, profile, refreshProfile } = useAuth();
  const [firstName, setFirstName] = useState(profile?.firstName ?? "");
  const [lastName, setLastName] = useState(profile?.lastName ?? "");
  const [title, setTitle] = useState(profile?.title ?? "");
  const [photo, setPhoto] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      let avatarUrl: string | undefined;
      if (photo) avatarUrl = await uploadAvatar(user.id, photo);
      else if (removePhoto) avatarUrl = "";
      await saveOwnProfile(user.id, {
        firstName,
        lastName,
        title,
        // "" clears the column (saveOwnProfile nulls empty strings).
        avatarUrl,
      });
      await refreshProfile?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ background: "rgba(0,59,113,0.4)", zIndex: 70 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Edit profile"
    >
      <div
        className="w-full p-6 space-y-4"
        style={{
          maxWidth: 420,
          background: "var(--lift)",
          border: "1px solid var(--hairline)",
          borderRadius: 12,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="sp-panel-title">Edit profile</h2>
            <p style={{ fontSize: 12, color: "var(--fg-3)", marginTop: 2 }}>{user.email}</p>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ color: "var(--fg-3)" }}>
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>
        <AvatarPicker
          email={user.email}
          profile={profile}
          file={photo}
          onFile={(f) => {
            setPhoto(f);
            if (f) setRemovePhoto(false);
          }}
          currentUrl={removePhoto ? null : profile?.avatarUrl}
          onClearCurrent={() => setRemovePhoto(true)}
        />
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
        {error && <p role="alert" style={{ fontSize: 12, color: "var(--danger)" }}>{error}</p>}
        <div className="flex gap-2 justify-end">
          <button className="sp-btn sp-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="sp-btn sp-btn-primary" disabled={busy} onClick={() => void save()}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
