import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ChangelogEntry {
  version: string;
  date: string;
  type: "added" | "changed" | "fixed" | "removed";
  description: string;
}

const changelog: ChangelogEntry[] = [
  {
    version: "1.0.0-Alpha",
    date: "2025-01-09",
    type: "added",
    description: "Initial alpha release with core spam protection features"
  },
  {
    version: "1.0.0-Alpha",
    date: "2025-01-09",
    type: "added",
    description: "AI-powered voice tone analysis for spam detection"
  },
  {
    version: "1.0.0-Alpha",
    date: "2025-01-09",
    type: "added",
    description: "Flexible date range analytics for call trends"
  },
  {
    version: "1.0.0-Alpha",
    date: "2025-01-09",
    type: "changed",
    description: "Renamed FCC Database label to Spam Database"
  }
];

export function Changelog() {
  const getBadgeVariant = (type: ChangelogEntry["type"]) => {
    switch (type) {
      case "added":
        return "default";
      case "changed":
        return "secondary";
      case "fixed":
        return "outline";
      case "removed":
        return "destructive";
      default:
        return "outline";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl font-bold">Changelog</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          {changelog.map((entry, index) => (
            <div
              key={index}
              className="mb-4 border-l-2 border-primary pl-4 last:mb-0"
            >
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">{entry.version}</h3>
                <Badge variant={getBadgeVariant(entry.type)}>
                  {entry.type}
                </Badge>
              </div>
              <time className="text-sm text-muted-foreground">
                {entry.date}
              </time>
              <p className="mt-1">{entry.description}</p>
            </div>
          ))}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
