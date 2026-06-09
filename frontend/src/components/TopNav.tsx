import { Link, useRouterState } from "@tanstack/react-router";
import { Bell, Search, Menu, X } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const links = [
  { to: "/", label: "Upload" },
  { to: "/processing", label: "Processing" },
  { to: "/mapping", label: "Mapping" },
  { to: "/validation", label: "Validation" },
  { to: "/dashboard", label: "Dashboard" },
];

export function TopNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  return (
    <header className="glass-nav sticky top-0 z-50">
      <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-4 md:px-8">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--navy)] text-[13px] font-semibold tracking-tight text-white">
            FDI
          </span>
          <span className="hidden text-[14px] font-medium tracking-tight text-foreground sm:block">
            Financial Document Intelligence
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {links.map((l) => {
            const active = l.to === "/" ? pathname === "/" : pathname.startsWith(l.to);
            return (
              <Link
                key={l.to}
                to={l.to}
                className={`relative rounded-full px-4 py-2 text-[13.5px] font-medium transition-colors ${active ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {active && (
                  <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-full bg-[var(--hover)]" transition={{ type: "spring", stiffness: 350, damping: 30 }} />
                )}
                <span className="relative">{l.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <button className="hidden h-9 items-center gap-2 rounded-full border border-border bg-white/60 px-3 text-[13px] text-muted-foreground transition-colors hover:bg-[var(--hover)] md:flex">
            <Search className="h-3.5 w-3.5" />
            <span>Search</span>
            <kbd className="ml-2 rounded border border-border bg-background px-1.5 text-[10px]">⌘K</kbd>
          </button>
          <button aria-label="Notifications" className="relative grid h-9 w-9 place-items-center rounded-full border border-border bg-white/60 text-muted-foreground transition-colors hover:bg-[var(--hover)]">
            <Bell className="h-4 w-4" />
            <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[var(--gold)]" />
          </button>
          <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-[var(--navy)] to-[var(--navy-2)] text-[12px] font-medium text-white">
            AC
          </div>
          <button aria-label="Menu" onClick={() => setOpen((v) => !v)} className="grid h-9 w-9 place-items-center rounded-full border border-border lg:hidden">
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="lg:hidden border-t border-border bg-white/95 backdrop-blur"
          >
            <div className="mx-auto flex max-w-[1440px] flex-col gap-1 p-4">
              {links.map((l) => (
                <Link key={l.to} to={l.to} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 text-[14px] hover:bg-[var(--hover)]">
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

export function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--surface)]">
      <TopNav />
      <main className="mx-auto max-w-[1440px] px-4 py-10 md:px-8 md:py-14">{children}</main>
    </div>
  );
}
