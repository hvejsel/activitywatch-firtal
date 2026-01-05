"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

const defaultPatterns = [
  { type: "Order", urlPattern: "/orders?/(\\w+)", ocrPattern: "Order\\s*#?\\s*(\\w+)", enabled: true },
  { type: "Product", urlPattern: "/products?/(\\w+)", ocrPattern: "SKU:\\s*(\\w+)", enabled: true },
  { type: "Customer", urlPattern: "/customers?/(\\w+)", ocrPattern: "Customer\\s*ID:\\s*(\\w+)", enabled: true },
  { type: "Invoice", urlPattern: "/invoices?/(\\w+)", ocrPattern: "Invoice\\s*#?\\s*(\\w+)", enabled: true },
  { type: "Shipment", urlPattern: "/shipments?/(\\w+)", ocrPattern: "Tracking:\\s*(\\w+)", enabled: false },
];

export default function DetectionSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Detection Settings</h1>
        <p className="text-muted-foreground">
          Configure business object detection patterns and thresholds
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Confidence Thresholds</CardTitle>
          <CardDescription>
            Set minimum confidence levels for automatic detection
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Auto-accept threshold (regex matches)</Label>
            <div className="flex items-center gap-4">
              <Input type="range" min="0" max="100" defaultValue="80" className="flex-1" />
              <span className="text-sm font-mono w-12">80%</span>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Prompt user threshold (LLM detections)</Label>
            <div className="flex items-center gap-4">
              <Input type="range" min="0" max="100" defaultValue="60" className="flex-1" />
              <span className="text-sm font-mono w-12">60%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Detection Patterns</CardTitle>
          <CardDescription>
            Regex patterns for detecting business objects
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {defaultPatterns.map((pattern, i) => (
              <div key={i} className="flex items-center gap-4 p-3 border rounded-lg">
                <input type="checkbox" defaultChecked={pattern.enabled} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{pattern.type}</span>
                    <Badge variant={pattern.enabled ? "default" : "secondary"}>
                      {pattern.enabled ? "Active" : "Disabled"}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    <span className="font-mono">URL: {pattern.urlPattern}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <span className="font-mono">OCR: {pattern.ocrPattern}</span>
                  </div>
                </div>
                <Button variant="outline" size="sm">Edit</Button>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <Button variant="outline">Add Pattern</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Detection Sources</CardTitle>
          <CardDescription>
            Enable or disable detection from different sources
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center space-x-2">
            <input type="checkbox" id="detect-url" defaultChecked />
            <Label htmlFor="detect-url">Detect from URLs (web watcher)</Label>
          </div>
          <div className="flex items-center space-x-2">
            <input type="checkbox" id="detect-title" defaultChecked />
            <Label htmlFor="detect-title">Detect from window titles</Label>
          </div>
          <div className="flex items-center space-x-2">
            <input type="checkbox" id="detect-ocr" defaultChecked />
            <Label htmlFor="detect-ocr">Detect from OCR text</Label>
          </div>
          <div className="flex items-center space-x-2">
            <input type="checkbox" id="detect-api" defaultChecked />
            <Label htmlFor="detect-api">Detect from API responses</Label>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button>Save Settings</Button>
      </div>
    </div>
  );
}
