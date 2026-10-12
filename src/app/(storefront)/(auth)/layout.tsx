export default function AuthLayout({ children }: LayoutProps<"/">) {
  return <div className="flex justify-center bg-surface-muted px-4 py-12 sm:py-16">{children}</div>;
}
