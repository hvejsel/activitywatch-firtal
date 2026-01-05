"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { EventList } from "@/components/event-list";
import { ScreenshotViewer } from "@/components/screenshot-viewer";
import { awClient, type AWEvent, type AWBucket, getTimeRange } from "@/lib/aw-client";
import { RefreshCw, Calendar } from "lucide-react";

export default function EventsPage() {
  const [buckets, setBuckets] = useState<Record<string, AWBucket>>({});
  const [selectedBucket, setSelectedBucket] = useState<string>("");
  const [events, setEvents] = useState<AWEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<"today" | "week" | "month">("today");
  const [selectedEvent, setSelectedEvent] = useState<AWEvent | null>(null);

  // Load buckets on mount
  useEffect(() => {
    loadBuckets();
  }, []);

  // Load events when bucket or date range changes
  useEffect(() => {
    if (selectedBucket) {
      loadEvents();
    }
  }, [selectedBucket, dateRange]);

  async function loadBuckets() {
    try {
      const data = await awClient.getBuckets();
      setBuckets(data);
      // Auto-select first bucket
      const bucketIds = Object.keys(data);
      if (bucketIds.length > 0 && !selectedBucket) {
        setSelectedBucket(bucketIds[0]);
      }
    } catch (err) {
      setError("Failed to connect to ActivityWatch server");
    }
  }

  async function loadEvents() {
    setLoading(true);
    setError(null);
    try {
      const { start, end } = getTimeRange(dateRange);
      const data = await awClient.getEvents(selectedBucket, {
        limit: 100,
        start,
        end,
      });
      setEvents(data);
    } catch (err) {
      setError("Failed to load events");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Events</h1>
          <p className="text-muted-foreground">
            Browse and search your activity events
          </p>
        </div>
        <Button onClick={loadEvents} disabled={loading || !selectedBucket}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-600">{error}</p>
            <p className="text-sm text-red-500 mt-1">
              Make sure ActivityWatch is running at http://localhost:5600
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>
            Select bucket and time range
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="space-y-2 min-w-[200px]">
              <Label>Bucket</Label>
              <Select value={selectedBucket} onValueChange={setSelectedBucket}>
                <SelectTrigger>
                  <SelectValue placeholder="Select bucket" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(buckets).map(([id, bucket]) => (
                    <SelectItem key={id} value={id}>
                      {bucket.type} ({bucket.client})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Time Range</Label>
              <div className="flex gap-2">
                <Button
                  variant={dateRange === "today" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDateRange("today")}
                >
                  Today
                </Button>
                <Button
                  variant={dateRange === "week" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDateRange("week")}
                >
                  Week
                </Button>
                <Button
                  variant={dateRange === "month" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDateRange("month")}
                >
                  Month
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Event Explorer</CardTitle>
          <CardDescription>
            View raw events from all watchers with screenshots
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : events.length > 0 ? (
            <EventList
              events={events}
              bucketId={selectedBucket}
              onEventSelect={setSelectedEvent}
            />
          ) : (
            <p className="text-sm text-muted-foreground py-4">
              {selectedBucket
                ? "No events found for the selected time range."
                : "Select a bucket to view events."}
            </p>
          )}
        </CardContent>
      </Card>

      {selectedEvent && typeof selectedEvent.data.screenshot === "string" && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto">
            <div className="p-4">
              <ScreenshotViewer
                src={selectedEvent.data.screenshot as string}
                elementPosition={selectedEvent.data.elementPosition as any}
                onClose={() => setSelectedEvent(null)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
