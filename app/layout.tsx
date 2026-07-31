import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NavigationFeedbackProvider } from "@/app/pending-ui";
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
  title: "Social Creative OS",
  description: "Sistema interno para estrategia, criacao, publicacao e engajamento social.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" data-scroll-behavior="smooth">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <NavigationFeedbackProvider>{children}</NavigationFeedbackProvider>
      </body>
    </html>
  );
}
