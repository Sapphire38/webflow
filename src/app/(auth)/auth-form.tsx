"use client";

import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EstadoForm } from "./actions";

export interface CampoForm {
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
}

export function AuthForm({
  action,
  campos,
  submit,
  hidden,
}: {
  action: (s: EstadoForm, fd: FormData) => Promise<EstadoForm>;
  campos: CampoForm[];
  submit: string;
  hidden?: Record<string, string>;
}) {
  const [estado, enviar, pendiente] = useActionState(action, {});
  return (
    <form action={enviar} className="space-y-5" noValidate>
      {Object.entries(hidden ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {campos.map((c) => (
        <div key={c.name} className="space-y-2">
          <Label htmlFor={c.name}>{c.label}</Label>
          <Input
            id={c.name}
            name={c.name}
            type={c.type ?? "text"}
            autoComplete={c.autoComplete}
            placeholder={c.placeholder}
            required
            aria-invalid={Boolean(estado.error)}
          />
        </div>
      ))}
      {estado.error && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-danger/10 px-3 py-2.5 text-sm text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" /> {estado.error}
        </p>
      )}
      {estado.ok && (
        <p role="status" className="flex items-start gap-2 rounded-xl bg-ok/10 px-3 py-2.5 text-sm text-ok">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> {estado.ok}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={pendiente}>
        {pendiente && <Loader2 className="animate-spin" />}
        {submit}
      </Button>
    </form>
  );
}
