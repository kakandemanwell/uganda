import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({ icon: Icon, label, value, hint, className }) {
  return (
    <Card className={cn("gap-0 py-5", className)}>
      <CardContent className="flex items-start justify-between gap-3 px-5">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">{label}</span>
          <span className="font-mono-tabular text-2xl font-semibold tracking-tight">{value}</span>
          {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
        </div>
        {Icon && (
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-4.5" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
