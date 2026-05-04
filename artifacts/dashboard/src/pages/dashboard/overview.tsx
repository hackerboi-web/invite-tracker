import { useGetGuildStats, useGetGuild } from "@workspace/api-client-react";
import { DashboardLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Users, UserPlus, UserMinus, ShieldAlert } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function Overview({ params }: { params: { guildId: string } }) {
  const { guildId } = params;
  const { data: guild } = useGetGuild(guildId, { query: { enabled: !!guildId } });
  const { data: stats, isLoading } = useGetGuildStats(guildId, { query: { enabled: !!guildId } });

  if (isLoading || !stats || !guild) {
    return (
      <DashboardLayout guildId={guildId}>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout guildId={guildId}>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight">{guild.name} Overview</h1>
        <p className="text-muted-foreground mt-2">Server statistics and growth metrics.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Joins</CardTitle>
            <UserPlus className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{stats.totalJoins}</div>
          </CardContent>
        </Card>
        
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Leaves</CardTitle>
            <UserMinus className="w-4 h-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{stats.totalLeaves}</div>
          </CardContent>
        </Card>
        
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Net Growth</CardTitle>
            <Users className="w-4 h-4 text-[#00E676]" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{stats.netGrowth}</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Fake Accounts</CardTitle>
            <ShieldAlert className="w-4 h-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{stats.totalFake}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <Card className="bg-card border-border lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-white">Growth Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.joinsTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))" }}
                    itemStyle={{ color: "hsl(var(--foreground))" }}
                  />
                  <Line type="monotone" dataKey="joins" name="Joins" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="leaves" name="Leaves" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-white">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.recentActivity && stats.recentActivity.length > 0 ? (
                stats.recentActivity.slice(0, 5).map((activity, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <Avatar className="w-8 h-8 border border-border">
                      <AvatarFallback className="text-xs bg-secondary">
                        {activity.username.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white">
                        <span className="font-semibold">{activity.username}</span> 
                        {activity.type === 'join' ? ' joined' : ' left'}
                      </p>
                      {activity.type === 'join' && activity.inviterName && (
                        <p className="text-xs text-muted-foreground">
                          Invited by {activity.inviterName}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(activity.timestamp), 'MMM d, h:mm a')}
                      </p>
                    </div>
                    {activity.isFake && (
                      <Badge variant="outline" className="text-orange-500 border-orange-500/30 text-xs">Fake</Badge>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground text-center py-8">
                  No recent activity found.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
