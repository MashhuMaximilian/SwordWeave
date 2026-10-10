"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useUser } from "@clerk/nextjs";
type Profile = {
  id?: string | undefined;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  isGameMaster: boolean;
};
type Account = {
  profile: Profile | null;
  isGameMaster: boolean;
  saving: boolean;
  error: string;
  setGameMaster: (value: boolean) => Promise<void>;
};
const Context = createContext<Account>({
  profile: null,
  isGameMaster: false,
  saving: false,
  error: "",
  setGameMaster: async () => {},
});
export const useAccount = () => useContext(Context);
export function AccountProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  return (
    <AccountSession key={user?.id ?? "signed-out"}>{children}</AccountSession>
  );
}
function AccountSession({ children }: { children: React.ReactNode }) {
  const { user, isLoaded, isSignedIn } = useUser();
  const id = user?.id ?? null;
  const latest = useRef(id);
  useEffect(() => {
    latest.current = id;
  }, [id]);
  const pending = useRef(false);
  const sequence = useRef(0);
  const [result, setResult] = useState<{ id: string; profile: Profile } | null>(
      null,
    ),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const refresh = useCallback(async () => {
    if (!id || pending.current) return;
    const seq = ++sequence.current;
    try {
      const response = await fetch("/api/users/me", { cache: "no-store" });
      if (!response.ok) return;
      const profile = (await response.json()) as Profile;
      if (latest.current === id && sequence.current === seq && !pending.current)
        setResult({ id, profile });
    } catch {
      /* Cached identity remains usable. */
    }
  }, [id]);
  useEffect(() => {
    const initial = setTimeout(() => void refresh(), 0);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    return () => {
      clearTimeout(initial);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
    };
  }, [refresh]);
  const loaded = result?.id === id ? result.profile : null;
  const profile =
    isLoaded && isSignedIn && user
      ? {
          id: loaded?.id,
          username: loaded?.username ?? user.username ?? "user",
          displayName:
            loaded?.displayName ?? user.fullName ?? user.username ?? "Account",
          avatarUrl: loaded?.avatarUrl ?? user.imageUrl,
          isGameMaster: loaded?.isGameMaster ?? false,
        }
      : null;
  async function setGameMaster(value: boolean) {
    if (!id || !profile || pending.current) return;
    const previous = profile;
    pending.current = true;
    sequence.current++;
    setSaving(true);
    setError("");
    setResult({ id, profile: { ...profile, isGameMaster: value } });
    try {
      const response = await fetch("/api/users/me/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isGameMaster: value }),
      });
      if (!response.ok)
        throw new Error("Could not save your preference. Try again.");
      if (latest.current === id) {
        setResult({ id, profile: { ...previous, isGameMaster: value } });
        try {localStorage.setItem("sw:account-preferences-changed",String(Date.now()));} catch {/* Focus/reconnect still refreshes other tabs. */}
      }
    } catch (e) {
      if (latest.current === id) {
        setResult({ id, profile: previous });
        setError(e instanceof Error ? e.message : "Could not save preference.");
      }
    } finally {
      if (latest.current === id) {
        pending.current = false;
        setSaving(false);
      }
    }
  }
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === "sw:account-preferences-changed") void refresh();
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [refresh]);
  return (
    <Context.Provider
      value={{
        profile,
        isGameMaster: profile?.isGameMaster ?? false,
        saving,
        error,
        setGameMaster,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function GMOnly({ children }: { children: React.ReactNode }) {
  return useAccount().isGameMaster ? <>{children}</> : null;
}
