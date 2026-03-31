import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Insurvas",
  description: "Sign in to Insurvas.",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
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
