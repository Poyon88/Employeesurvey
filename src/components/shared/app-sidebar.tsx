"use client";

import {
  BarChart3,
  Building2,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTenant } from "@/hooks/use-tenant";

const navigationItems = [
  {
    title: "Tableau de bord",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Sondages",
    href: "/surveys",
    icon: ClipboardList,
  },
  {
    title: "Mes resultats",
    href: "/my-results",
    icon: BarChart3,
  },
];

const adminItems = [
  {
    title: "Utilisateurs",
    href: "/users",
    icon: Users,
  },
  {
    title: "Structure Orga",
    href: "/org-structure",
    icon: Building2,
  },
  {
    title: "Parametres",
    href: "/settings",
    icon: Settings,
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { tenant, subscription, loading } = useTenant();

  // Calculate trial days remaining
  const trialDaysRemaining =
    subscription?.status === "trialing" && subscription.trial_ends_at
      ? Math.max(
          0,
          Math.ceil(
            (new Date(subscription.trial_ends_at).getTime() - Date.now()) /
              (1000 * 60 * 60 * 24)
          )
        )
      : null;

  const showTrialBadge =
    trialDaysRemaining !== null && trialDaysRemaining > 0 && trialDaysRemaining < 7;

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-6 py-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ClipboardList className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold">PulseSurvey</span>
            {!loading && tenant && (
              <span className="text-xs text-muted-foreground truncate max-w-[140px]">
                {tenant.name}
              </span>
            )}
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith(item.href)}
                  >
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Administration</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith(item.href)}
                  >
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span className="flex-1">{item.title}</span>
                      {item.href === "/settings" && showTrialBadge && (
                        <Badge
                          className="ml-auto bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0"
                        >
                          Essai: {trialDaysRemaining}j
                        </Badge>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t p-4">
        <form action="/auth/signout" method="post">
          <Button variant="ghost" className="w-full justify-start" type="submit">
            <LogOut className="mr-2 h-4 w-4" />
            Se deconnecter
          </Button>
        </form>
      </SidebarFooter>
    </Sidebar>
  );
}
