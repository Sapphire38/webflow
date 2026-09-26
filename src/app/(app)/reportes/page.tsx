import Link from "next/link";
import { PageHeader, Vacio } from "@/components/app/page-header";
import { type ProgramacionVista, Programaciones } from "@/components/reportes/programaciones";
import { describir } from "@/lib/data/programacion";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "Reportes · Insight" };

export default async function ReportesPage() {
  const { supabase } = await requireUser();
  const [{ data: reportes }, { data: progs }, { data: envios }] = await Promise.all([
    supabase.from("reportes").select("id, titulo, contenido, created_at").order("created_at", { ascending: false }).limit(50),
    supabase
      .from("programaciones")
      .select("id, dashboard_id, frecuencia, hora, dia_semana, dia_mes, timezone, destinos_publicos, activa, proxima_ejecucion, ultima, dashboards(nombre)")
      .order("created_at", { ascending: false }),
    supabase.from("envios").select("id, programacion_id, canal, destinatario, estado, error, created_at").order("created_at", { ascending: false }).limit(100),
  ]);
  const fecha = (iso: string, tz = "America/Argentina/Buenos_Aires") =>
    new Date(iso).toLocaleString("es-AR", { timeZone: tz, dateStyle: "short", timeStyle: "short" });
  const programaciones: ProgramacionVista[] = (progs ?? []).map((p) => ({
    id: p.id,
    dashboardId: p.dashboard_id,
    dashboard: (p.dashboards as unknown as { nombre: string } | null)?.nombre ?? "Dashboard",
    descripcion: describir({ frecuencia: p.frecuencia, hora: p.hora, diaSemana: p.dia_semana ?? undefined, diaMes: p.dia_mes ?? undefined, timezone: p.timezone }),
    timezone: p.timezone,
    destinos: p.destinos_publicos as ProgramacionVista["destinos"],
    activa: p.activa,
    proxima: p.proxima_ejecucion ? fecha(p.proxima_ejecucion, p.timezone) : null,
    ultima: p.ultima ? { ...(p.ultima as NonNullable<ProgramacionVista["ultima"]>), at: fecha((p.ultima as { at: string }).at, p.timezone) } : null,
    envios: (envios ?? [])
      .filter((e) => e.programacion_id === p.id)
      .slice(0, 10)
      .map((e) => ({ id: e.id, canal: e.canal, destinatario: e.destinatario, estado: e.estado, error: e.error, fecha: fecha(e.created_at) })),
  }));
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-8 md:py-12">
      <PageHeader eyebrow="Narrativa" titulo="Reportes" />

      <section className="mt-10">
        <h2 className="font-serif text-3xl">Envíos programados</h2>
        {programaciones.length === 0 ? (
          <p className="mt-3 text-sm text-ink-2">
            Abrí un dashboard y tocá <strong>Programar envío</strong> para recibir el reporte por Slack o email todos los días, semanas o meses.
          </p>
        ) : (
          <Programaciones items={programaciones} />
        )}
      </section>

      <section className="mt-14">
        <h2 className="font-serif text-3xl">Generados</h2>
        {!reportes?.length ? (
          <Vacio titulo="Todavía no generaste reportes">
            Abrí un dashboard y tocá <strong>Reporte con IA</strong>: elegís el estilo, mirás la vista previa y lo guardás.
          </Vacio>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {reportes.map((r) => (
              <li key={r.id}>
                <Link href={`/reportes/${r.id}`} className="group block py-5">
                  <p className="font-serif text-2xl group-hover:text-ember">{r.titulo}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-ink-2">{r.contenido.replace(/[*_#-]/g, "")}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
