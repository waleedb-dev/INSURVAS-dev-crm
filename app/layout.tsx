import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Orbito – Your place to work. Plan. Create. Control.",
  description: "Sign in to Orbito – the all-in-one workspace to plan, create, and control your projects.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-[#f4f9fd] min-h-screen" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
