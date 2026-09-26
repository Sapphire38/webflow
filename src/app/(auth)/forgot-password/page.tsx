import Link from "next/link";
import { forgotPassword } from "../actions";
import { AuthForm } from "../auth-form";

export const metadata = { title: "Recuperar contraseña · Insight" };

export default function ForgotPasswordPage() {
  return (
    <div className="rise">
      <h1 className="font-serif text-5xl tracking-tight">¿Te olvidaste?</h1>
      <p className="mt-2 text-sm text-ink-2">Te mandamos un link para que elijas una contraseña nueva.</p>
      <div className="mt-8">
        <AuthForm
          action={forgotPassword}
          submit="Mandar link"
          campos={[{ name: "email", label: "Email", type: "email", autoComplete: "email", placeholder: "vos@empresa.com" }]}
        />
      </div>
      <Link href="/login" className="mt-8 inline-block text-sm text-ink-2 underline-offset-4 hover:text-ink hover:underline">
        ← Volver a entrar
      </Link>
    </div>
  );
}
