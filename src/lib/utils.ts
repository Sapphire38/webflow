import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const nf = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });
export const formatoNumero = (n: number) => nf.format(n);
