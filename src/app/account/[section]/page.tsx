import { notFound } from "next/navigation";
import { ModuleStatusNotice } from "@/components/common/module-status-notice";
import { accountSections } from "@/config/modules";

export function generateStaticParams() {
  return accountSections.filter((s) => s.status === "planned").map((s) => ({ section: s.href.split("/")[2]! }));
}

// notFound() runs before anything streams, so unknown sections get a real HTTP 404.
export default async function AccountSectionPage({ params }: PageProps<"/account/[section]">) {
  const { section } = await params;
  const match = accountSections.find((s) => s.href === `/account/${section}` && s.status === "planned");
  if (!match) notFound();
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">{match.label}</h2>
      <ModuleStatusNotice status="planned" gate={match.gate} />
    </div>
  );
}

