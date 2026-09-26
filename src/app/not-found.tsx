import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <p className="num text-sm text-ember">404</p>
      <h1 className="mt-3 font-serif text-6xl">No está acá</h1>
      <p className="mt-3 text-ink-2">La página no existe o no tenés acceso.</p>
      <Button asChild className="mt-8">
        <Link href="/chat">Volver al chat</Link>
      </Button>
    </main>
  );
}
