import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, Vacio } from "@/components/app/page-header";
import { VistaWidget } from "@/components/chart/chart-view";
import { Button } from "@/components/ui/button";
import { ProgramarEnvio } from "@/components/reportes/programar-dialog";
import { ReporteDialog } from "@/components/reportes/reporte-dialog";
import { leerEstilo } from "@/lib/data/estilo";
import { emailConfigurado } from "@/lib/server/envios";
import { requireUser } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { resolverWidgets } from "../../actions";
import { AccionesWidget } from "../cliente";

const ANCHO = { 1: "", 2: "md:col-span-2", 3: "md:col-span-2 xl:col-span-3" } as const;

export default async function DashboardPage({ params }: PageProps<"/dashboards/[id]">) {
  const { id } = await params;
  const { supabase } = await requireUser();
  const { data: dash } = await supabase.from("dashboards").select("id, nombre, estilo_reporte").eq("id", id).maybeSingle();
  if (!dash) notFound();
  const widgets = await resolverWidgets(id);
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-12">
      <PageHeader eyebrow="Dashboard" titulo={dash.nombre}>
        <Button asChild variant="outline">
          <Link href="/chat">Agregar desde el chat</Link>
        </Button>
        <ProgramarEnvio dashboardId={id} emailDisponible={emailConfigurado()} />
        <ReporteDialog dashboardId={id} estiloInicial={leerEstilo(dash.estilo_reporte)} deshabilitado={!widgets.some((w) => w.spec)} />
      </PageHeader>
      {widgets.length === 0 ? (
        <Vacio titulo="Este dashboard está vacío">
          Pedile un gráfico al chat y guardalo acá. Cada widget recalcula sus números cuando abrís el tablero.
        </Vacio>
      ) : (
        <ul className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {widgets.map((w, i) => (
            <li key={w.id} className={cn("rise flex flex-col rounded-2xl border border-line bg-card p-5", ANCHO[w.presentacion.ancho])} style={{ animationDelay: `${i * 60}ms` }}>
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <p className="font-medium">{w.titulo}</p>
                <AccionesWidget id={w.id} dashboardId={id} presentacion={w.presentacion} primero={i === 0} ultimo={i === widgets.length - 1} />
              </div>
              {w.spec ? (
                <VistaWidget spec={w.spec} presentacion={w.presentacion} className="flex-1" />
              ) : (
                <p role="alert" className="rounded-xl bg-warn/10 px-3 py-4 text-sm text-warn">
                  No se pudo calcular: {w.error}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
