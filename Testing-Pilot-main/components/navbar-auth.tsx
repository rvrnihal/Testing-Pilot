"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, KeyRound, LogOut, Settings, User } from "lucide-react";
import { AUTH_CHANGE_EVENT, apiRequest, clearToken, getToken } from "../lib/client-api";

type SessionUser = {
  name: string;
  email: string;
  role: string;
};

function initialsFromName(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function NavbarAuth() {
  const router = useRouter();
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [authUser, setAuthUser] = useState<SessionUser | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      const token = getToken();

      if (!token) {
        if (!cancelled) {
          setAuthUser(null);
          setIsReady(true);
        }
        return;
      }

      try {
        const response = await apiRequest<{ user: SessionUser }>("/me");
        if (!cancelled) {
          setAuthUser(response.user);
        }
      } catch {
        clearToken();
        if (!cancelled) {
          setAuthUser(null);
        }
      } finally {
        if (!cancelled) {
          setIsReady(true);
        }
      }
    }

    void loadSession();

    function handleAuthChange() {
      void loadSession();
    }

    window.addEventListener(AUTH_CHANGE_EVENT, handleAuthChange);

    return () => {
      cancelled = true;
      window.removeEventListener(AUTH_CHANGE_EVENT, handleAuthChange);
    };
  }, [pathname]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const dashboardHref = authUser?.role === "ADMIN" ? "/admin" : "/dashboard";
  const userInitials = useMemo(() => initialsFromName(authUser?.name || "QA"), [authUser?.name]);

  async function handleLogout() {
    clearToken();
    setAuthUser(null);
    setIsOpen(false);
    router.push("/login");
    router.refresh();
  }

  if (!isReady) {
    return <div className="h-11 w-44 animate-pulse rounded-full bg-[var(--surface-muted)]" />;
  }

  if (!authUser) {
    return (
      <div className="flex items-center gap-2">
        <Link className="rounded-full px-4 py-2 text-sm text-[var(--foreground)]/85 transition duration-200 hover:bg-[var(--surface-muted)]" href="/login">
          Login
        </Link>
        <Link className="rounded-full bg-[var(--accent-gradient)] px-4 py-2 text-sm font-semibold text-[var(--accent-foreground)] transition duration-200 hover:opacity-95" href="/register">
          Register
        </Link>
      </div>
    );
  }

  return (
    <div className="relative z-[60]" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="group flex items-center gap-3 rounded-full border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-2.5 py-2 text-left shadow-[var(--shadow-soft)] transition duration-200 hover:-translate-y-0.5 hover:border-teal-200 hover:bg-[var(--surface-muted)]"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[linear-gradient(180deg,rgba(20,184,166,0.16),rgba(59,130,246,0.12))] text-sm font-semibold text-[var(--foreground)] transition duration-200 group-hover:scale-[1.04]">
          {userInitials}
        </div>
        <div className="hidden min-w-0 sm:block">
          <p className="truncate text-sm font-semibold text-[var(--foreground)]">{authUser.name}</p>
          <p className="truncate text-xs text-[var(--muted-foreground)]">{authUser.email}</p>
        </div>
        <ChevronDown className={`h-4 w-4 text-[var(--muted-foreground)] transition duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      <div
        className={`absolute right-0 top-[calc(100%+12px)] z-[70] w-72 origin-top-right rounded-2xl border border-[var(--surface-border)] bg-[var(--dropdown-bg)] p-2 shadow-[var(--shadow-card-hover)] backdrop-blur-md transition duration-200 ${
          isOpen ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0"
        }`}
      >
        <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-muted)] px-3 py-3">
          <p className="text-sm font-semibold text-[var(--foreground)]">{authUser.name}</p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">{authUser.email}</p>
        </div>

        <div className="mt-2 space-y-1">
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              router.push(dashboardHref);
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[var(--foreground)] transition duration-200 hover:bg-[var(--surface-muted)]"
          >
            <User className="h-4 w-4 text-[var(--muted-foreground)]" />
            Profile
          </button>
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              router.push(dashboardHref);
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[var(--foreground)] transition duration-200 hover:bg-[var(--surface-muted)]"
          >
            <Settings className="h-4 w-4 text-[var(--muted-foreground)]" />
            Settings
          </button>
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              router.push("/dashboard");
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[var(--foreground)] transition duration-200 hover:bg-[var(--surface-muted)]"
          >
            <KeyRound className="h-4 w-4 text-[var(--muted-foreground)]" />
            API Keys
          </button>
          <div className="my-2 h-px bg-[var(--surface-border)]" />
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-rose-700 transition duration-200 hover:bg-rose-50"
          >
            <LogOut className="h-4 w-4 text-rose-600" />
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
