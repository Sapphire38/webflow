/**
 * Crea (o reinicia) la cuenta demo para el jurado, con el dataset de ejemplo,
 * un dashboard armado y una conversación vacía lista para probar.
 *
 *   npm run seed:demo
 *
 * Lee SUPABASE_SERVICE_ROLE_KEY, DEMO_EMAIL y DEMO_PASSWORD de .env.local.
 * La service role key solo se usa acá, en tu máquina: nunca va al deploy.
 */
import { createClient } from "@supabase/supabase-js";
import { presentacionSchema } from "../src/lib/data/chart";
import type { Consulta } from "../src/lib/data/engine";
import { datasetDeEjemplo } from "../src/lib/data/sample";

function requerida(nombre: string): string {
  const v = process.env[nombre];
  if (!v) {
    console.error(`Falta ${nombre} en .env.local (ver .env.example).`);
    process.exit(1);
  }
  return v;
}

const url = requerida("NEXT_PUBLIC_SUPABASE_URL");
const serviceKey = requerida("SUPABASE_SERVICE_ROLE_KEY");
const email = requerida("DEMO_EMAIL");
const password = requerida("DEMO_PASSWORD");
if (password.length < 8) {
  console.error("DEMO_PASSWORD necesita al menos 8 caracteres.");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

async function buscarUsuario(): Promise<string | null> {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const u = data.users.find((x) => x.email?.toLowerCase() === email.toLowerCase());
    if (u) return u.id;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function main() {
  let userId = await buscarUsuario();
  if (userId) {
    const { error } = await admin.auth.admin.updateUserById(userId, { password, email_confirm: true });
    if (error) throw error;
    console.log("Cuenta demo existente: contraseña actualizada.");
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Jurado Nerdearla" },
    });
    if (error) throw error;
    userId = data.user.id;
    console.log("Cuenta demo creada.");
  }

  // Estado limpio y reproducible en cada corrida.
  for (const t of ["envios", "programaciones", "reportes", "widgets", "dashboards", "conversaciones", "datasets"]) {
    const { error } = await admin.from(t).delete().eq("user_id", userId);
    if (error) throw error;
  }

  const ej = datasetDeEjemplo();
  const { data: ds, error: e1 } = await admin
    .from("datasets")
    .insert({ user_id: userId, nombre: ej.nombre, campos: ej.campos, filas: ej.filas, cantidad_filas: ej.filas.length, origen: "ejemplo" })
    .select("id")
    .single();
  if (e1) throw e1;

  const { data: dash, error: e2 } = await admin.from("dashboards").insert({ user_id: userId, nombre: "Mantenimiento 2026" }).select("id").single();
  if (e2) throw e2;

  const widgets: { titulo: string; tipo: "barras" | "linea" | "torta"; unidad?: string; consulta: Consulta; presentacion: object; horizontal?: boolean }[] = [
    { titulo: "Costo total", tipo: "barras", unidad: "$", consulta: { operacion: "sumar", campo: "costo" }, presentacion: { tipo: "kpi", ancho: 1, agregado: "suma" } },
    { titulo: "Órdenes por mes", tipo: "linea", consulta: { agruparPor: "fecha", granularidad: "mes", operacion: "contar" }, presentacion: { tipo: "grafico", ancho: 2 } },
    { titulo: "Costo por planta", tipo: "barras", unidad: "$", horizontal: true, consulta: { agruparPor: "planta", operacion: "sumar", campo: "costo" }, presentacion: { tipo: "grafico", ancho: 1 } },
    { titulo: "Órdenes por tipo", tipo: "torta", consulta: { agruparPor: "tipo", operacion: "contar" }, presentacion: { tipo: "grafico", ancho: 1 } },
    { titulo: "Horas promedio por equipo", tipo: "barras", unidad: "h", consulta: { agruparPor: "equipo", operacion: "promedio", campo: "horas" }, presentacion: { tipo: "tabla", ancho: 1 } },
  ];
  const { error: e3 } = await admin.from("widgets").insert(
    widgets.map((w, orden) => ({
      user_id: userId,
      dashboard_id: dash.id,
      titulo: w.titulo,
      spec: { tipo: w.tipo, titulo: w.titulo, unidad: w.unidad, horizontal: w.horizontal, receta: { datasetId: ds.id, consulta: w.consulta } },
      presentacion: presentacionSchema.parse(w.presentacion),
      orden,
    })),
  );
  if (e3) throw e3;

  console.log(`Listo: dataset (${ej.filas.length} filas) y dashboard "Mantenimiento 2026" con ${widgets.length} widgets.`);
  console.log(`Usuario: ${email} (la contraseña es la de DEMO_PASSWORD).`);
}

main().catch((e) => {
  console.error("Falló el seed:", e.message ?? e);
  process.exit(1);
});
