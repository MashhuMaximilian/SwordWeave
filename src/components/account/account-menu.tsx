"use client";
import Link from "next/link";
import Image from "next/image";
import { useClerk } from "@clerk/nextjs";
import { ArrowLeft, User, Settings, LogOut } from "lucide-react";
import { useAccount } from "./account-provider";
export function AccountMenu({
  back,
  close,
  onLink,
}: {
  back: () => void;
  close: () => void;
  onLink: (e: React.MouseEvent<HTMLAnchorElement>, href: string) => void;
}) {
  const { profile, isGameMaster, saving, error, setGameMaster } = useAccount();
  const { openUserProfile, signOut } = useClerk();
  return (
    <section className="sw-account-menu" aria-label="Account">
      <header>
        <button autoFocus type="button" onClick={back}>
          <ArrowLeft size={18} />
          Quick access
        </button>
        <h2>Account</h2>
      </header>
      {profile ? (
        <>
          <div className="sw-account-identity">
            {profile.avatarUrl && (
              <span className="sw-fab__account-rim"><Image unoptimized width={42} height={42}
                src={profile.avatarUrl}
                alt=""
                className="sw-fab__account-avatar"
              /></span>
            )}
            <div>
              <strong>{profile.displayName}</strong>
              <p>@{profile.username}</p>
            </div>
          </div>
          <label className="sw-account-gm">
            <span>
              <strong>I am a Game Master</strong>
              <small>Show encounters and creature tools.</small>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={isGameMaster}
              disabled={saving}
              onChange={(e) => void setGameMaster(e.target.checked)}
            />
          </label>
          <p className="sw-account-status" role="status">
            {saving ? "Saving…" : error}
          </p>
          <Link
            href={`/u/${profile.username}`}
            onClick={(e) => onLink(e, `/u/${profile.username}`)}
          >
            <User size={18} />
            View profile
          </Link>
          <Link
            href="/settings/profile"
            onClick={(e) => onLink(e, "/settings/profile")}
          >
            <Settings size={18} />
            Edit profile
          </Link>
          <button
            onClick={() => {
              close();
              openUserProfile();
            }}
          >
            <Settings size={18} />
            Manage account
          </button>
          <button
            className="sw-account-signout"
            onClick={() => {
              close();
              void signOut({ redirectUrl: "/" });
            }}
          >
            <LogOut size={18} />
            Sign out
          </button>
        </>
      ) : (
        <>
          <Link href="/sign-in" onClick={(e) => onLink(e, "/sign-in")}>
            Sign in
          </Link>
          <Link href="/sign-up" onClick={(e) => onLink(e, "/sign-up")}>
            Create account
          </Link>
        </>
      )}
    </section>
  );
}
