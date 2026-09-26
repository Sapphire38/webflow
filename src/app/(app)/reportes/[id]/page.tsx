import { notFound } from "next/navigation";
import { ReporteVista } from "@/components/reportes/reporte-vista";
import type { ChartSpec } from "@/lib/data/chart";
import { leerEstilo } from "@/lib/data/estilo";
import { requireUser } from "@/lib/supabase/server";
import { Acciones } from "./acciones";

export default async function ReportePage({ params }: PageProps<"/reportes/[id]">) {
  const { id } = await params;
  const { supabase } = await requireUser();
  const { data: r } = await supabase.from("reportes").select("id, titulo, contenido, datos, estilo, created_at").eq("id", id).maybeSingle();
  if (!r) notFound();
  return (
    <article className="mx-auto max-w-3xl px-4 py-8 md:px-8 md:py-14 print:max-w-none print:p-0">
      <div className="mb-6 flex justify-end print:hidden">
        <Acciones id={r.id} />
      </div>
      <ReporteVista
        titulo={r.titulo}
        contenido={r.contenido}
        datos={r.datos as ChartSpec[]}
        estilo={leerEstilo(r.estilo)}
        subtitulo={`Generado el ${new Date(r.created_at).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })} · Insight`}
      />
    </article>
  );
}
