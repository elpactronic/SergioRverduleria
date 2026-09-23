import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { ClerkProvider } from "@clerk/nextjs";
import { esUY } from "@clerk/localizations";
import { RegistrarServiceWorker } from "@/components/registrar-service-worker";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Verduleria Rogel",
  description: "Toma de pedidos y caja para Verduleria Rogel",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#16a34a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es-AR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <Script id="aplicar-tema-guardado" strategy="beforeInteractive">
          {`
            (function () {
              try {
                var modo = localStorage.getItem('verduleria:tema:modo') || 'sistema';
                var paleta = localStorage.getItem('verduleria:tema:paleta') || 'neutro';
                var fondo = localStorage.getItem('verduleria:tema:fondo');
                var oscuro = modo === 'oscuro' || (modo === 'sistema' && window.matchMedia('(prefers-color-scheme: dark)').matches);
                var root = document.documentElement;
                if (oscuro) root.classList.add('dark');
                if (paleta !== 'neutro') root.classList.add('paleta-' + paleta);
                if (fondo) root.style.setProperty('--background', fondo);
              } catch (e) {}
            })();
          `}
        </Script>
        <ClerkProvider localization={esUY}>
          <RegistrarServiceWorker />
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
