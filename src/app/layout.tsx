import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Assymo Configurator",
  description: "Interactieve 3D configurator met prijsberekening",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
