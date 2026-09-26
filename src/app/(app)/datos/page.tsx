import { PageHeader, Vacio } from "@/components/app/page-header";
import { listarDatasets } from "@/lib/server/datasets";
import { conexion, driveConfigurado } from "@/lib/server/drive";
import { requireUser } from "@/lib/supabase/server";
import { AvisoDrive } from "./aviso-drive";
import { BorrarDataset, CargarEjemplo } from "./cliente";
import { Fuentes, RefrescarDataset } from "./fuentes";

export const metadata = { title: "Datos · Insight" };

const ORIGEN: Record<string, string> = { csv: "CSV", ejemplo: "ejemplo", sheets: "Google Sheets", api: "API REST", drive: "Google Drive", webflow: "Webflow CMS" };

export default async function DatosPage({ searchParams }: PageProps<"/datos">) {
  const sp = await searchParams;
  const { supabase } = await requireUser();
  const [datasets, con] = await Promise.all([listarDatasets(supabase), conexion(supabase)]);
  // `?drive=` vuelve del OAuth de Google; `?fuente=webflow` llega desde el tutorial.
  const tabInicial = sp.drive ? "drive" : sp.fuente === "webflow" ? "webflow" : undefined;
  const tieneEjemplo = datasets.some((d) => d.origen === "ejemplo");
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-8 md:py-12">
      <AvisoDrive estado={typeof sp.drive === "string" ? sp.drive : undefined} motivo={typeof sp.motivo === "string" ? sp.motivo : undefined} />
      <PageHeader eyebrow="Fuentes" titulo="Tus datos">
        {!tieneEjemplo && <CargarEjemplo />}
      </PageHeader>
      {/* El key hace que cambie de pestaña aunque ya estés en /datos (el tab inicial es estado). */}
      <Fuentes key={tabInicial} drive={{ configurado: driveConfigurado(), email: con ? (con.email ?? "tu cuenta") : null }} tabInicial={tabInicial} />
      {datasets.length === 0 ? (
        <Vacio titulo="Todavía no hay datasets">Subí un CSV, importá una hoja de Google, conectá una API o cargá el ejemplo para probar.</Vacio>
      ) : (
        <ul className="mt-8 grid gap-4 md:grid-cols-2">
          {datasets.map((d, i) => (
            <li key={d.id} className="rise rounded-2xl border border-line bg-card p-5" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{d.nombre}</p>
                  <p className="num mt-1 text-xs text-ink-3">
                    {d.cantidad_filas.toLocaleString("es-AR")} filas · {d.campos.length} campos · {ORIGEN[d.origen] ?? d.origen}
                    {d.config && ` · act. ${new Date(d.actualizado_at).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}`}
                  </p>
                  {d.config?.url && <p className="num mt-1 truncate text-[11px] text-ink-3">{d.config.url}</p>}
                </div>
                <div className="flex shrink-0">
                  {d.config && <RefrescarDataset id={d.id} />}
                  <BorrarDataset id={d.id} nombre={d.nombre} />
                </div>
              </div>
              <ul className="mt-4 flex flex-wrap gap-1.5">
                {d.campos.slice(0, 14).map((c) => (
                  <li key={c.nombre} className="rounded-full border border-line px-2.5 py-1 text-xs">
                    <span className="text-ink">{c.nombre}</span>
                    <span className="num ml-1.5 text-ink-3">{c.tipo}</span>
                  </li>
                ))}
                {d.campos.length > 14 && <li className="px-2 py-1 text-xs text-ink-3">+{d.campos.length - 14}</li>}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
