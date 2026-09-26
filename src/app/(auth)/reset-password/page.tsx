import { resetPassword } from "../actions";
import { AuthForm } from "../auth-form";

export const metadata = { title: "Nueva contraseña · Insight" };

export default function ResetPasswordPage() {
  return (
    <div className="rise">
      <h1 className="font-serif text-5xl tracking-tight">Contraseña nueva</h1>
      <p className="mt-2 text-sm text-ink-2">Elegí una que no uses en otro lado.</p>
      <div className="mt-8">
        <AuthForm
          action={resetPassword}
          submit="Guardar y entrar"
          campos={[
            { name: "password", label: "Contraseña nueva", type: "password", autoComplete: "new-password" },
            { name: "confirmar", label: "Repetila", type: "password", autoComplete: "new-password" },
          ]}
        />
      </div>
    </div>
  );
}
