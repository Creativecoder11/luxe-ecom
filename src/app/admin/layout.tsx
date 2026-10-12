import type { Metadata } from "next";
import { sidebarBootScript } from "@/components/admin/sidebar-boot";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: { default: "Admin", template: `%s · Admin · ${siteConfig.name}` },
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div data-theme="admin" className="flex min-h-screen flex-1 flex-col bg-background text-foreground">
      <script dangerouslySetInnerHTML={{ __html: sidebarBootScript }} />
      {children}
    </div>
  );
}
