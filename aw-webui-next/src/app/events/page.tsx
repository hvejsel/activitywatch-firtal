import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function EventsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Events</h1>
        <p className="text-muted-foreground">
          Browse and search your activity events
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Event Explorer</CardTitle>
          <CardDescription>
            View raw events from all watchers with screenshots
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Event list will be displayed here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
