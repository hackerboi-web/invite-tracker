import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useGetMe } from "@workspace/api-client-react";
import { Activity, Users, Settings, Trophy, Crown, Menu, LogOut, ChevronLeft } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useLogout } from "@workspace/api-client-react";
import { motion } from "framer-motion";

export function DashboardLayout({ children, guildId }: { children: React.ReactNode, guildId?: string }) {
  const { data: user } = useGetMe();
  const [location] = useLocation();
  const logout = useLogout();

  const navItems = guildId ? [
    { name: "Overview", href: `/dashboard/${guildId}`, icon: Activity },
    { name: "Leaderboard", href: `/dashboard/${guildId}/leaderboard`, icon: Trophy },
    { name: "Members", href: `/dashboard/${guildId}/members`, icon: Users },
    { name: "Settings", href: `/dashboard/${guildId}/settings`, icon: Settings },
    { name: "Premium", href: `/dashboard/${guildId}/premium`, icon: Crown },
  ] : [];

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        window.location.href = import.meta.env.BASE_URL;
      }
    });
  };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 border-r border-border bg-card flex flex-col hidden md:flex">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <Link href="/dashboard" className="font-bold text-xl tracking-tight text-primary flex items-center gap-2">
            <Activity className="w-6 h-6" />
            InviteTracker
          </Link>
        </div>
        
        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-2">
          {guildId && (
            <div className="mb-6">
              <Link href="/dashboard">
                <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-foreground">
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Back to Servers
                </Button>
              </Link>
            </div>
          )}
          
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className={`w-full justify-start ${isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <item.icon className="w-4 h-4 mr-3" />
                  {item.name}
                </Button>
              </Link>
            );
          })}
        </div>

        {user && (
          <div className="p-4 border-t border-border flex items-center gap-3">
            <Avatar>
              <AvatarImage src={user.avatarUrl} />
              <AvatarFallback>{user.username.substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.username}</p>
              <p className="text-xs text-muted-foreground truncate">#{user.discriminator}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout} title="Logout">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6 md:hidden">
          <Link href="/dashboard" className="font-bold text-lg text-primary flex items-center gap-2">
            <Activity className="w-5 h-5" />
            InviteTracker
          </Link>
          <Button variant="ghost" size="icon">
            <Menu className="w-5 h-5" />
          </Button>
        </header>
        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-background">
          <div className="max-w-6xl mx-auto">
            <motion.div
              key={location}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              {children}
            </motion.div>
          </div>
        </main>
      </div>
    </div>
  );
}
