import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { ActivityTracker } from "@/components/activity-tracker";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col min-w-0 pl-0 transition-all duration-300 md:pl-60">
        <Header />
        <main className="flex-1 overflow-x-hidden bg-muted/30 p-4 md:p-6">{children}</main>
      </div>
      <ActivityTracker />
    </div>
  );
}
