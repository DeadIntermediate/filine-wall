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
  // Features
  {
    version: "1.0.0-Alpha",
    date: "2025-01-09",
    type: "added",
    description: "Core spam protection features including phone number management, call screening, and reputation scoring systems"
  },
  {
    version: "1.0.0-Alpha",
    date: "2025-01-09",
    type: "added",
    description: "AI-powered voice pattern analysis with real-time detection and machine learning capabilities"
  },
  {
    version: "1.0.0-Alpha",
    date: "2025-01-09",
    type: "added",
    description: "Real-time risk scoring system with automated call blocking based on reputation scores"
  },
  {
    version: "1.0.0-Alpha",
    date: "2025-01-09",
    type: "added",
    description: "Customizable date range analytics for call trend analysis and reporting"
  },
  // Changes
  {
    version: "1.0.0-Alpha",
    date: "2025-01-09",
    type: "changed",
    description: "Improved database naming for better clarity - renamed FCC Database to Spam Database"
  },
  {
    version: "1.0.0-Alpha",
    date: "2025-01-09",
    type: "changed",
    description: "Enhanced UI with responsive design and improved navigation"
  },
  // Fixes
  {
    version: "1.0.0-Alpha",
    date: "2025-01-09",
    type: "fixed",
    description: "Resolved database connection handling for more reliable operation"
  },
  {
    version: "1.0.0-Alpha",
    date: "2025-01-09",
    type: "fixed",
    description: "Improved error handling in voice analysis system"
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