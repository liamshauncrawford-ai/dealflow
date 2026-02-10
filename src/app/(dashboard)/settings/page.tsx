import Link from "next/link";
import { Bot, Layers, Mail, Bell, Database, Shield, FolderOpen } from "lucide-react";

const settingsSections = [
  {
    title: "Scraping Configuration",
    description:
      "Manage platform cookies, scraping schedules, and trigger manual scrapes",
    href: "/settings/scraping",
    icon: Bot,
    color: "text-primary",
  },
  {
    title: "Deduplication",
    description:
      "Find and merge duplicate listings across platforms",
    href: "/settings/dedup",
    icon: Layers,
    color: "text-info",
  },
  {
    title: "Historical Deal Import",
    description:
      "Import deal data from your iCloud Drive Acquisition Targets folder",
    href: "/settings/import",
    icon: FolderOpen,
    color: "text-amber-600",
  },
  {
    title: "Email Integration",
    description:
      "Connect Gmail or Microsoft 365 for email tracking and listing alerts",
    href: "/settings/email",
    icon: Mail,
    color: "text-success",
  },
  {
    title: "Notifications",
    description:
      "Configure alerts for new listings, price changes, and pipeline updates",
    href: "/settings/notifications",
    icon: Bell,
    color: "text-warning",
    comingSoon: true,
  },
  {
    title: "Data & Backup",
    description:
      "Export data, manage database backups, and configure retention policies",
    href: "/settings/data",
    icon: Database,
    color: "text-muted-foreground",
    comingSoon: true,
  },
  {
    title: "Security",
    description:
      "Manage encryption keys, API tokens, and access settings",
    href: "/settings/security",
    icon: Shield,
    color: "text-destructive",
    comingSoon: true,
  },
];

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure your deal sourcing preferences and platform settings.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {settingsSections.map((section) => {
          const Icon = section.icon;
          const content = (
            <div
              className={`group relative rounded-lg border bg-card p-5 shadow-sm transition-all ${
                section.comingSoon
                  ? "cursor-not-allowed opacity-60"
                  : "hover:border-primary/30 hover:shadow-md"
              }`}
            >
              {section.comingSoon && (
                <span className="absolute right-3 top-3 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  Coming Soon
                </span>
              )}
              <div className="flex items-start gap-4">
                <div
                  className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-muted ${section.color}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold">{section.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {section.description}
                  </p>
                </div>
              </div>
            </div>
          );

          if (section.comingSoon) {
            return <div key={section.title}>{content}</div>;
          }

          return (
            <Link key={section.title} href={section.href}>
              {content}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
