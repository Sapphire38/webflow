"use client";

import { Printer, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { borrarReporte } from "../../actions";

export function Acciones({ id }: { id: string }) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={() => window.print()}>
        <Printer /> Imprimir / PDF
      </Button>
      <Button
        variant="danger"
        size="sm"
        disabled={pendiente}
        onClick={() =>
          empezar(async () => {
            const r = await borrarReporte(id);
            if (!r.ok) return void toast.error(r.error);
            router.push("/reportes");
          })
        }
      >
        <Trash2 /> Borrar
      </Button>
    </div>
  );
}
