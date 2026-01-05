import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Brain, Target, Sliders } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Configure your activity intelligence platform
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link href="/settings/llm">
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                <CardTitle>LLM Settings</CardTitle>
              </div>
              <CardDescription>
                Configure AI model providers for analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Select Ollama or Claude, configure models and API keys
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/settings/detection">
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                <CardTitle>Detection Settings</CardTitle>
              </div>
              <CardDescription>
                Object detection patterns and thresholds
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Manage detection rules and confidence thresholds
              </p>
            </CardContent>
          </Card>
        </Link>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sliders className="h-5 w-5" />
              <CardTitle>General Settings</CardTitle>
            </div>
            <CardDescription>
              Privacy and system configuration
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Data retention, privacy filters, polling intervals
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ActivityWatch Connection</CardTitle>
          <CardDescription>Connection status to local AW server</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-yellow-500"></div>
            <span className="text-sm">Not connected</span>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Server URL: http://localhost:5600
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
