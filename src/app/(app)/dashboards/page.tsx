import Link from "next/link";
import { PageHeader, Vacio } from "@/components/app/page-header";
import { requireUser } from "@/lib/supabase/server";
import { BorrarDashboard, NuevoDashboard } from "./cliente";

export const metadata = { title: "Dashboards · Insight" };

export default async function DashboardsPage() {
  const { supabase } = await requireUser();
  const { data } = await supabase
    .from("dashboards")
    .select("id, nombre, updated_at, widgets(count)")
    .order("updated_at", { ascending: false });
  const dashboards = (data ?? []).map((d) => ({
    ...d,
    cantidad: (d.widgets as unknown as { count: number }[])[0]?.count ?? 0,
  }));
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-8 md:py-12">
      <PageHeader eyebrow="Tableros" titulo="Dashboards">
        <NuevoDashboard />
      </PageHeader>
      {dashboards.length === 0 ? (
        <Vacio titulo="Ningún dashboard todavía">
          Pedile un gráfico al chat y tocá <strong>Guardar en dashboard</strong>, o creá uno vacío desde acá.
        </Vacio>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {dashboards.map((d, i) => (
            <li key={d.id} className="rise group relative rounded-2xl border border-line bg-card p-5 transition-colors hover:border-ink" style={{ animationDelay: `${i * 50}ms` }}>
              <Link href={`/dashboards/${d.id}`} className="block after:absolute after:inset-0">
                <p className="font-serif text-2xl leading-tight">{d.nombre}</p>
              </Link>
              <p className="num mt-6 text-xs text-ink-3">
                {d.cantidad} {d.cantidad === 1 ? "widget" : "widgets"} · {new Date(d.updated_at).toLocaleDateString("es-AR")}
              </p>
              <div className="absolute top-3 right-3 z-10 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                <BorrarDashboard id={d.id} nombre={d.nombre} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
