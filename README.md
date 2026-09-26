# Insight

**Conversá con tus datos.** Subís un CSV (o usás el de ejemplo), preguntás en lenguaje natural y salen
respuestas con cifras, gráficos, dashboards vivos y reportes ejecutivos escritos por IA.

Hecho para el **App Challenge de Webflow · Nerdearla 2026**. Es un port a Next.js del analista conversacional del ecosistema Selene, con identidad visual propia.

| | |
|---|---|
| Framework | Next.js 16 (App Router, Server Actions, route handlers en Edge) |
| Auth | Supabase Auth: email + contraseña, magic link, confirmación por email, recuperar y restablecer contraseña |
| Datos | Supabase Postgres con **Row Level Security** por usuario |
| IA | MiniMax M2.7 vía Vercel AI SDK v7 (endpoint compatible con OpenAI), streaming + tool calling |
| UI | Tailwind v4 + primitivos estilo shadcn/ui (Radix), Recharts, tipografía Instrument Serif / Geist |
| Fuentes | CSV, **Webflow CMS** (colecciones vía Data API v2), **Google Sheets** por link, **API REST** (JSON, headers cifrados) y **Google Drive** (OAuth), con actualización en un click |
| Tests | Vitest (95): motor, CSV, gráficos, tools del chat, auth, fuentes remotas, cifrado, OAuth y **RLS contra Postgres real (PGlite)** |
| Deploy | Webflow Cloud |

## Demo

- App: **https://webflow-eeebd5.webflow.io** (Webflow Cloud).
- Cuenta de prueba para el jurado: se comparte por el formulario del concurso (se crea con `npm run seed:demo`).
- Recorrido sugerido: *Chat* → tocá una sugerencia → "Guardar en dashboard" → *Dashboards* → "Reporte con IA"
  (elegí color y tono, generá la vista previa y guardalo) → "Programar envío" → *Datos* para conectar tu propio CSV,
  Google Sheet, API, Drive o colección de Webflow CMS.

## Cómo funciona

```
Navegador ──useChat──▶ /api/chat (Edge) ──streamText──▶ MiniMax
                          │   ▲                           │
                          │   └──── tool calls ◀──────────┘
                          ▼
             listar_datasets · ver_muestra · agregar_dataset · graficar · sugerir_preguntas
                          │
                          ▼
              motor de agregación (puro, testeado)  ◀── filas del dataset (Supabase + RLS)
```

**El modelo pregunta, el motor responde.** El LLM nunca hace cuentas: traduce la pregunta a una
*consulta* (`agruparPor`, `granularidad`, `operacion`, `campo`, `filtros`, `top`, `orden`) y el motor
determinístico de [`src/lib/data/engine.ts`](src/lib/data/engine.ts) la ejecuta. Si la consulta está mal
(un campo que no existe, sumar un texto), la tool devuelve el error como dato con los campos válidos y el
modelo se corrige en el paso siguiente.

**Gráficos reproducibles.** `graficar` recibe la misma consulta y calcula los datos en el servidor, así
cada gráfico lleva su *receta* (`{datasetId, consulta}`). Guardarlo en un dashboard guarda la receta, no
una foto: cada vez que abrís el tablero se recalcula. Antes de guardar, el servidor re-ejecuta la receta;
un widget que no reproduce no se guarda.

**Reportes narrados.** Desde un dashboard, "Generar reporte con IA" recalcula todos los widgets y le pasa
al modelo solo esas cifras (con totales) para que escriba el resumen ejecutivo. El reporte guarda el texto y
los datos de esa corrida, y se imprime o exporta a PDF desde el navegador.

**Reportes con estilo propio y vista previa.** Desde un dashboard, "Reporte con IA" abre un editor con vista
previa en vivo:
- *Marca*: color de acento (paleta o color libre), tipografía de títulos (editorial o moderna) y pie de página.
  Se aplican al instante sobre la vista previa, sin volver a llamar a la IA.
