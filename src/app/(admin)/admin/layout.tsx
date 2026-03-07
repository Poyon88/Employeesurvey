import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/shared/admin-sidebar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <AdminSidebar />
      <main className="flex-1 overflow-auto">
        <div className="flex items-center gap-2 border-b px-4 py-2">
          <SidebarTrigger />
          <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded">
            SUPER ADMIN
          </span>
        </div>
        <div className="p-6">{children}</div>
      </main>
    </SidebarProvider>
  );
}
