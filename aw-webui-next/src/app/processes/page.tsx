import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ProcessesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Processes</h1>
        <p className="text-muted-foreground">
          Discovered business processes from your activity
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Process Mining</CardTitle>
          <CardDescription>
            Automatically discovered workflows and processes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No processes discovered yet. Activity data will be analyzed to find patterns.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