- *Voz de la IA*: tono (ejecutivo, cercano o técnico) e instrucciones propias ("empezá por el costo total…").
  Van al prompt como indicaciones de la empresa, siempre subordinadas a usar solo las cifras del tablero.
- "Generar vista previa" recalcula el dashboard y redacta el reporte **sin guardar nada**; "Guardar reporte" guarda
  exactamente lo que se vio. El estilo queda en el dashboard y lo usan también los envíos programados (el email sale
  con el acento, la tipografía y el pie de la empresa).

**Reportes programados.** Desde un dashboard, "Programar envío": diario, semanal o mensual a una hora civil en
cualquier zona IANA (el cálculo de la próxima corrida maneja cambios de horario). En cada corrida se recalculan
los widgets, la IA escribe el resumen y se manda por **Slack** (Incoming Webhook que pega el usuario) y/o **email**
(por Selene Hub con `SELENE_HUB_URL` + `SELENE_HUB_API_KEY`, o por Resend si hay `RESEND_API_KEY`). Los webhooks se guardan cifrados y en pantalla se ven enmascarados. Cada envío
queda registrado (enviado/error) y un destino que falla no frena al resto. "Enviar ahora" corre lo mismo al instante.

El disparador es `pg_cron` + `pg_net` de Supabase, que cada 5 minutos llama a `/api/cron/reportes` con un
`Bearer CRON_SECRET` (comparación en tiempo constante). El endpoint reprograma cada vencida **antes** de ejecutarla y
con un update condicional, así dos pasadas concurrentes no duplican envíos. Como corre sin usuario usa la service
role, y por eso todas las consultas del núcleo de reportes filtran por `user_id` explícitamente además de RLS.

**Fuentes de datos.** Además del CSV:
- *Webflow CMS*: con un token de API del sitio (`sites:read` + `cms:read`) listamos las colecciones de todos los sitios
  y cada item pasa a ser una fila: `fieldData` aplanado (rich text a texto, imágenes a URL, opciones y referencias a
  valores legibles) más `estado` (publicado/borrador) y las fechas de creación y publicación, para preguntar cosas como
  "¿cuántos posts publicamos por mes?". Pagina de a 100 items; el token se guarda cifrado.
- *Google Sheets por link*: la hoja compartida como "cualquiera con el enlace" se baja como CSV (respeta la pestaña del `gid`). Sin login de Google.
- *API REST*: cualquier `GET` que devuelva JSON. Detecta la primera lista de objetos (o usa el path que indiques) y aplana un nivel de anidamiento (`planta.nombre`). Los headers (tokens, API keys) se guardan cifrados con AES-256-GCM y nunca vuelven al navegador. Bloquea direcciones privadas, locales y de metadata, también después de un redirect (anti-SSRF).
- *Google Drive (OAuth)*: acceso de solo lectura para listar e importar planillas nativas (exportadas a CSV) y archivos `.csv`. El `state` del OAuth va cifrado y atado al usuario y vence en 10 minutos. El refresh token se guarda cifrado; desconectar lo revoca en Google.

Las tres se pueden **actualizar** desde la tarjeta del dataset, y los dashboards que las usan se recalculan con los datos nuevos.

**Sugerencias y voz.** Cada respuesta termina con 2 o 3 preguntas de seguimiento que se envían con un click: el
modelo las propone con la tool `sugerir_preguntas` y el turno se corta ahí (`hasToolCall`) para que no agregue relleno.
El composer tiene dictado por voz (Web Speech API, en castellano) donde el navegador lo soporta.

**La historia vive en el servidor.** El cliente manda solo el mensaje nuevo; la conversación completa
(mensajes UI del AI SDK, incluidas las tool calls) se guarda en `conversaciones.mensajes` al terminar cada turno.

## Estructura

