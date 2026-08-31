import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { getRuntimeInfo } from "@/lib/metrics";

export const metadata: Metadata = {
  title: "Recura — AI Revenue Recovery",
  description:
    "A controlled AI agent that recovers failed subscription payments on Razorpay — with stopping rules, a full audit trail, and measured recovery metrics.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const info = await getRuntimeInfo();
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-bg text-fg antialiased" suppressHydrationWarning>
        <div className="flex min-h-screen">
          <Sidebar info={info} />
          <main className="flex-1 overflow-x-hidden">
            <div className="mx-auto w-full max-w-[1200px] px-6 py-8 lg:px-10">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
