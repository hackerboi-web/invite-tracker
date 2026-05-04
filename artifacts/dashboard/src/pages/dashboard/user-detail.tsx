import { useGetUserInviteStats, useAdjustBonusInvites } from "@workspace/api-client-react";
import { DashboardLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

export default function UserDetail({ params }: { params: { guildId: string, userId: string } }) {
  const { guildId, userId } = params;
  const { data: userStats, isLoading, refetch } = useGetUserInviteStats(guildId, userId, { query: { enabled: !!guildId && !!userId } });
  const adjustBonus = useAdjustBonusInvites();
  const { toast } = useToast();

  const [bonusAmount, setBonusAmount] = useState("");

  if (isLoading || !userStats) {
    return (
      <DashboardLayout guildId={guildId}>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const handleAdjustBonus = (amount: number) => {
    adjustBonus.mutate({
      guildId,
      data: { userId, amount, reason: "Manual adjustment via dashboard" }
    }, {
      onSuccess: () => {
        toast({ title: "Bonus invites updated" });
        refetch();
        setBonusAmount("");
      }
    });
  };

  return (
    <DashboardLayout guildId={guildId}>
      <div className="mb-8 flex items-center gap-6">
        <Avatar className="w-20 h-20 border-2 border-primary">
          <AvatarImage src={userStats.avatar || ""} />
          <AvatarFallback className="text-2xl">{userStats.username.substring(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">{userStats.username}</h1>
          <p className="text-muted-foreground mt-1">Rank #{userStats.rank || "?"} • ID: {userId}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <Card className="bg-card border-border">
          <CardContent className="p-6 text-center">
            <div className="text-sm font-medium text-muted-foreground mb-1">Total</div>
            <div className="text-3xl font-bold text-primary">{userStats.total}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-6 text-center">
            <div className="text-sm font-medium text-muted-foreground mb-1">Regular</div>
            <div className="text-3xl font-bold text-white">{userStats.regular}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-6 text-center">
            <div className="text-sm font-medium text-muted-foreground mb-1">Bonus</div>
            <div className="text-3xl font-bold text-[#00E676]">{userStats.bonus}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-6 text-center">
            <div className="text-sm font-medium text-muted-foreground mb-1">Leaves</div>
            <div className="text-3xl font-bold text-destructive">{userStats.left}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-6 text-center">
            <div className="text-sm font-medium text-muted-foreground mb-1">Fake</div>
            <div className="text-3xl font-bold text-orange-500">{userStats.fake}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border mb-8 max-w-md">
        <CardHeader>
          <CardTitle className="text-white text-lg">Adjust Bonus Invites</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input 
              type="number" 
              value={bonusAmount} 
              onChange={(e) => setBonusAmount(e.target.value)} 
              placeholder="Amount" 
              className="bg-background border-border"
            />
            <Button 
              variant="outline" 
              className="border-border text-[#00E676] hover:bg-[#00E676]/10 hover:text-[#00E676]"
              onClick={() => handleAdjustBonus(Number(bonusAmount))}
              disabled={!bonusAmount || adjustBonus.isPending}
            >
              <Plus className="w-4 h-4 mr-2" /> Add
            </Button>
            <Button 
              variant="outline" 
              className="border-border text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => handleAdjustBonus(-Number(bonusAmount))}
              disabled={!bonusAmount || adjustBonus.isPending}
            >
              <Minus className="w-4 h-4 mr-2" /> Remove
            </Button>
          </div>
        </CardContent>
      </Card>

      <h2 className="text-2xl font-bold text-white mb-4">Invited Members</h2>
      <Card className="bg-card border-border overflow-hidden">
        <Table>
          <TableHeader className="bg-secondary/50">
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground">Member</TableHead>
              <TableHead className="text-muted-foreground">Joined At</TableHead>
              <TableHead className="text-muted-foreground">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!userStats.invitedMembers || userStats.invitedMembers.length === 0 ? (
              <TableRow className="border-border hover:bg-transparent">
                <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                  No members invited yet.
                </TableCell>
              </TableRow>
            ) : (
              userStats.invitedMembers.map((member) => (
                <TableRow key={member.id} className="border-border hover:bg-secondary/20">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="w-8 h-8 border border-border">
                        <AvatarImage src={member.avatar || ""} />
                        <AvatarFallback>{member.username.substring(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className={`font-medium ${member.leftAt ? 'text-muted-foreground line-through' : 'text-white'}`}>
                        {member.username}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(member.joinedAt), "MMM d, yyyy HH:mm")}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {member.isFake && (
                        <Badge variant="outline" className="text-orange-500 border-orange-500/30 bg-orange-500/10">Fake</Badge>
                      )}
                      {member.leftAt && (
                        <Badge variant="outline" className="text-destructive border-destructive/30 bg-destructive/10">Left</Badge>
                      )}
                      {!member.isFake && !member.leftAt && (
                        <Badge variant="outline" className="text-[#00E676] border-[#00E676]/30 bg-[#00E676]/10">Active</Badge>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </DashboardLayout>
  );
}
