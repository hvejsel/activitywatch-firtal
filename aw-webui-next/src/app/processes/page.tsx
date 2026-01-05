"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  processMiningClient,
  type ProcessSummary,
  formatDuration,
} from "@/lib/aw-client";
import { RefreshCw, Search, Filter, ArrowRight, Clock, Activity, GitBranch, Package } from "lucide-react";

export default function ProcessesPage() {
  const [processes, setProcesses] = useState<ProcessSummary[]>([]);
  const [filteredProcesses, setFilteredProcesses] = useState<ProcessSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"name" | "instances" | "duration" | "recent">("recent");
  const [status, setStatus] = useState<{
    lastAnalysis: string | null;
    processCount: number;
    instanceCount: number;
    status: string;
  } | null>(null);

  useEffect(() => {
    loadProcesses();
    loadStatus();
  }, []);

  useEffect(() => {
    filterAndSortProcesses();
  }, [processes, searchQuery, typeFilter, sortBy]);

  async function loadProcesses() {
    setLoading(true);
    setError(null);
    try {
      const data = await processMiningClient.getProcesses();
      setProcesses(data);
    } catch (err) {
      setError("Failed to load processes. Make sure the task mining API is available.");
      setProcesses([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadStatus() {
    try {
      const statusData = await processMiningClient.getTaskMiningStatus();
      setStatus(statusData);
    } catch {
      // Status endpoint might not exist
    }
  }

  async function triggerAnalysis() {
    try {
      await processMiningClient.triggerAnalysis();
      await loadProcesses();
      await loadStatus();
    } catch (err) {
      setError("Failed to trigger analysis");
    }
  }

  function filterAndSortProcesses() {
    let result = [...processes];

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.processType.toLowerCase().includes(query)
      );
    }

    // Filter by type
    if (typeFilter !== "all") {
      result = result.filter((p) => p.processType === typeFilter);
    }

    // Sort
    switch (sortBy) {
      case "name":
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "instances":
        result.sort((a, b) => b.instanceCount - a.instanceCount);
        break;
      case "duration":
        result.sort((a, b) => b.avgDuration - a.avgDuration);
        break;
      case "recent":
        result.sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime());
        break;
    }

    setFilteredProcesses(result);
  }

  const processTypes = Array.from(new Set(processes.map((p) => p.processType)));

  const totalInstances = processes.reduce((sum, p) => sum + p.instanceCount, 0);
  const totalVariants = processes.reduce((sum, p) => sum + p.variantCount, 0);
  const avgDuration =
    processes.length > 0
      ? processes.reduce((sum, p) => sum + p.avgDuration, 0) / processes.length
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Processes</h1>
          <p className="text-muted-foreground">
            Discovered business processes from your activity
          </p>
        </div>
        <Button onClick={triggerAnalysis} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Analyze
        </Button>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              Processes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{processes.length}</div>
            <p className="text-xs text-muted-foreground">discovered workflows</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              Instances
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalInstances}</div>
            <p className="text-xs text-muted-foreground">total executions</p>
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
            <div className="text-2xl font-bold">{totalVariants}</div>
            <p className="text-xs text-muted-foreground">process variations</p>
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
            <div className="text-2xl font-bold">{formatDuration(avgDuration)}</div>
            <p className="text-xs text-muted-foreground">per process</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filter & Search</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search processes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {processTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={(v: typeof sortBy) => setSortBy(v)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Most Recent</SelectItem>
                <SelectItem value="instances">Most Instances</SelectItem>
                <SelectItem value="duration">Longest Duration</SelectItem>
                <SelectItem value="name">Name (A-Z)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <Card className="md:col-span-2 lg:col-span-3">
            <CardContent className="py-8 flex items-center justify-center">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ) : filteredProcesses.length === 0 ? (
          <Card className="md:col-span-2 lg:col-span-3">
            <CardContent className="py-8 text-center text-muted-foreground">
              {processes.length === 0
                ? "No processes discovered yet. Click 'Analyze' to discover workflows from your activity data."
                : "No processes match your search criteria."}
            </CardContent>
          </Card>
        ) : (
          filteredProcesses.map((process) => (
            <Link key={process.id} href={`/processes/${process.id}`}>
              <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{process.name}</CardTitle>
                      <CardDescription>{process.processType}</CardDescription>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="font-semibold">{process.instanceCount}</div>
                      <div className="text-muted-foreground text-xs">runs</div>
                    </div>
                    <div>
                      <div className="font-semibold">{formatDuration(process.avgDuration)}</div>
                      <div className="text-muted-foreground text-xs">avg time</div>
                    </div>
                    <div>
                      <div className="font-semibold">{process.variantCount}</div>
                      <div className="text-muted-foreground text-xs">variants</div>
                    </div>
                  </div>

                  {process.linkedObjectTypes.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {process.linkedObjectTypes.slice(0, 3).map((type) => (
                        <Badge key={type} variant="secondary" className="text-xs">
                          {type}
                        </Badge>
                      ))}
                      {process.linkedObjectTypes.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{process.linkedObjectTypes.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}

                  <div className="mt-3 text-xs text-muted-foreground">
                    Last seen: {new Date(process.lastSeen).toLocaleDateString()}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>

      {status && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Analysis Status</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>Status: {status.status}</p>
            {status.lastAnalysis && (
              <p>Last analysis: {new Date(status.lastAnalysis).toLocaleString()}</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
