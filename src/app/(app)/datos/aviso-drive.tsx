"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";

/** Muestra el resultado de la vuelta de OAuth y limpia la query para que no se repita al recargar. */
export function AvisoDrive({ estado, motivo }: { estado?: string; motivo?: string }) {
  const router = useRouter();
  useEffect(() => {
    if (!estado) return;
    if (estado === "ok") toast.success("Google Drive conectado.");
    else toast.error(motivo === "no-configurado" ? "Drive no está configurado en este servidor." : motivo === "cancelado" ? "Cancelaste la conexión con Drive." : (motivo ?? "No se pudo conectar Drive."));
    router.replace("/datos");
  }, [estado, motivo, router]);
  return null;
}
