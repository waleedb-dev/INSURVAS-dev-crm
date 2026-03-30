import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CRM Agent Portal",
  description: "Sign in to your CRM Agent Portal.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
