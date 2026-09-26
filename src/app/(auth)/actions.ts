"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { destinoSeguro, urlDeCallback } from "@/lib/auth/redirect";
import { BASE_PATH, urlPublica } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export interface EstadoForm {
  error?: string;
  ok?: string;
}

const email = z.string().trim().email("Ingresá un email válido.");
const password = z.string().min(8, "La contraseña necesita al menos 8 caracteres.");

async function origen() {
  // El `origin` del navegador es la URL pública; el host que ve el servidor puede ser interno.
  return urlPublica((await headers()).get("origin"));
}

/** Los mensajes de Supabase vienen en inglés; traducimos los que ve un usuario. */
function traducir(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials")) return "Email o contraseña incorrectos.";
  if (m.includes("email not confirmed")) return "Todavía no confirmaste tu email. Revisá tu casilla.";
  if (m.includes("already registered")) return "Ya existe una cuenta con ese email.";
  if (m.includes("rate limit") || m.includes("security purposes")) return "Demasiados intentos. Probá en un minuto.";
  if (m.includes("same as the old")) return "La nueva contraseña tiene que ser distinta de la anterior.";
  return msg;
}

export async function login(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const datos = z.object({ email, password: z.string().min(1, "Ingresá tu contraseña.") }).safeParse({
    email: fd.get("email"),
    password: fd.get("password"),
  });
  if (!datos.success) return { error: datos.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(datos.data);
  if (error) return { error: traducir(error.message) };
  redirect(destinoSeguro(fd.get("next") as string | null));
}

export async function magicLink(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const datos = email.safeParse(fd.get("email"));
  if (!datos.success) return { error: datos.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: datos.data,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: urlDeCallback(await origen(), BASE_PATH, destinoSeguro(fd.get("next") as string | null)),
    },
  });
  // No revelamos si el email existe: la respuesta es la misma.
  if (error && !error.message.toLowerCase().includes("signups not allowed")) return { error: traducir(error.message) };
  return { ok: "Si hay una cuenta con ese email, te mandamos un link para entrar." };
}

export async function signup(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const datos = z
    .object({ nombre: z.string().trim().min(2, "Contanos tu nombre.").max(80), email, password })
    .safeParse({ nombre: fd.get("nombre"), email: fd.get("email"), password: fd.get("password") });
  if (!datos.success) return { error: datos.error.issues[0].message };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: datos.data.email,
    password: datos.data.password,
    options: {
      data: { full_name: datos.data.nombre },
      emailRedirectTo: urlDeCallback(await origen(), BASE_PATH, "/chat"),
    },
  });
  if (error) return { error: traducir(error.message) };
  // Con confirmación de email desactivada Supabase devuelve la sesión directo.
  if (data.session) redirect("/chat");
  return { ok: "Listo. Te mandamos un email para confirmar la cuenta." };
}

export async function forgotPassword(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const datos = email.safeParse(fd.get("email"));
  if (!datos.success) return { error: datos.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(datos.data, {
    redirectTo: urlDeCallback(await origen(), BASE_PATH, "/reset-password"),
  });
  if (error) return { error: traducir(error.message) };
  return { ok: "Si hay una cuenta con ese email, te llegó un link para elegir una contraseña nueva." };
}

export async function resetPassword(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const datos = z
    .object({ password, confirmar: z.string() })
    .refine((d) => d.password === d.confirmar, { message: "Las contraseñas no coinciden." })
    .safeParse({ password: fd.get("password"), confirmar: fd.get("confirmar") });
  if (!datos.success) return { error: datos.error.issues[0].message };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "El link venció. Pedí uno nuevo desde “Olvidé mi contraseña”." };
  const { error } = await supabase.auth.updateUser({ password: datos.data.password });
  if (error) return { error: traducir(error.message) };
  redirect("/chat");
}
