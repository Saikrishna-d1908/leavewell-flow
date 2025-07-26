import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { 
  LayoutDashboard, 
  CalendarDays, 
  FileText, 
  Users, 
  Settings, 
  Calendar,
  Clock,
  CheckSquare,
  BarChart3
} from 'lucide-react';

const employeeItems = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  { title: 'Request Leave', url: '/leave/request', icon: CalendarDays },
  { title: 'My Requests', url: '/leave/my-requests', icon: FileText },
  { title: 'Calendar', url: '/calendar', icon: Calendar },
];

const managerItems = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  { title: 'Team Requests', url: '/leave/team-requests', icon: CheckSquare },
  { title: 'Team Calendar', url: '/calendar', icon: Calendar },
  { title: 'Reports', url: '/reports', icon: BarChart3 },
];

const adminItems = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  { title: 'All Requests', url: '/admin/requests', icon: FileText },
  { title: 'Manage Users', url: '/admin/users', icon: Users },
  { title: 'Leave Policies', url: '/admin/policies', icon: Settings },
  { title: 'Holidays', url: '/admin/holidays', icon: Calendar },
  { title: 'Analytics', url: '/admin/analytics', icon: BarChart3 },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const { profile } = useAuth();
  const location = useLocation();

  const getNavigationItems = () => {
    switch (profile?.role) {
      case 'admin':
        return adminItems;
      case 'manager':
        return [...employeeItems, ...managerItems];
      default:
        return employeeItems;
    }
  };

  const items = getNavigationItems();
  const currentPath = location.pathname;
  const isCollapsed = state === 'collapsed';

  const isActive = (path: string) => currentPath === path;
  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-accent hover:text-accent-foreground';

  return (
    <Sidebar className={isCollapsed ? 'w-16' : 'w-64'} variant="sidebar">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className={isCollapsed ? 'sr-only' : ''}>
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} className={getNavCls}>
                      <item.icon className="h-4 w-4" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}