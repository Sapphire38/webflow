import Link from "next/link";
import { Logo } from "@/components/logo";
import { AnimacionAuth } from "./animacion";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden border-r border-line bg-ink p-12 text-paper lg:flex lg:flex-col lg:justify-between">
        <Link href="/" className="text-paper">
          <Logo />
        </Link>
        <div className="relative">
          <p className="font-serif text-6xl leading-[0.95] tracking-tight">
            Preguntá lo que quieras.
            <br />
            <em className="text-ember">Respondé con datos.</em>
          </p>
          <AnimacionAuth />
        </div>
        <p className="num text-xs uppercase tracking-[0.2em] text-paper/50">Nerdearla 2026 · Webflow Cloud</p>
      </aside>
      <section className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <Link href="/" className="mb-10 inline-block lg:hidden">
            <Logo />
          </Link>
          {children}
        </div>
      </section>
    </main>
  );
}
