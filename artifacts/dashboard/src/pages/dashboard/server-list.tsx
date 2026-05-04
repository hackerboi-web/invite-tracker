import { useGetGuilds } from "@workspace/api-client-react";
import { Link } from "wouter";
import { DashboardLayout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function ServerList() {
  const { data: guilds, isLoading } = useGetGuilds();

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight">Select a Server</h1>
        <p className="text-muted-foreground mt-2">Choose a server to view its dashboard.</p>
      </div>

      {guilds?.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
              <Loader2 className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">No servers found</h2>
            <p className="text-muted-foreground max-w-md">
              You don't have manage permissions on any servers where the bot is installed.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {guilds?.map((guild) => (
            <Link key={guild.id} href={`/dashboard/${guild.id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer bg-card border-border h-full">
                <CardContent className="p-6 flex items-center gap-4">
                  <Avatar className="w-16 h-16 border border-border">
                    <AvatarImage src={guild.iconUrl || ""} />
                    <AvatarFallback className="bg-secondary text-secondary-foreground text-lg">
                      {guild.name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-lg text-white truncate">{guild.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      {guild.premiumTier > 0 ? (
                        <Badge variant="secondary" className="bg-primary/20 text-primary hover:bg-primary/30">Premium</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground border-border">Free</Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
