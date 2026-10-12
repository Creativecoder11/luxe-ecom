import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { siteConfig } from "@/config/site";
import { StaffLoginForm } from "./login-form";

export const metadata: Metadata = { title: "Staff sign-in" };

export default function StaffLoginPage() {
  return (
    <main id="main-content" className="flex flex-1 flex-col items-center justify-center px-4 py-16">
      <p className="mb-6 font-display text-lg font-bold">{siteConfig.name} · Admin</p>
      <AuthCard
        title="Staff sign-in"
        description="For staff accounts only."
        footer="Forgot your password? Ask a business owner or admin to issue a temporary one."
      >
        <StaffLoginForm />
      </AuthCard>
    </main>
  );
}
