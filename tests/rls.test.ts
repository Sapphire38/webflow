/**
 * Corre la migración real contra Postgres embebido (PGlite) con un stub mínimo
 * del esquema `auth` de Supabase, y verifica que RLS aísle a cada usuario.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";

const STUB_AUTH = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, raw_user_meta_data jsonb default '{}'::jsonb);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to authenticated, anon;
`;

let db: PGlite;

async function como<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role;");
  }
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(STUB_AUTH);
  for (const m of ["0001_init.sql", "0002_fuentes_remotas.sql", "0003_programaciones.sql"]) {
    await db.exec(readFileSync(join(__dirname, "../supabase/migrations", m), "utf8"));
  }
  await db.exec(`
    grant usage on schema public to authenticated;
    grant all on all tables in schema public to authenticated;
    insert into auth.users (id, raw_user_meta_data) values
      ('${A}', '{"full_name":"Ana"}'), ('${B}', '{"full_name":"Beto"}');
  `);
}, 30_000);

describe("migración + RLS", () => {
  it("el trigger crea el perfil con el nombre del signup", async () => {
    const r = await db.query<{ full_name: string }>(`select full_name from public.profiles where id = '${A}'`);
    expect(r.rows[0].full_name).toBe("Ana");
  });

  it("cada usuario ve solo sus datasets y user_id sale de auth.uid()", async () => {
    await como(A, () =>
      db.exec(`insert into public.datasets (nombre, campos, filas) values ('de Ana', '[]', '[]')`),
    );
    const deB = await como(B, () => db.query("select * from public.datasets"));
    const deA = await como(A, () => db.query<{ user_id: string }>("select user_id from public.datasets"));
    expect(deB.rows).toHaveLength(0);
    expect(deA.rows).toEqual([{ user_id: A }]);
  });

  it("no deja insertar filas a nombre de otro", async () => {
    await expect(
      como(B, () =>
        db.exec(`insert into public.dashboards (user_id, nombre) values ('${A}', 'intruso')`),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("no deja colgar un widget del dashboard de otro usuario", async () => {
    const { rows } = await como(A, () =>
      db.query<{ id: string }>(`insert into public.dashboards (nombre) values ('Tablero A') returning id`),
    );
    await expect(
      como(B, () =>
        db.exec(
          `insert into public.widgets (dashboard_id, titulo, spec) values ('${rows[0].id}', 'x', '{}')`,
        ),
      ),
    ).rejects.toThrow(/row-level security/);
    await como(A, () =>
      db.exec(`insert into public.widgets (dashboard_id, titulo, spec) values ('${rows[0].id}', 'ok', '{}')`),
    );
    const w = await como(A, () => db.query("select titulo from public.widgets"));
    expect(w.rows).toEqual([{ titulo: "ok" }]);
  });

  it("la conexión de Drive de un usuario es invisible para otro", async () => {
    await como(A, () => db.exec(`insert into public.conexiones_google (refresh_token_cifrado) values ('v1.x.y')`));
    const deB = await como(B, () => db.query("select * from public.conexiones_google"));
    expect(deB.rows).toHaveLength(0);
    await expect(
      como(B, () => db.exec(`insert into public.conexiones_google (user_id, refresh_token_cifrado) values ('${A}', 'robado')`)),
    ).rejects.toThrow();
  });

  it("acepta los orígenes nuevos y rechaza los desconocidos", async () => {
    await como(A, () => db.exec(`insert into public.datasets (nombre, campos, filas, origen, config) values ('api', '[]', '[]', 'api', '{"tipo":"api"}')`));
    await expect(
      como(A, () => db.exec(`insert into public.datasets (nombre, campos, filas, origen) values ('x', '[]', '[]', 'ftp')`)),
    ).rejects.toThrow(/check/);
  });

  it("una programación solo puede apuntar a un dashboard propio", async () => {
    const { rows } = await como(A, () => db.query<{ id: string }>(`insert into public.dashboards (nombre) values ('Prog A') returning id`));
    await expect(
      como(B, () =>
        db.exec(`insert into public.programaciones (dashboard_id, frecuencia, hora, destinos_cifrados) values ('${rows[0].id}', 'diaria', '09:00', 'v1.x.y')`),
      ),
    ).rejects.toThrow(/row-level security/);
    await como(A, () =>
      db.exec(`insert into public.programaciones (dashboard_id, frecuencia, hora, destinos_cifrados) values ('${rows[0].id}', 'diaria', '09:00', 'v1.x.y')`),
    );
    const deB = await como(B, () => db.query("select * from public.programaciones"));
    expect(deB.rows).toHaveLength(0);
    await expect(
      como(A, () => db.exec(`insert into public.programaciones (dashboard_id, frecuencia, hora, destinos_cifrados) values ('${rows[0].id}', 'diaria', '9am', 'v1')`)),
    ).rejects.toThrow(/check/);
  });

  it("sin sesión no se ve nada", async () => {
    await db.exec("set role authenticated; select set_config('request.jwt.claim.sub', '', false);");
    const r = await db.query("select * from public.datasets");
    await db.exec("reset role;");
    expect(r.rows).toHaveLength(0);
  });
});
