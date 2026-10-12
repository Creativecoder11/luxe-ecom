import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { Alert } from "@/components/ui/display";
import { getEmailSender } from "@/integrations/email";
import { ForgotPasswordForm } from "../forms";

export const metadata: Metadata = { title: "Forgot password", robots: { index: false } };

export default function ForgotPasswordPage() {
  const emailReady = getEmailSender().isConfigured();
  const devMode = process.env.APP_ENV === "development" || process.env.APP_ENV === "test";
  return (
    <AuthCard
      title="Reset your password"
      description="We'll email you a link to choose a new password."
      footer={<Link href="/login" className="font-medium text-foreground hover:underline">Back to sign in</Link>}
    >
      {emailReady ? (
        <ForgotPasswordForm />
      ) : devMode ? (
        <div className="space-y-4">
          <Alert tone="warning" title="Email is not configured">
            Development mode: no email is sent. The reset link is written to the server log instead.
          </Alert>
          <ForgotPasswordForm />
        </div>
      ) : (
        <Alert tone="info" title="Password reset by email is not available yet">
          Please contact our support team and we will help you regain access.
        </Alert>
      )}
    </AuthCard>
  );
}
