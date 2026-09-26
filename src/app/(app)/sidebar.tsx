"use client";

import { BarChart3, Database, FileText, LogOut, MessageSquare, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/logo";
import { conBase } from "@/lib/env";
import { cn } from "@/lib/utils";
import { Tutorial } from "./tutorial";

const NAV = [
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/datos", label: "Datos", icon: Database },
  { href: "/dashboards", label: "Dashboards", icon: BarChart3 },
  { href: "/reportes", label: "Reportes", icon: FileText },
];

export function Sidebar({
  userId,
  nombre,
  email,
  conversaciones,
}: {
  userId: string;
  nombre: string;
  email: string;
  conversaciones: { id: string; titulo: string }[];
}) {
  const path = usePathname();
  const activo = (href: string) => path === href || path.startsWith(`${href}/`);
  return (
    <aside className="sticky top-0 z-20 flex shrink-0 flex-col border-b border-line bg-paper/90 backdrop-blur md:h-dvh md:w-64 md:border-r md:border-b-0">
      <div className="flex items-center justify-between px-4 py-3 md:px-5 md:py-5">
        <Link href="/chat" aria-label="Insight">
          <Logo />
        </Link>
        <div className="flex items-center">
          <Tutorial userId={userId} />
          <form action={conBase("/auth/signout")} method="post" className="md:hidden">
            <button type="submit" className="rounded-full p-2 text-ink-2 hover:bg-paper-2" aria-label="Salir">
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:px-3 md:pb-0">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={activo(href) ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-3 rounded-full px-3.5 py-2 text-sm transition-colors",
              activo(href) ? "bg-ink text-paper" : "text-ink-2 hover:bg-paper-2 hover:text-ink",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="mt-6 hidden min-h-0 flex-1 flex-col md:flex">
        <div className="flex items-center justify-between px-5 pb-2">
          <p className="text-[11px] uppercase tracking-[0.14em] text-ink-3">Conversaciones</p>
          <Link href="/chat" className="rounded-full p-1 text-ink-3 hover:bg-paper-2 hover:text-ink" aria-label="Nueva conversación">
            <Plus className="size-4" />
          </Link>
        </div>
        <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3">
          {conversaciones.length === 0 && <li className="px-3 py-2 text-xs text-ink-3">Todavía no hay conversaciones.</li>}
          {conversaciones.map((c) => (
            <li key={c.id}>
              <Link
                href={`/chat/${c.id}`}
                className={cn(
                  "block truncate rounded-lg px-3 py-1.5 text-sm transition-colors",
                  path === `/chat/${c.id}` ? "bg-paper-2 text-ink" : "text-ink-2 hover:bg-paper-2 hover:text-ink",
                )}
              >
                {c.titulo}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <div className="hidden items-center gap-3 border-t border-line px-5 py-4 md:flex">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ember text-sm font-semibold text-ember-ink">
          {(nombre || email).slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{nombre}</p>
          <p className="truncate text-xs text-ink-3">{email}</p>
        </div>
        <form action={conBase("/auth/signout")} method="post">
          <button type="submit" className="rounded-full p-2 text-ink-2 hover:bg-paper-2 hover:text-ink" aria-label="Salir">
            <LogOut className="size-4" />
          </button>
        </form>
      </div>
    </aside>
  );
}
