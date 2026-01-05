"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatDuration, formatTimestamp, type AWEvent } from "@/lib/aw-client";
import { ChevronDown, ChevronUp, Image, ExternalLink } from "lucide-react";

interface EventListProps {
  events: AWEvent[];
  bucketId?: string;
  showScreenshots?: boolean;
  onEventSelect?: (event: AWEvent) => void;
}

export function EventList({ events, bucketId, showScreenshots = true, onEventSelect }: EventListProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [filter, setFilter] = useState("");

  const filteredEvents = events.filter((event) => {
    if (!filter) return true;
    const searchStr = JSON.stringify(event.data).toLowerCase();
    return searchStr.includes(filter.toLowerCase());
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <Input
          placeholder="Filter events..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-sm"
        />
        <Badge variant="secondary">{filteredEvents.length} events</Badge>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted">
            <tr>
              <th className="text-left p-3 text-sm font-medium">Timestamp</th>
              <th className="text-left p-3 text-sm font-medium">Duration</th>
              <th className="text-left p-3 text-sm font-medium">Data</th>
              {showScreenshots && (
                <th className="text-left p-3 text-sm font-medium w-10"></th>
              )}
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {filteredEvents.map((event, index) => (
              <>
                <tr
                  key={event.id || index}
                  className="border-t hover:bg-muted/50 cursor-pointer"
                  onClick={() => onEventSelect?.(event)}
                >
                  <td className="p-3 text-sm font-mono">
                    {formatTimestamp(event.timestamp)}
                  </td>
                  <td className="p-3 text-sm">
                    {formatDuration(event.duration)}
                  </td>
                  <td className="p-3 text-sm">
                    <EventDataPreview data={event.data} />
                  </td>
                  {showScreenshots && (
                    <td className="p-3">
                      {typeof event.data.screenshot === "string" && (
                        <Image className="h-4 w-4 text-muted-foreground" />
                      )}
                    </td>
                  )}
                  <td className="p-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedId(expandedId === (event.id || index) ? null : (event.id || index));
                      }}
                    >
                      {expandedId === (event.id || index) ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </td>
                </tr>
                {expandedId === (event.id || index) && (
                  <tr key={`${event.id || index}-expanded`}>
                    <td colSpan={5} className="p-4 bg-muted/30">
                      <EventDetails event={event} />
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>

        {filteredEvents.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            No events found
          </div>
        )}
      </div>
    </div>
  );
}

function EventDataPreview({ data }: { data: Record<string, unknown> }) {
  // Show most relevant fields
  const app = data.app as string | undefined;
  const title = data.title as string | undefined;
  const url = data.url as string | undefined;
  const action = data.action as string | undefined;

  return (
    <div className="flex items-center gap-2 max-w-md truncate">
      {app && <Badge variant="outline">{app}</Badge>}
      {action && <Badge>{action}</Badge>}
      <span className="truncate text-muted-foreground">
        {title || url || JSON.stringify(data).slice(0, 50)}
      </span>
    </div>
  );
}

function EventDetails({ event }: { event: AWEvent }) {
  const linkedObjects = event.data.linked_objects as string[] | undefined;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h4 className="font-medium mb-2">Event Data</h4>
          <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-60">
            {JSON.stringify(event.data, null, 2)}
          </pre>
        </div>

        {typeof event.data.screenshot === "string" && (
          <div>
            <h4 className="font-medium mb-2">Screenshot</h4>
            <div className="border rounded overflow-hidden">
              <img
                src={event.data.screenshot}
                alt="Event screenshot"
                className="w-full"
              />
            </div>
          </div>
        )}
      </div>

      {linkedObjects && linkedObjects.length > 0 && (
        <div>
          <h4 className="font-medium mb-2">Detected Objects</h4>
          <div className="flex flex-wrap gap-2">
            {linkedObjects.map((obj, i) => (
              <Badge key={i} variant="secondary">
                {obj}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {typeof event.data.url === "string" && (
        <div>
          <h4 className="font-medium mb-2">URL</h4>
          <a
            href={event.data.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:underline flex items-center gap-1"
          >
            {event.data.url}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
    </div>
  );
}
