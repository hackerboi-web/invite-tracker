import { useGetLeaderboard } from "@workspace/api-client-react";
import { DashboardLayout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Medal } from "lucide-react";
import { Link } from "wouter";

export default function Leaderboard({ params }: { params: { guildId: string } }) {
  const { guildId } = params;
  const { data: leaderboardData, isLoading } = useGetLeaderboard(guildId, { query: { enabled: !!guildId } });

  if (isLoading || !leaderboardData) {
    return (
      <DashboardLayout guildId={guildId}>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const getRankColor = (rank: number) => {
    if (rank === 1) return "text-[#FFD700]"; // Gold
    if (rank === 2) return "text-[#C0C0C0]"; // Silver
    if (rank === 3) return "text-[#CD7F32]"; // Bronze
    return "text-muted-foreground";
  };

  return (
    <DashboardLayout guildId={guildId}>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Invite Leaderboard</h1>
          <p className="text-muted-foreground mt-2">Top inviters in this server.</p>
        </div>
      </div>

      <div className="space-y-4">
        {leaderboardData.entries.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="py-12 text-center text-muted-foreground">
              No invite data available yet.
            </CardContent>
          </Card>
        ) : (
          leaderboardData.entries.map((entry) => (
            <Link key={entry.userId} href={`/dashboard/${guildId}/user/${entry.userId}`}>
              <Card className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer">
                <CardContent className="p-4 flex items-center gap-6">
                  <div className={`w-8 font-bold text-xl text-center ${getRankColor(entry.rank)}`}>
                    {entry.rank <= 3 ? <Medal className="w-6 h-6 mx-auto" /> : `#${entry.rank}`}
                  </div>
                  
                  <Avatar className="w-12 h-12 border border-border">
                    <AvatarImage src={entry.avatarUrl || ""} />
                    <AvatarFallback>{entry.username.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-white truncate">{entry.username}</h3>
                  </div>

                  <div className="flex items-center gap-8 text-sm">
                    <div className="text-center">
                      <div className="text-muted-foreground">Total</div>
                      <div className="font-bold text-lg text-primary">{entry.total}</div>
                    </div>
                    <div className="text-center hidden sm:block">
                      <div className="text-muted-foreground">Regular</div>
                      <div className="font-semibold text-white">{entry.regular}</div>
                    </div>
                    <div className="text-center hidden sm:block">
                      <div className="text-muted-foreground">Bonus</div>
                      <div className="font-semibold text-[#00E676]">{entry.bonus}</div>
                    </div>
                    <div className="text-center hidden sm:block">
                      <div className="text-muted-foreground">Leaves</div>
                      <div className="font-semibold text-destructive">{entry.left}</div>
                    </div>
                    <div className="text-center hidden sm:block">
                      <div className="text-muted-foreground">Fake</div>
                      <div className="font-semibold text-orange-500">{entry.fake}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </DashboardLayout>
  );
}
