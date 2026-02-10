import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "3D Building Configurator",
  description: "Interactive 3D building configurator with live pricing",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
