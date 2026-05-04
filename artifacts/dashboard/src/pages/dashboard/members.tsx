import { useGetGuildMembers } from "@workspace/api-client-react";
import { DashboardLayout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, ShieldAlert, LogOut } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

export default function Members({ params }: { params: { guildId: string } }) {
  const { guildId } = params;
  const { data: membersData, isLoading } = useGetGuildMembers(guildId, { query: { enabled: !!guildId } });

  if (isLoading || !membersData) {
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
        <h1 className="text-3xl font-bold text-white tracking-tight">Member History</h1>
        <p className="text-muted-foreground mt-2">Recent joins and invite attribution.</p>
      </div>

      <Card className="bg-card border-border overflow-hidden">
        <Table>
          <TableHeader className="bg-secondary/50">
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground">Member</TableHead>
              <TableHead className="text-muted-foreground">Inviter</TableHead>
              <TableHead className="text-muted-foreground">Joined At</TableHead>
              <TableHead className="text-muted-foreground">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {membersData.members.length === 0 ? (
              <TableRow className="border-border hover:bg-transparent">
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  No member history recorded yet.
                </TableCell>
              </TableRow>
            ) : (
              membersData.members.map((member) => (
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
                  <TableCell>
                    {member.inviterName ? (
                      <span className="text-white">{member.inviterName}</span>
                    ) : (
                      <span className="text-muted-foreground italic">Unknown</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(member.joinedAt), "MMM d, yyyy HH:mm")}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {member.isFake && (
                        <Badge variant="outline" className="text-orange-500 border-orange-500/30 bg-orange-500/10">
                          <ShieldAlert className="w-3 h-3 mr-1" />
                          Fake
                        </Badge>
                      )}
                      {member.leftAt && (
                        <Badge variant="outline" className="text-destructive border-destructive/30 bg-destructive/10">
                          <LogOut className="w-3 h-3 mr-1" />
                          Left
                        </Badge>
                      )}
                      {!member.isFake && !member.leftAt && (
                        <Badge variant="outline" className="text-[#00E676] border-[#00E676]/30 bg-[#00E676]/10">
                          Active
                        </Badge>
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
