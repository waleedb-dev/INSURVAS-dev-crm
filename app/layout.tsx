import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Woorkroom – Your place to work. Plan. Create. Control.",
  description: "Sign in to Woorkroom – the all-in-one workspace to plan, create, and control your projects.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Nunito+Sans:ital,opsz,wght@0,6..12,300;0,6..12,400;0,6..12,600;0,6..12,700;0,6..12,800;1,6..12,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-['Nunito_Sans',sans-serif] antialiased bg-[#f4f9fd] min-h-screen">
        {children}
      </body>
    </html>
  );
}
