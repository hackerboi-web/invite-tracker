import { DashboardLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useGetPremiumPlans, useGetGuildPremium } from "@workspace/api-client-react";
import { Loader2, Check } from "lucide-react";

export default function Premium({ params }: { params: { guildId: string } }) {
  const { guildId } = params;
  const { data: plans, isLoading: loadingPlans } = useGetPremiumPlans();
  const { data: status, isLoading: loadingStatus } = useGetGuildPremium(guildId, { query: { enabled: !!guildId } });

  if (loadingPlans || loadingStatus || !plans || !status) {
    return (
      <DashboardLayout guildId={guildId}>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const getTierColor = (tier: number) => {
    if (tier === 1) return "border-[#C0C0C0] shadow-[#C0C0C0]/10"; // Silver
    if (tier === 2) return "border-[#FFD700] shadow-[#FFD700]/10"; // Gold
    if (tier === 3) return "border-[#00BFFF] shadow-[#00BFFF]/10"; // Diamond
    return "border-border"; // Free
  };

  return (
    <DashboardLayout guildId={guildId}>
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold text-white tracking-tight mb-4">Upgrade Your Server</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Unlock advanced features, higher limits, and deeper analytics for your community.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
        {plans.map((plan) => {
          const isCurrent = status.tier === plan.tier;
          return (
            <Card key={plan.tier} className={`bg-card relative flex flex-col ${getTierColor(plan.tier)} ${plan.highlighted ? 'border-2 scale-105 z-10 shadow-xl' : 'border'}`}>
              {plan.highlighted && (
                <div className="absolute -top-3 inset-x-0 flex justify-center">
                  <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                    Most Popular
                  </span>
                </div>
              )}
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-2xl font-bold text-white">{plan.name}</CardTitle>
                <div className="mt-4 flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-extrabold text-white">${plan.price}</span>
                  <span className="text-muted-foreground">/mo</span>
                </div>
              </CardHeader>
              <CardContent className="flex-1 mt-6">
                <ul className="space-y-3">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                      <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button 
                  className="w-full" 
                  variant={isCurrent ? "outline" : (plan.highlighted ? "default" : "secondary")}
                  disabled={isCurrent}
                >
                  {isCurrent ? "Current Plan" : "Upgrade"}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </DashboardLayout>
  );
}
