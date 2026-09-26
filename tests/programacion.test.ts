import { describe, expect, it } from "vitest";
import { aMrkdwn, describir, destinoSchema, enmascarar, instanteDe, proximaEjecucion, recurrenciaSchema } from "@/lib/data/programacion";

const AR = "America/Argentina/Buenos_Aires";

describe("proximaEjecucion", () => {
  it("diaria: hoy si la hora no pasó, mañana si ya pasó (UTC-3)", () => {
    const desde = new Date("2026-09-25T12:00:00Z"); // 09:00 en AR
    expect(proximaEjecucion({ frecuencia: "diaria", hora: "10:30", timezone: AR }, desde).toISOString()).toBe("2026-09-25T13:30:00.000Z");
    expect(proximaEjecucion({ frecuencia: "diaria", hora: "08:00", timezone: AR }, desde).toISOString()).toBe("2026-09-26T11:00:00.000Z");
  });

  it("es estrictamente posterior: a la hora exacta pasa al día siguiente", () => {
    const desde = new Date("2026-09-25T13:30:00Z");
    expect(proximaEjecucion({ frecuencia: "diaria", hora: "10:30", timezone: AR }, desde).toISOString()).toBe("2026-09-26T13:30:00.000Z");
  });

  it("usa el día civil de la zona, no el de UTC", () => {
    // 23:30 del viernes 25 en AR = 02:30 UTC del sábado 26.
    const desde = new Date("2026-09-26T02:30:00Z");
    const r = proximaEjecucion({ frecuencia: "semanal", hora: "23:45", diaSemana: 5, timezone: AR }, desde);
    expect(r.toISOString()).toBe("2026-09-26T02:45:00.000Z");
  });

  it("semanal y mensual", () => {
    const desde = new Date("2026-09-25T12:00:00Z"); // viernes
    expect(proximaEjecucion({ frecuencia: "semanal", hora: "09:00", diaSemana: 1, timezone: AR }, desde).toISOString()).toBe("2026-09-28T12:00:00.000Z");
    expect(proximaEjecucion({ frecuencia: "mensual", hora: "09:00", diaMes: 1, timezone: AR }, desde).toISOString()).toBe("2026-10-01T12:00:00.000Z");
  });

  it("respeta el cambio de horario (Nueva York, DST termina el 1/11/2026)", () => {
    const tz = "America/New_York";
    expect(instanteDe(2026, 10, 31, 9, 0, tz).toISOString()).toBe("2026-10-31T13:00:00.000Z"); // EDT, UTC-4
    expect(instanteDe(2026, 11, 2, 9, 0, tz).toISOString()).toBe("2026-11-02T14:00:00.000Z"); // EST, UTC-5
  });
});

describe("validación", () => {
  it("exige día según la frecuencia y zona válida", () => {
    expect(recurrenciaSchema.safeParse({ frecuencia: "semanal", hora: "09:00", timezone: AR }).success).toBe(false);
    expect(recurrenciaSchema.safeParse({ frecuencia: "mensual", hora: "09:00", diaMes: 31, timezone: AR }).success).toBe(false);
    expect(recurrenciaSchema.safeParse({ frecuencia: "diaria", hora: "25:00", timezone: AR }).success).toBe(false);
    expect(recurrenciaSchema.safeParse({ frecuencia: "diaria", hora: "09:00", timezone: "Marte/Olympus" }).success).toBe(false);
    expect(recurrenciaSchema.safeParse({ frecuencia: "diaria", hora: "09:00", timezone: AR }).success).toBe(true);
  });

  it("valida destinos y enmascara webhooks", () => {
    expect(destinoSchema.safeParse({ canal: "slack", direccion: "https://evil.com/hook" }).success).toBe(false);
    expect(destinoSchema.safeParse({ canal: "email", direccion: "no-es-mail" }).success).toBe(false);
    const d = destinoSchema.parse({ canal: "slack", direccion: "https://hooks.slack.com/services/T000/B000/abcdefgh1234" });
    expect(enmascarar(d)).toBe("hooks.slack.com/…/••••1234");
    expect(enmascarar(d)).not.toContain("abcdefgh");
  });

  it("describe y convierte a mrkdwn", () => {
    expect(describir({ frecuencia: "semanal", hora: "09:00", diaSemana: 1, timezone: AR })).toBe("Todos los lunes a las 09:00");
    expect(aMrkdwn("**Hallazgo**: sube\n## Título")).toBe("*Hallazgo*: sube\n*Título*");
  });
});
