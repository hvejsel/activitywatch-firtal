"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  processMiningClient,
  type ProcessDetail,
  formatDuration,
  formatTimestamp,
} from "@/lib/aw-client";
import { ProcessGraph, StepsTable } from "@/components/process-graph";
import { ArrowLeft, RefreshCw, Clock, Activity, GitBranch, Package, Play } from "lucide-react";

export default function ProcessDetailPage() {
  const params = useParams();
  const processId = params.id as string;

  const [process, setProcess] = useState<ProcessDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStep, setSelectedStep] = useState<string | null>(null);

  useEffect(() => {
    loadProcess();
  }, [processId]);

  async function loadProcess() {
    setLoading(true);
    setError(null);
    try {
      const data = await processMiningClient.getProcess(processId);
      setProcess(data);
    } catch (err) {
      setError("Failed to load process details");
      setProcess(null);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !process) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/processes">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
        </div>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-600">{error || "Process not found"}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Build graph nodes and edges from process steps
  const graphNodes = process.steps.map((step) => ({
    id: step.id,
    name: step.name,
    action: step.action,
    frequency: step.frequency,
    avgDuration: step.avgDuration,
  }));

  // Build edges from variants or infer from step order
  const graphEdges: { source: string; target: string; frequency: number }[] = [];
  if (process.variants.length > 0) {
    // Build edges from variants
    for (const variant of process.variants) {
      for (let i = 0; i < variant.steps.length - 1; i++) {
        const existing = graphEdges.find(
          (e) => e.source === variant.steps[i] && e.target === variant.steps[i + 1]
        );
        if (existing) {
          existing.frequency += variant.frequency;
        } else {
          graphEdges.push({
            source: variant.steps[i],
            target: variant.steps[i + 1],
            frequency: variant.frequency,
          });
        }
      }
    }
  } else if (process.steps.length > 1) {
    // Infer linear flow from steps
    const sortedSteps = [...process.steps].sort((a, b) => a.order - b.order);
    for (let i = 0; i < sortedSteps.length - 1; i++) {
      graphEdges.push({
        source: sortedSteps[i].id,
        target: sortedSteps[i + 1].id,
        frequency: Math.min(sortedSteps[i].frequency, sortedSteps[i + 1].frequency),
      });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/processes">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{process.name}</h1>
            <p className="text-muted-foreground">
              {process.processType}
              {process.description && ` - ${process.description}`}
            </p>
          </div>
        </div>
        <Button onClick={loadProcess}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              Executions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{process.instances.length}</div>
            <p className="text-xs text-muted-foreground">total runs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Avg Duration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(process.stats.avgDuration)}</div>
            <p className="text-xs text-muted-foreground">
              {formatDuration(process.stats.minDuration)} - {formatDuration(process.stats.maxDuration)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-muted-foreground" />
              Variants
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{process.variants.length}</div>
            <p className="text-xs text-muted-foreground">process variations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              Linked Objects
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{process.linkedObjects.length}</div>
            <p className="text-xs text-muted-foreground">business objects</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Process Flow</CardTitle>
          <CardDescription>Visual representation of process steps</CardDescription>
        </CardHeader>
        <CardContent className="h-[400px]">
          <ProcessGraph
            nodes={graphNodes}
            edges={graphEdges}
            onNodeClick={setSelectedStep}
            className="h-full"
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Steps</CardTitle>
            <CardDescription>Process steps with statistics</CardDescription>
          </CardHeader>
          <CardContent>
            <StepsTable
              steps={graphNodes}
              variants={process.variants}
              onStepClick={setSelectedStep}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Linked Objects</CardTitle>
            <CardDescription>Business objects involved in this process</CardDescription>
          </CardHeader>
          <CardContent>
            {process.linkedObjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No linked objects found.
              </p>
            ) : (
              <div className="space-y-2">
                {process.linkedObjects.map((obj) => (
                  <div
                    key={obj.id}
                    className="flex items-center justify-between p-2 rounded border hover:bg-muted/50"
                  >
                    <div>
                      <Badge variant="outline" className="mr-2">
                        {obj.objectType}
                      </Badge>
                      <span className="font-mono text-sm">{obj.identifier}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {obj.frequency}x
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Instances</CardTitle>
          <CardDescription>Process execution history</CardDescription>
        </CardHeader>
        <CardContent>
          {process.instances.length === 0 ? (
            <p className="text-sm text-muted-foreground">No instances found.</p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-3 text-sm font-medium">Started</th>
                    <th className="text-left p-3 text-sm font-medium">Duration</th>
                    <th className="text-left p-3 text-sm font-medium">Steps</th>
                    <th className="text-left p-3 text-sm font-medium">Status</th>
                    <th className="text-left p-3 text-sm font-medium">Objects</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {process.instances.slice(0, 20).map((instance) => (
                    <tr key={instance.id} className="border-t hover:bg-muted/50">
                      <td className="p-3 text-sm">
                        {formatTimestamp(instance.startTime)}
                      </td>
                      <td className="p-3 text-sm">
                        {formatDuration(instance.duration)}
                      </td>
                      <td className="p-3 text-sm">{instance.steps.length} steps</td>
                      <td className="p-3">
                        <Badge
                          variant={
                            instance.status === "completed"
                              ? "default"
                              : instance.status === "in_progress"
                              ? "secondary"
                              : "destructive"
                          }
                        >
                          {instance.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-sm">
                        {instance.linkedObjects.length > 0 ? (
                          <span>{instance.linkedObjects.length} objects</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="p-3">
                        <Button variant="ghost" size="icon" title="Replay">
                          <Play className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {process.instances.length > 20 && (
                <div className="p-3 text-center text-sm text-muted-foreground border-t">
                  Showing 20 of {process.instances.length} instances
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
