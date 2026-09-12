import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "flybrowser",
  description: "Watch a trained simulated fly circuit complete a browser task.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
