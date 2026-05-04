import { Button } from "@/components/ui/button";
import { Activity, BarChart3, ShieldCheck, Zap } from "lucide-react";
import { useGetMe } from "@workspace/api-client-react";
import { Link } from "wouter";

export default function Landing() {
  const { data: user, isLoading } = useGetMe({ query: { retry: false } });

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      <header className="px-6 h-16 flex items-center justify-between border-b border-border bg-card/50 backdrop-blur">
        <div className="font-bold text-xl flex items-center gap-2 text-primary">
          <Activity className="w-6 h-6" />
          InviteTracker
        </div>
        <div>
          {isLoading ? null : user ? (
            <Link href="/dashboard">
              <Button>Go to Dashboard</Button>
            </Link>
          ) : (
            <a href="/api/auth/discord">
              <Button>Login with Discord</Button>
            </a>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-24">
        <div className="max-w-3xl space-y-8">
          <div className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
            <Zap className="mr-2 h-4 w-4" />
            The ultimate growth tool for Discord
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-white">
            Grow your server with <span className="text-primary">precision</span>.
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Track invites, reward active members, detect fake accounts, and analyze growth trends with our professional-grade dashboard.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            {user ? (
              <Link href="/dashboard">
                <Button size="lg" className="w-full sm:w-auto text-lg px-8">Go to Dashboard</Button>
              </Link>
            ) : (
              <a href="/api/auth/discord">
                <Button size="lg" className="w-full sm:w-auto text-lg px-8">Login with Discord</Button>
              </a>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mt-32 max-w-5xl w-full text-left">
          <div className="bg-card p-6 rounded-xl border border-border">
            <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center mb-4">
              <BarChart3 className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-bold mb-2 text-white">Deep Analytics</h3>
            <p className="text-muted-foreground">Track joins, leaves, and net growth over time with beautiful, actionable charts.</p>
          </div>
          <div className="bg-card p-6 rounded-xl border border-border">
            <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center mb-4">
              <ShieldCheck className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-bold mb-2 text-white">Fake Detection</h3>
            <p className="text-muted-foreground">Automatically identify and exclude alt accounts to keep your invite leaderboard fair.</p>
          </div>
          <div className="bg-card p-6 rounded-xl border border-border">
            <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center mb-4">
              <Activity className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-bold mb-2 text-white">Real-time Tracking</h3>
            <p className="text-muted-foreground">Monitor who invited whom, complete with custom welcome messages and detailed attribution.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
