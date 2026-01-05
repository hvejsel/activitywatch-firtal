import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, X, Edit } from "lucide-react";

export default function ObjectTrainingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Object Training</h1>
        <p className="text-muted-foreground">
          Review and confirm detected objects to improve detection
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Confirmed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">0</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">0</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Training Queue</CardTitle>
          <CardDescription>
            Confirm or reject detected objects to train the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              No objects pending review. When objects are detected with low confidence,
              they will appear here for your confirmation.
            </p>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled>
                <Check className="mr-2 h-4 w-4" />
                Confirm
              </Button>
              <Button variant="outline" size="sm" disabled>
                <X className="mr-2 h-4 w-4" />
                Reject
              </Button>
              <Button variant="outline" size="sm" disabled>
                <Edit className="mr-2 h-4 w-4" />
                Correct
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Learned Patterns</CardTitle>
          <CardDescription>
            Patterns learned from your confirmations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No patterns learned yet. Confirm objects to teach the system new detection patterns.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
