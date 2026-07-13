import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { Bell, Menu, X, ChevronDown, Settings, LogOut, LayoutDashboard } from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ProgressPanel } from "./ProgressPanel";
import { useAuthStore } from "@/lib/store/auth-store";
import { toast } from "sonner";
import Header from "./Header";

const links = [
  { to: "/", label: "Upload" },
  { to: "/processing", label: "Processing" },
  { to: "/validation", label: "Validation" },
  { to: "/dashboard", label: "Dashboard" },
];

export function TopNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    toast.success("Logged out successfully.");
    navigate({ to: "/" });
  };

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "US";

  return (
    <header className="glass-nav bg-transparent sticky top-0 z-50">
      <div className="mx-auto flex h-[72px] max-w-[1440px] bg-transparent items-center justify-between px-4 md:px-8">
        <Link to="/" className="flex border-2 p-2 rounded-2xl items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--navy)] text-[13px] font-semibold tracking-tight text-white">
            FDI
          </span>
          <span className="hidden text-[14px] font-medium tracking-tight text-foreground sm:block">
            Financial Document Intelligence
          </span>
        </Link>

        {/* Desktop Navigation links - only shown if user logged in 
        {user && (
          <nav className="hidden items-center gap-1 lg:flex">
            {links.map((l) => {
              const active = l.to === "/" ? pathname === "/" : pathname.startsWith(l.to);
              return (
                <Link
                  key={l.to}
                  to={l.to}
                  className={`relative rounded-full px-4 py-2 text-[13.5px] font-medium transition-colors ${
                    active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-full bg-[var(--hover)]"
                      transition={{ type: "spring", stiffness: 350, damping: 30 }}
                    />
                  )}
                  <span className="relative">{l.label}</span>
                </Link>
              );
            })}
          </nav>
        )} */}

        <div className="flex items-center gap-2">
          {user ? (
            <>
              {/* Notifications */}
              <button
                aria-label="Notifications"
                className="relative grid h-9 w-9 place-items-center rounded-full border border-border bg-white/60 text-muted-foreground transition-colors hover:bg-[var(--hover)]"
              >
                <Bell className="h-4 w-4" />
                <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[var(--gold)]" />
              </button>

              {/* User Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-2xl hover:bg-[var(--hover)] transition-colors border border-transparent hover:border-gray-150 cursor-pointer"
                >
                  <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-[var(--navy)] to-[#1E3A8A] text-[11px] font-bold text-white shadow-sm">
                    {initials}
                  </div>
                  <span className="hidden md:block text-[13.5px] font-bold text-slate-700 max-w-[120px] truncate">
                    {user.name}
                  </span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 text-gray-400 transition-transform ${
                      dropdownOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                <AnimatePresence>
                  {dropdownOpen && (
                    <>
                      {/* Overlay blocker to close dropdown */}
                      <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.95 }}
                        transition={{ duration: 0.12 }}
                        className="absolute right-0 mt-2 w-56 origin-top-right rounded-2xl border border-gray-100 bg-white p-2 shadow-[0_10px_25px_-5px_rgba(15,23,42,0.1)] z-20 focus:outline-none"
                      >
                        <div className="px-3.5 py-2.5">
                          <p className="text-[13px] font-bold text-slate-800 truncate">{user.name}</p>
                          <p className="text-[10.5px] text-gray-400 truncate mt-0.5">{user.email}</p>
                        </div>
                        <div className="border-t border-slate-50 my-1" />
                        
                        <Link
                          to="/"
                          onClick={() => setDropdownOpen(false)}
                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[12.5px] text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                          <LayoutDashboard className="h-4 w-4 text-gray-400" />
                          Upload Dashboard
                        </Link>
                        
                        <Link
                          to="/account"
                          onClick={() => setDropdownOpen(false)}
                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[12.5px] text-slate-650 hover:bg-slate-50 transition-colors"
                        >
                          <Settings className="h-4 w-4 text-gray-400" />
                          Account Settings
                        </Link>
                        
                        <div className="border-t border-slate-50 my-1" />
                        
                        <button
                          onClick={() => {
                            setDropdownOpen(false);
                            handleLogout();
                          }}
                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[12.5px] text-red-600 hover:bg-red-50/50 transition-colors font-bold cursor-pointer"
                        >
                          <LogOut className="h-4 w-4" />
                          Sign out
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <Link to="/login" className="text-[13px] font-bold text-slate-650 hover:text-slate-900 transition-colors">
                Sign in
              </Link>
              <Link
                to="/register"
                className="inline-flex h-9 items-center rounded-xl bg-[var(--navy)] px-4.5 text-[12.5px] font-bold text-white transition-opacity hover:opacity-90 shadow-sm"
              >
                Get Started
              </Link>
            </div>
          )}

          {user && (
            <button
              aria-label="Menu"
              onClick={() => setOpen((v) => !v)}
              className="grid h-9 w-9 place-items-center rounded-full border border-border lg:hidden"
            >
              {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {open && user && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="lg:hidden border-t border-border bg-white/95 backdrop-blur"
          >
            <div className="mx-auto flex max-w-[1440px] flex-col gap-1 p-4">
              {links.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-[14px] hover:bg-[var(--hover)]"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

export function Page({ children, requireAuth = true }: { children: React.ReactNode; requireAuth?: boolean }) {
  const token = useAuthStore((s) => s.token);
  const navigate = useNavigate();

  // Helper to synchronously read persisted token on client to prevent hydration flashes
  const getPersistedToken = () => {
    if (typeof window === "undefined") return null;
    try {
      const rawStore = window.localStorage.getItem("fdi-auth-storage");
      if (rawStore) {
        const parsed = JSON.parse(rawStore);
        return parsed?.state?.token || null;
      }
    } catch (e) {
      return null;
    }
    return null;
  };

  const activeToken = token || getPersistedToken();

  useEffect(() => {
    if (requireAuth && !activeToken) {
      toast.error("Please sign in to access this section.");
      navigate({ to: "/login" });
    }
  }, [activeToken, requireAuth, navigate]);

  if (requireAuth && !activeToken) {
    return null; // Stop rendering child contents to prevent layout flashes
  }

  return (
    <div className="min-h-screen bg-[var(--surface)]">
      <TopNav />
      <main className="mx-auto max-w-[1440px] px-4 py-10 pb-24 md:px-8 md:py-14 md:pb-28">{children}</main>
      <ProgressPanel />
    </div>
  );
}
