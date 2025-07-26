import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, CheckCircle, XCircle, Users, AlertCircle } from 'lucide-react';

interface DashboardStats {
  totalRequests: number;
  pendingRequests: number;
  approvedRequests: number;
  rejectedRequests: number;
  totalEmployees?: number;
}

interface RecentRequest {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  status: string;
  employee_name?: string;
}

export default function Dashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalRequests: 0,
    pendingRequests: 0,
    approvedRequests: 0,
    rejectedRequests: 0,
  });
  const [recentRequests, setRecentRequests] = useState<RecentRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) {
      fetchDashboardData();
    }
  }, [profile]);

  const fetchDashboardData = async () => {
    try {
      if (profile?.role === 'admin') {
        // Admin sees all requests and employee count
        const { data: requests } = await supabase
          .from('leave_requests')
          .select(`
            id,
            leave_type,
            start_date,
            end_date,
            status,
            employee_id,
            profiles!leave_requests_employee_id_fkey(first_name, last_name)
          `)
          .order('created_at', { ascending: false })
          .limit(5);

        const { count: totalEmployees } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true });

        const { count: totalRequests } = await supabase
          .from('leave_requests')
          .select('*', { count: 'exact', head: true });

        const { count: pendingRequests } = await supabase
          .from('leave_requests')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending');

        const { count: approvedRequests } = await supabase
          .from('leave_requests')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'approved');

        const { count: rejectedRequests } = await supabase
          .from('leave_requests')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'rejected');

        setStats({
          totalRequests: totalRequests || 0,
          pendingRequests: pendingRequests || 0,
          approvedRequests: approvedRequests || 0,
          rejectedRequests: rejectedRequests || 0,
          totalEmployees: totalEmployees || 0,
        });

        setRecentRequests(
          (requests || []).map(req => ({
            id: req.id,
            leave_type: req.leave_type,
            start_date: req.start_date,
            end_date: req.end_date,
            status: req.status,
            employee_name: req.profiles ? `${req.profiles.first_name} ${req.profiles.last_name}` : 'Unknown'
          }))
        );
      } else if (profile?.role === 'manager') {
        // Manager sees team requests - simplified approach
        const { data: requests } = await supabase
          .from('leave_requests')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(5);

        // Get team member IDs
        const { data: teamMembers } = await supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .eq('manager_id', profile.id);

        const teamMemberIds = teamMembers?.map(member => member.id) || [];
        const teamRequests = (requests || []).filter(req => 
          teamMemberIds.includes(req.employee_id) || req.employee_id === profile.id
        );

        const totalRequests = teamRequests.length;
        const pendingRequests = teamRequests.filter(req => req.status === 'pending').length;
        const approvedRequests = teamRequests.filter(req => req.status === 'approved').length;
        const rejectedRequests = teamRequests.filter(req => req.status === 'rejected').length;

        setStats({
          totalRequests,
          pendingRequests,
          approvedRequests,
          rejectedRequests,
        });

        // Get employee names for requests
        const requestsWithNames = await Promise.all(
          teamRequests.map(async (req) => {
            const employee = teamMembers?.find(member => member.id === req.employee_id);
            return {
              id: req.id,
              leave_type: req.leave_type,
              start_date: req.start_date,
              end_date: req.end_date,
              status: req.status,
              employee_name: employee ? `${employee.first_name} ${employee.last_name}` : 'Unknown'
            };
          })
        );

        setRecentRequests(requestsWithNames);
      } else {
        // Employee sees only their requests
        const { data: requests } = await supabase
          .from('leave_requests')
          .select('*')
          .eq('employee_id', profile.id)
          .order('created_at', { ascending: false })
          .limit(5);

        const totalRequests = requests?.length || 0;
        const pendingRequests = requests?.filter(req => req.status === 'pending').length || 0;
        const approvedRequests = requests?.filter(req => req.status === 'approved').length || 0;
        const rejectedRequests = requests?.filter(req => req.status === 'rejected').length || 0;

        setStats({
          totalRequests,
          pendingRequests,
          approvedRequests,
          rejectedRequests,
        });

        setRecentRequests(
          (requests || []).map(req => ({
            id: req.id,
            leave_type: req.leave_type,
            start_date: req.start_date,
            end_date: req.end_date,
            status: req.status,
          }))
        );
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge variant="default" className="bg-success text-success-foreground">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatLeaveType = (type: string) => {
    return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          Welcome back, {profile?.first_name}!
        </h1>
        <p className="text-muted-foreground">
          Here's an overview of your {profile?.role === 'employee' ? 'leave requests' : 'team activity'}.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalRequests}</div>
            <p className="text-xs text-muted-foreground">
              {profile?.role === 'employee' ? 'Your submissions' : 'Team submissions'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingRequests}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting approval
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.approvedRequests}</div>
            <p className="text-xs text-muted-foreground">
              Successfully approved
            </p>
          </CardContent>
        </Card>

        {profile?.role === 'admin' ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalEmployees}</div>
              <p className="text-xs text-muted-foreground">
                Active employees
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rejected</CardTitle>
              <XCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.rejectedRequests}</div>
              <p className="text-xs text-muted-foreground">
                Not approved
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recent Requests */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Leave Requests</CardTitle>
          <CardDescription>
            {profile?.role === 'employee' 
              ? 'Your latest leave requests' 
              : 'Latest requests from your team'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentRequests.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              <div className="text-center">
                <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                <p>No leave requests found</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {recentRequests.map((request) => (
                <div key={request.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{formatLeaveType(request.leave_type)}</h4>
                      {getStatusBadge(request.status)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {request.start_date} to {request.end_date}
                    </p>
                    {request.employee_name && (
                      <p className="text-sm text-muted-foreground">
                        Employee: {request.employee_name}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}