```
src/
  app/
    page.tsx                 landing pública
    (auth)/                  login (contraseña o magic link), signup, forgot/reset password + server actions
    auth/{callback,confirm}  canje PKCE / token_hash de los links de email
    auth/signout             cierre de sesión (POST)
    (app)/                   área autenticada: chat, datos, dashboards, reportes + server actions
    api/chat/route.ts        streaming del chat con tools (Edge)
  components/                chat, gráficos, primitivos UI
  lib/
    data/                    motor de agregación, CSV, specs de gráfico, dataset de ejemplo (sin I/O)
    server/                  modelo (MiniMax), tools, prompt, acceso a datasets
    supabase/                clientes browser/server y requireUser()
    auth/redirect.ts         destinos seguros (anti open-redirect) y URLs de callback con mount path
supabase/migrations/         esquema + RLS (0001 base, 0002 fuentes remotas y Drive, 0003 programaciones, 0004 estilo de reportes, 0005 Webflow)
supabase/cron.sql            plantilla del disparador pg_cron
scripts/seed-demo.ts         cuenta demo para el jurado
tests/                       Vitest
```

## Seguridad

- **RLS en todas las tablas.** Cada fila tiene `user_id default auth.uid()` y la política exige
  `auth.uid() = user_id`, también en el `with check`: no se puede leer ni escribir a nombre de otro. Un widget
  solo puede colgar de un dashboard propio. Está probado contra Postgres en [`tests/rls.test.ts`](tests/rls.test.ts).
- **`getUser()`, no `getSession()`.** Todas las páginas protegidas, las actions y el route handler validan el JWT contra Supabase.
- **Sin open redirects.** `?next=` solo acepta rutas internas.
- **No se enumeran cuentas.** Magic link y recuperación responden igual exista o no el email.
- **Entrada validada con zod** en el servidor. Los tipos de un CSV se re-infieren en el servidor en vez de confiar en el navegador.
- **Credenciales fuera del repo.** `.env*` está en `.gitignore`, salvo `.env.example` con placeholders. La
  service role key solo la usa el script de seed local: nunca va al deploy.

## Setup local

Requisitos: Node 22+ y npm. Webflow Cloud solo soporta npm.

```bash
npm install
cp .env.example .env.local   # completar con tus valores
```

1. **Supabase.** Creá un proyecto y corré, en orden, [`0001_init.sql`](supabase/migrations/0001_init.sql) y
   [`0002_fuentes_remotas.sql`](supabase/migrations/0002_fuentes_remotas.sql) y
   [`0003_programaciones.sql`](supabase/migrations/0003_programaciones.sql) y
   [`0004_estilo_reportes.sql`](supabase/migrations/0004_estilo_reportes.sql) y
   [`0005_webflow.sql`](supabase/migrations/0005_webflow.sql) en el SQL Editor. En *Authentication → URL Configuration* poné tu URL como **Site URL** y agregá
   `http://localhost:3000/**` y `https://<tu-app>/**` a **Redirect URLs**.
2. **MiniMax.** Poné `MINIMAX_API_KEY` en `.env.local`, y `FUENTES_SECRET` (`openssl rand -base64 32`).
3. **Drive (opcional).** En Google Cloud Console habilitá la *Google Drive API*, configurá la pantalla de consentimiento
   (agregá como *test users* las cuentas que vayan a probar, porque `drive.readonly` es un scope restringido y sin
   verificación de Google solo lo pueden usar esos usuarios) y creá un cliente OAuth *Web application* con la redirect
   URI `https://<tu-app>/api/drive/callback`. Cargá `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`. Sin estas variables,
   la pestaña Drive lo avisa y el resto funciona igual.
4. Levantá la app:

