import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Insight",
  description: "Conversá con tus datos: preguntás y salen gráficos, dashboards y reportes.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body className="relative min-h-full flex flex-col">
        <div className="relative z-10 flex min-h-full flex-1 flex-col">{children}</div>
        <Toaster position="bottom-right" toastOptions={{ className: "!rounded-xl !border-line !bg-card !text-ink" }} />
      </body>
    </html>
  );
}
