import Link from "next/link";
import { login, magicLink } from "../actions";
import { AuthForm } from "../auth-form";
import { ModoLogin } from "./modo-login";

export const metadata = { title: "Entrar · Insight" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/chat";
  const errorLink = sp.error === "link";
  return (
    <div className="rise">
      <h1 className="font-serif text-5xl tracking-tight">Hola de nuevo</h1>
      <p className="mt-2 text-sm text-ink-2">Entrá para seguir conversando con tus datos.</p>
      {errorLink && (
        <p role="alert" className="mt-6 rounded-xl bg-danger/10 px-3 py-2.5 text-sm text-danger">
          El link no es válido o ya venció. Pedí uno nuevo.
        </p>
      )}
      <div className="mt-8">
        <ModoLogin
          password={
            <AuthForm
              action={login}
              submit="Entrar"
              hidden={{ next }}
              campos={[
                { name: "email", label: "Email", type: "email", autoComplete: "email", placeholder: "vos@empresa.com" },
                { name: "password", label: "Contraseña", type: "password", autoComplete: "current-password" },
              ]}
            />
          }
          magic={
            <AuthForm
              action={magicLink}
              submit="Mandame el link"
              hidden={{ next }}
              campos={[
                { name: "email", label: "Email", type: "email", autoComplete: "email", placeholder: "vos@empresa.com" },
              ]}
            />
          }
        />
      </div>
      <div className="mt-8 flex flex-wrap justify-between gap-2 text-sm">
        <Link href="/forgot-password" className="text-ink-2 underline-offset-4 hover:text-ink hover:underline">
          Olvidé mi contraseña
        </Link>
        <Link href="/signup" className="font-medium text-ember underline-offset-4 hover:underline">
          Crear cuenta →
        </Link>
      </div>
    </div>
  );
}
