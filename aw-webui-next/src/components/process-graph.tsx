"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, Maximize2, RotateCcw } from "lucide-react";

interface ProcessNode {
  id: string;
  name: string;
  action: string;
  frequency: number;
  avgDuration: number;
}

interface ProcessEdge {
  source: string;
  target: string;
  frequency: number;
  label?: string;
}

interface ProcessGraphProps {
  nodes: ProcessNode[];
  edges: ProcessEdge[];
  onNodeClick?: (nodeId: string) => void;
  className?: string;
}

export function ProcessGraph({
  nodes,
  edges,
  onNodeClick,
  className = "",
}: ProcessGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cy: any = null;

    async function initCytoscape() {
      if (!containerRef.current) return;

      try {
        const cytoscape = (await import("cytoscape")).default;

        // Convert nodes and edges to Cytoscape format
        const cyNodes = nodes.map((node) => ({
          data: {
            id: node.id,
            label: node.name,
            action: node.action,
            frequency: node.frequency,
            avgDuration: node.avgDuration,
          },
        }));

        const cyEdges = edges.map((edge, index) => ({
          data: {
            id: `edge-${index}`,
            source: edge.source,
            target: edge.target,
            frequency: edge.frequency,
            label: edge.label || `${edge.frequency}x`,
          },
        }));

        cy = cytoscape({
          container: containerRef.current,
          elements: [...cyNodes, ...cyEdges],
          style: [
            {
              selector: "node",
              style: {
                "background-color": "#3b82f6",
                label: "data(label)",
                "text-valign": "center",
                "text-halign": "center",
                color: "#fff",
                "font-size": "12px",
                "text-wrap": "wrap",
                "text-max-width": "100px",
                width: "mapData(frequency, 1, 100, 40, 80)",
                height: "mapData(frequency, 1, 100, 40, 80)",
                "border-width": 2,
                "border-color": "#2563eb",
              },
            },
            {
              selector: "node:selected",
              style: {
                "background-color": "#1d4ed8",
                "border-color": "#1e40af",
                "border-width": 3,
              },
            },
            {
              selector: "node[action = 'start']",
              style: {
                "background-color": "#22c55e",
                "border-color": "#16a34a",
              },
            },
            {
              selector: "node[action = 'end']",
              style: {
                "background-color": "#ef4444",
                "border-color": "#dc2626",
              },
            },
            {
              selector: "edge",
              style: {
                width: "mapData(frequency, 1, 100, 1, 5)",
                "line-color": "#94a3b8",
                "target-arrow-color": "#94a3b8",
                "target-arrow-shape": "triangle",
                "curve-style": "bezier",
                label: "data(label)",
                "font-size": "10px",
                "text-rotation": "autorotate",
                "text-margin-y": -10,
                color: "#64748b",
              },
            },
            {
              selector: "edge:selected",
              style: {
                "line-color": "#3b82f6",
                "target-arrow-color": "#3b82f6",
                width: 3,
              },
            },
          ],
          layout: {
            name: "grid",
          } as cytoscape.LayoutOptions,
          minZoom: 0.2,
          maxZoom: 3,
          wheelSensitivity: 0.3,
        });

        // Try to load dagre layout
        try {
          const dagre = (await import("cytoscape-dagre")).default;
          cytoscape.use(dagre);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          cy.layout({ name: "dagre", rankDir: "LR", nodeSep: 50, rankSep: 100 } as any).run();
        } catch {
          // Fallback to grid layout if dagre not available
          cy.layout({ name: "grid" }).run();
        }

        // Node click handler
        if (onNodeClick) {
          cy.on("tap", "node", (evt: any) => {
            const nodeId = evt.target.id();
            onNodeClick(nodeId);
          });
        }

        cyRef.current = cy;
        setIsLoading(false);
      } catch (err) {
        console.error("Failed to initialize Cytoscape:", err);
        setError("Failed to load graph visualization");
        setIsLoading(false);
      }
    }

    initCytoscape();

    return () => {
      if (cy) {
        cy.destroy();
      }
    };
  }, [nodes, edges, onNodeClick]);

  const handleZoomIn = () => {
    if (cyRef.current) {
      cyRef.current.zoom(cyRef.current.zoom() * 1.2);
    }
  };

  const handleZoomOut = () => {
    if (cyRef.current) {
      cyRef.current.zoom(cyRef.current.zoom() / 1.2);
    }
  };

  const handleFit = () => {
    if (cyRef.current) {
      cyRef.current.fit(undefined, 30);
    }
  };

  const handleReset = () => {
    if (cyRef.current) {
      cyRef.current.reset();
      cyRef.current.fit(undefined, 30);
    }
  };

  if (error) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <p className="text-muted-foreground">No process steps to visualize</p>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <div className="absolute top-2 right-2 z-10 flex gap-1">
        <Button variant="secondary" size="icon" onClick={handleZoomIn}>
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button variant="secondary" size="icon" onClick={handleZoomOut}>
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button variant="secondary" size="icon" onClick={handleFit}>
          <Maximize2 className="h-4 w-4" />
        </Button>
        <Button variant="secondary" size="icon" onClick={handleReset}>
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}

      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ minHeight: "300px" }}
      />
    </div>
  );
}

// Steps table component
interface StepsTableProps {
  steps: ProcessNode[];
  variants: { id: string; steps: string[]; frequency: number; avgDuration: number }[];
  onStepClick?: (stepId: string) => void;
}

export function StepsTable({ steps, variants, onStepClick }: StepsTableProps) {
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);

  const sortedSteps = [...steps].sort((a, b) => {
    // Sort by order if available, otherwise by frequency
    return b.frequency - a.frequency;
  });

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h`;
  };

  return (
    <div className="space-y-4">
      {variants.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Process Variants</h4>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedVariant === null ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedVariant(null)}
            >
              All Steps
            </Button>
            {variants.map((variant, index) => (
              <Button
                key={variant.id}
                variant={selectedVariant === variant.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedVariant(variant.id)}
              >
                Variant {index + 1} ({variant.frequency}x)
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted">
            <tr>
              <th className="text-left p-3 text-sm font-medium">Step</th>
              <th className="text-left p-3 text-sm font-medium">Action</th>
              <th className="text-right p-3 text-sm font-medium">Frequency</th>
              <th className="text-right p-3 text-sm font-medium">Avg Duration</th>
            </tr>
          </thead>
          <tbody>
            {sortedSteps
              .filter((step) => {
                if (!selectedVariant) return true;
                const variant = variants.find((v) => v.id === selectedVariant);
                return variant?.steps.includes(step.id);
              })
              .map((step) => (
                <tr
                  key={step.id}
                  className="border-t hover:bg-muted/50 cursor-pointer"
                  onClick={() => onStepClick?.(step.id)}
                >
                  <td className="p-3 text-sm font-medium">{step.name}</td>
                  <td className="p-3 text-sm text-muted-foreground">{step.action}</td>
                  <td className="p-3 text-sm text-right">{step.frequency}x</td>
                  <td className="p-3 text-sm text-right">
                    {formatDuration(step.avgDuration)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>

        {sortedSteps.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            No steps found
          </div>
        )}
      </div>
    </div>
  );
}
