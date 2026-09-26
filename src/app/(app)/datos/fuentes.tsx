"use client";

import { FileSpreadsheet, FileText, Globe, HardDrive, LayoutTemplate, Loader2, Plus, RefreshCw, Search, Sheet, Unplug, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { conBase } from "@/lib/env";
import { cn } from "@/lib/utils";
import { coleccionesWebflow, desconectarDrive, importarDesdeApi, importarDesdeDrive, importarDesdeSheets, importarDesdeWebflow, listarDrive, refrescarDataset } from "../actions";
import { SubirCsv } from "./cliente";

type Tab = "csv" | "sheets" | "api" | "drive" | "webflow";
const TABS: { v: Tab; label: string; icon: typeof Sheet }[] = [
  { v: "csv", label: "CSV", icon: FileText },
  { v: "sheets", label: "Google Sheets", icon: Sheet },
  { v: "api", label: "API REST", icon: Globe },
  { v: "drive", label: "Google Drive", icon: HardDrive },
  { v: "webflow", label: "Webflow CMS", icon: LayoutTemplate },
];

function avisar(r: { ok: boolean; error?: string; data?: { truncado?: boolean } }, router: ReturnType<typeof useRouter>) {
  if (!r.ok) return void toast.error(r.error);
  toast.success(r.data?.truncado ? "Dataset creado con las primeras 5.000 filas." : "Dataset creado.");
  router.refresh();
}

export function Fuentes({ drive, tabInicial }: { drive: { configurado: boolean; email: string | null }; tabInicial?: Tab }) {
  const [tab, setTab] = useState<Tab>(tabInicial ?? "csv");
  return (
    <section className="mt-8">
      <div role="tablist" aria-label="Tipo de fuente" className="flex gap-1 overflow-x-auto rounded-full border border-line p-1">
        {TABS.map(({ v, label, icon: Icon }) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={tab === v}
            onClick={() => setTab(v)}
            className={cn("flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors", tab === v ? "bg-ink text-paper" : "text-ink-2 hover:text-ink")}
          >
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="mt-4">
        {tab === "csv" && <SubirCsv />}
        {tab === "sheets" && <FormSheets />}
        {tab === "api" && <FormApi />}
        {tab === "drive" && <PanelDrive {...drive} />}
        {tab === "webflow" && <PanelWebflow />}
      </div>
    </section>
  );
}

function Panel({ children, ayuda }: { children: React.ReactNode; ayuda: React.ReactNode }) {
  return (
    <div className="grid gap-6 rounded-2xl border border-line bg-card p-5 md:grid-cols-[1fr_16rem] md:p-6">
      <div>{children}</div>
      <aside className="text-sm text-ink-2 md:border-l md:border-line md:pl-6">{ayuda}</aside>
    </div>
  );
}

function FormSheets() {
  const router = useRouter();
  const [link, setLink] = useState("");
  const [nombre, setNombre] = useState("");
  const [pendiente, empezar] = useTransition();
  return (
    <Panel
      ayuda={
        <>
          <p className="font-medium text-ink">Sin login de Google</p>
          <p className="mt-1">
            Compartí la hoja como <strong>“Cualquier persona con el enlace puede ver”</strong> y pegá el link. Se importa la pestaña del link (gid).
          </p>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          empezar(async () => avisar(await importarDesdeSheets(link, nombre), router));
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="sheets-link">Link de la hoja</Label>
          <Input id="sheets-link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sheets-nombre">Nombre del dataset</Label>
          <Input id="sheets-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ventas 2026" maxLength={80} />
        </div>
        <Button type="submit" disabled={pendiente || !link.trim()}>
          {pendiente ? <Loader2 className="animate-spin" /> : <Sheet />} Importar hoja
        </Button>
      </form>
    </Panel>
  );
}

function FormApi() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [nombre, setNombre] = useState("");
  const [pathFilas, setPathFilas] = useState("");
  const [headers, setHeaders] = useState<{ nombre: string; valor: string }[]>([]);
  const [pendiente, empezar] = useTransition();
  return (
    <Panel
      ayuda={
        <>
          <p className="font-medium text-ink">Cualquier API que devuelva JSON</p>
          <p className="mt-1">Buscamos la primera lista de objetos de la respuesta, o la que indiques con un path (por ejemplo <code className="num">data.items</code>).</p>
          <p className="mt-3">Los headers (tokens, API keys) se guardan <strong>cifrados</strong> y nunca vuelven al navegador.</p>
          <button type="button" className="mt-3 text-ember underline-offset-4 hover:underline" onClick={() => setUrl("https://jsonplaceholder.typicode.com/todos")}>
            Probar con una API pública
          </button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          empezar(async () => avisar(await importarDesdeApi({ nombre, url, pathFilas, headers }), router));
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="api-url">URL (GET)</Label>
          <Input id="api-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://api.ejemplo.com/v1/ordenes" required />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="api-nombre">Nombre</Label>
            <Input id="api-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Órdenes (API)" maxLength={80} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="api-path">Path de las filas (opcional)</Label>
            <Input id="api-path" value={pathFilas} onChange={(e) => setPathFilas(e.target.value)} placeholder="data.items" />
          </div>
        </div>
        <fieldset className="space-y-2">
          <legend className="text-xs font-medium uppercase tracking-[0.08em] text-ink-2">Headers</legend>
          {headers.map((h, i) => (
            <div key={i} className="flex gap-2">
              <Input aria-label="Nombre del header" value={h.nombre} placeholder="Authorization" onChange={(e) => setHeaders(headers.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x)))} />
              <Input aria-label="Valor del header" type="password" autoComplete="off" value={h.valor} placeholder="Bearer …" onChange={(e) => setHeaders(headers.map((x, j) => (j === i ? { ...x, valor: e.target.value } : x)))} />
              <Button type="button" variant="ghost" size="icon" aria-label="Quitar header" onClick={() => setHeaders(headers.filter((_, j) => j !== i))}>
                <X />
              </Button>
            </div>
          ))}
          {headers.length < 10 && (
            <Button type="button" variant="outline" size="sm" onClick={() => setHeaders([...headers, { nombre: "", valor: "" }])}>
              <Plus /> Agregar header
            </Button>
          )}
        </fieldset>
        <Button type="submit" disabled={pendiente || !url.trim()}>
          {pendiente ? <Loader2 className="animate-spin" /> : <Globe />} Conectar API
        </Button>
      </form>
    </Panel>
  );
}

interface Archivo {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
}

function PanelDrive({ configurado, email }: { configurado: boolean; email: string | null }) {
  const router = useRouter();
  const [archivos, setArchivos] = useState<Archivo[] | null>(null);
  const [buscar, setBuscar] = useState("");
  const [cargando, empezarCarga] = useTransition();
  const [importando, setImportando] = useState<string | null>(null);

  const cargar = (q = buscar) =>
    empezarCarga(async () => {
      const r = await listarDrive(q);
      if (!r.ok) return void toast.error(r.error);
      setArchivos(r.data ?? []);
    });

  useEffect(() => {
    if (email) cargar("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  if (!configurado) {
    return (
      <Panel ayuda={<p>Hace falta un cliente OAuth de Google (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET). Ver README.</p>}>
        <p className="font-medium">Drive no está configurado en este servidor.</p>
        <p className="mt-1 text-sm text-ink-2">Mientras tanto podés importar una hoja pública desde la pestaña Google Sheets.</p>
      </Panel>
    );
  }
  if (!email) {
    return (
      <Panel ayuda={<p>Pedimos acceso de <strong>solo lectura</strong>. Podés revocarlo cuando quieras desde acá o desde tu cuenta de Google.</p>}>
        <p className="font-medium">Conectá tu Google Drive</p>
        <p className="mt-1 text-sm text-ink-2">Importá planillas de Google y archivos .csv privados, y actualizalos con un click.</p>
        <Button asChild className="mt-4" variant="ember">
          <a href={conBase("/api/drive/autorizar")}>
            <HardDrive /> Conectar con Google
          </a>
        </Button>
      </Panel>
    );
  }
  return (
    <Panel
      ayuda={
        <>
          <p>
            Conectado como <strong className="text-ink">{email}</strong>.
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-3 -ml-3"
            onClick={async () => {
              await desconectarDrive();
              toast.success("Drive desconectado.");
              router.refresh();
            }}
          >
            <Unplug /> Desconectar
          </Button>
        </>
      }
    >
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          cargar();
        }}
      >
        <Input aria-label="Buscar en Drive" value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar planillas…" />
        <Button type="submit" variant="outline" size="icon" aria-label="Buscar">
          {cargando ? <Loader2 className="animate-spin" /> : <Search />}
        </Button>
      </form>
      <ul className="mt-4 max-h-72 divide-y divide-line overflow-y-auto">
        {archivos?.length === 0 && <li className="py-6 text-center text-sm text-ink-3">No encontré planillas ni CSV.</li>}
        {archivos?.map((a) => (
          <li key={a.id} className="flex items-center gap-3 py-2.5">
            {a.mimeType === "text/csv" ? <FileText className="size-4 text-ink-3" /> : <FileSpreadsheet className="size-4 text-ok" />}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{a.name}</p>
              <p className="num text-[11px] text-ink-3">{new Date(a.modifiedTime).toLocaleDateString("es-AR")}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={importando !== null}
              onClick={async () => {
                setImportando(a.id);
                avisar(await importarDesdeDrive(a.id), router);
                setImportando(null);
              }}
            >
              {importando === a.id ? <Loader2 className="animate-spin" /> : <Plus />} Importar
            </Button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function PanelWebflow() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [colecciones, setColecciones] = useState<{ id: string; nombre: string; sitio: string }[] | null>(null);
  const [cargando, empezar] = useTransition();
  const [importando, setImportando] = useState<string | null>(null);
  return (
    <Panel
      ayuda={
        <>
          <p className="font-medium text-ink">Tu CMS de Webflow, como dataset</p>
          <p className="mt-1">
            En Webflow: <strong>Site settings → Apps &amp; integrations → API access</strong>, generá un token con permisos de lectura de <em>Sites</em> y{" "}
            <em>CMS</em>.
          </p>
          <p className="mt-3">Cada item es una fila; sumamos su estado (publicado o borrador) y las fechas de creación y publicación. El token se guarda cifrado.</p>
        </>
      }
    >
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          empezar(async () => {
            const r = await coleccionesWebflow(token);
            if (!r.ok) return void toast.error(r.error);
            setColecciones(r.data ?? []);
          });
        }}
      >
        <Input aria-label="Token de API de Webflow" type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Token de API del sitio" />
        <Button type="submit" disabled={cargando || !token.trim()}>
          {cargando ? <Loader2 className="animate-spin" /> : <LayoutTemplate />} Ver colecciones
        </Button>
      </form>
      {colecciones && (
        <ul className="mt-4 max-h-72 divide-y divide-line overflow-y-auto">
          {colecciones.length === 0 && <li className="py-6 text-center text-sm text-ink-3">El sitio no tiene colecciones de CMS.</li>}
          {colecciones.map((c) => (
            <li key={c.id} className="flex items-center gap-3 py-2.5">
              <LayoutTemplate className="size-4 text-ink-3" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{c.nombre}</p>
                <p className="text-[11px] text-ink-3">{c.sitio}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={importando !== null}
                onClick={async () => {
                  setImportando(c.id);
                  avisar(await importarDesdeWebflow({ token, collectionId: c.id, coleccion: c.nombre, sitio: c.sitio }), router);
                  setImportando(null);
                }}
              >
                {importando === c.id ? <Loader2 className="animate-spin" /> : <Plus />} Importar
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function RefrescarDataset({ id }: { id: string }) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Actualizar desde la fuente"
      title="Actualizar desde la fuente"
      disabled={pendiente}
      onClick={() =>
        empezar(async () => {
          const r = await refrescarDataset(id);
          if (!r.ok) return void toast.error(r.error);
          toast.success(`Actualizado: ${r.data?.filas.toLocaleString("es-AR")} filas.`);
          router.refresh();
        })
      }
    >
      <RefreshCw className={cn(pendiente && "animate-spin")} />
    </Button>
  );
}