```bash
npm run dev
```

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm test` | Tests (Vitest) |
| `npm run typecheck` | Genera los tipos de rutas y corre `tsc` |
| `npm run seed:demo` | Crea o reinicia la cuenta demo con dataset, dashboard y widgets |

## Cuenta demo para el jurado

```bash
# en .env.local: SUPABASE_SERVICE_ROLE_KEY, DEMO_EMAIL y DEMO_PASSWORD
npm run seed:demo
```

Crea el usuario ya confirmado, carga 480 órdenes de trabajo de ejemplo y arma el dashboard
"Mantenimiento 2026" con cinco widgets (KPI, línea, barras, torta y tabla). Se puede correr varias veces:
reinicia los datos de esa cuenta. Las credenciales se comparten por fuera del repo.

## Deploy en Webflow Cloud

1. Subí el repo a GitHub.
2. En Webflow: **New Project → App**, importá el repositorio y elegí la rama.
3. En *Environment variables* cargá `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `MINIMAX_API_KEY` y `FUENTES_SECRET` (las dos como **Secret**), `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` si usás Drive, y opcionalmente `MINIMAX_BASE_URL` y `MINIMAX_MODEL`. Si la
   app va montada en un subpath, cargá también `NEXT_PUBLIC_BASE_PATH` con ese path.
   Para reportes programados sumá `CRON_SECRET` y `SUPABASE_SERVICE_ROLE_KEY` (Secrets), y para email `SELENE_HUB_URL` +
   `SELENE_HUB_API_KEY` (Secret) o `RESEND_API_KEY` + `EMAIL_FROM`.
4. Deploy. Después agregá la URL pública a *Redirect URLs* en Supabase, y corré [`supabase/cron.sql`](supabase/cron.sql)
   (con tu URL y tu `CRON_SECRET`) en el SQL Editor para activar el disparador.

Notas de plataforma: no hay `basePath` en `next.config.ts` (Webflow lo inyecta), los `fetch` del cliente usan
`conBase()` y los route handlers declaran `runtime = "edge"`. No usamos `proxy`/middleware: la sesión se valida
en cada layout, action y route handler, y el cliente de Supabase del navegador refresca el token.

## Tests

```bash
npm test
```

- `engine.test.ts`: agregaciones, granularidad por período, filtros (incluido `hasta` inclusivo), "Otras", errores explicativos, dataset determinístico.
- `csv-chart.test.ts`: parseo de CSV, recorte a 5.000 filas, límites de gráficos, KPIs.
- `tools.test.ts`: las tools del chat con Supabase mockeado (cache por request, recetas, errores como datos).
- `auth-redirect.test.ts`: anti open-redirect y URLs de callback con mount path.
- `chat-helpers.test.ts`: títulos de conversación y prompt de sistema.
- `remote.test.ts`: links de Sheets, anti-SSRF (incluidos redirects), extracción de filas, headers, cifrado AES-GCM, `state` de OAuth, importadores con `fetch` simulado.
- `programacion.test.ts`: próxima ejecución (día civil de la zona, DST en Nueva York, estrictamente posterior), validaciones, enmascarado de webhooks.
- `envios.test.ts`: Slack, Selene Hub y Resend con `fetch` simulado, HTML escapado, destinos cifrados, autenticación del endpoint de cron.
- `estilo.test.ts`: validación del estilo (el color termina en CSS y las instrucciones en el prompt), tinta legible sobre el acento.
- `webflow.test.ts`: items del CMS a filas (rich text, imágenes, estado, fechas), paginación, errores de token y permisos.
- `rls.test.ts`: corre las migraciones reales en PGlite con un stub de `auth` y verifica el aislamiento entre usuarios, incluida la conexión de Drive.

## Qué quedó afuera respecto de la versión original

Conectores por webhook, las fuentes del ecosistema Selene (Enterprise/Tickets), MCP, las
plantillas de reportes con CSS propio y temas, los envíos por WhatsApp, reglas de recurrencia arbitrarias (rrule)
y la multi-empresa con roles. El diseño deja lugar para sumarlos: las recetas ya son reproducibles
y el motor es el mismo para chat, widgets y reportes.
