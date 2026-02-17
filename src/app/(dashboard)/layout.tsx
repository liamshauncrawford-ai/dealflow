import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { ActivityTracker } from "@/components/activity-tracker";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Not authenticated — redirect to login
  if (!session?.user) {
    redirect("/login");
  }

  // Authenticated but not approved — redirect to access-request
  if (!session.user.isApproved) {
    redirect("/access-request");
  }

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
