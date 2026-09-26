import Link from "next/link";
import { signup } from "../actions";
import { AuthForm } from "../auth-form";

export const metadata = { title: "Crear cuenta · Insight" };

export default function SignupPage() {
  return (
    <div className="rise">
      <h1 className="font-serif text-5xl tracking-tight">Creá tu cuenta</h1>
      <p className="mt-2 text-sm text-ink-2">Gratis. Subís un CSV o usás el de ejemplo y en un minuto tenés tu primer gráfico.</p>
      <div className="mt-8">
        <AuthForm
          action={signup}
          submit="Crear cuenta"
          campos={[
            { name: "nombre", label: "Nombre", autoComplete: "name", placeholder: "Ada Lovelace" },
            { name: "email", label: "Email", type: "email", autoComplete: "email", placeholder: "vos@empresa.com" },
            { name: "password", label: "Contraseña", type: "password", autoComplete: "new-password", placeholder: "Mínimo 8 caracteres" },
          ]}
        />
      </div>
      <p className="mt-8 text-sm text-ink-2">
        ¿Ya tenés cuenta?{" "}
        <Link href="/login" className="font-medium text-ember underline-offset-4 hover:underline">
          Entrá
        </Link>
      </p>
    </div>
  );
}
