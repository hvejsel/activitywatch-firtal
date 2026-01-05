"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, X, Edit, ChevronLeft, ChevronRight, Image } from "lucide-react";

export interface DetectedObject {
  id: string;
  objectType: string;
  identifier: string;
  identifierKey: string;
  confidence: number;
  detectionMethod: string;
  context: {
    url?: string;
    title?: string;
    ocrText?: string;
    screenshot?: string;
  };
  timestamp: string;
}

interface ObjectConfirmationProps {
  object: DetectedObject;
  objectTypes: string[];
  onConfirm: (object: DetectedObject) => void;
  onReject: (object: DetectedObject, reason?: string) => void;
  onCorrect: (object: DetectedObject, corrections: { objectType?: string; identifier?: string; identifierKey?: string }) => void;
  onSkip?: () => void;
}

export function ObjectConfirmation({
  object,
  objectTypes,
  onConfirm,
  onReject,
  onCorrect,
  onSkip,
}: ObjectConfirmationProps) {
  const [mode, setMode] = useState<"review" | "correct">("review");
  const [correctedType, setCorrectedType] = useState(object.objectType);
  const [correctedIdentifier, setCorrectedIdentifier] = useState(object.identifier);
  const [correctedKey, setCorrectedKey] = useState(object.identifierKey);
  const [rejectReason, setRejectReason] = useState("");

  const handleConfirm = () => {
    onConfirm(object);
  };

  const handleReject = () => {
    onReject(object, rejectReason || undefined);
    setRejectReason("");
  };

  const handleCorrect = () => {
    onCorrect(object, {
      objectType: correctedType !== object.objectType ? correctedType : undefined,
      identifier: correctedIdentifier !== object.identifier ? correctedIdentifier : undefined,
      identifierKey: correctedKey !== object.identifierKey ? correctedKey : undefined,
    });
    setMode("review");
  };

  const confidenceColor = object.confidence >= 0.8
    ? "text-green-600"
    : object.confidence >= 0.5
    ? "text-yellow-600"
    : "text-red-600";

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Confirm Detection</CardTitle>
          <Badge variant="outline" className={confidenceColor}>
            {Math.round(object.confidence * 100)}% confidence
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {mode === "review" ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Object Type</Label>
                <div className="font-medium capitalize">{object.objectType.replace("_", " ")}</div>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Identifier</Label>
                <div className="font-mono font-medium">{object.identifier}</div>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <span>Detected via:</span>
                <Badge variant="secondary">{object.detectionMethod}</Badge>
              </div>

              {object.context.url && (
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">URL</Label>
                  <div className="text-xs font-mono truncate bg-muted p-1 rounded">
                    {object.context.url}
                  </div>
                </div>
              )}

              {object.context.title && (
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Window/Page Title</Label>
                  <div className="text-sm truncate">{object.context.title}</div>
                </div>
              )}

              {object.context.ocrText && (
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">OCR Text (excerpt)</Label>
                  <div className="text-xs bg-muted p-2 rounded max-h-20 overflow-auto">
                    {object.context.ocrText.substring(0, 200)}
                    {object.context.ocrText.length > 200 && "..."}
                  </div>
                </div>
              )}

              {object.context.screenshot && (
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Screenshot</Label>
                  <div className="border rounded overflow-hidden">
                    <img
                      src={object.context.screenshot}
                      alt="Screenshot context"
                      className="w-full max-h-32 object-cover"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={handleConfirm} variant="default">
                <Check className="mr-2 h-4 w-4" />
                Confirm
              </Button>
              <Button onClick={handleReject} variant="destructive">
                <X className="mr-2 h-4 w-4" />
                Reject
              </Button>
              <Button onClick={() => setMode("correct")} variant="outline">
                <Edit className="mr-2 h-4 w-4" />
                Correct
              </Button>
              {onSkip && (
                <Button onClick={onSkip} variant="ghost">
                  Skip
                </Button>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Object Type</Label>
                <Select value={correctedType} onValueChange={setCorrectedType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {objectTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type.replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Identifier Key</Label>
                <Input
                  value={correctedKey}
                  onChange={(e) => setCorrectedKey(e.target.value)}
                  placeholder="e.g., order_id, sku"
                />
              </div>

              <div className="space-y-2">
                <Label>Identifier Value</Label>
                <Input
                  value={correctedIdentifier}
                  onChange={(e) => setCorrectedIdentifier(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={handleCorrect} variant="default">
                <Check className="mr-2 h-4 w-4" />
                Save Correction
              </Button>
              <Button onClick={() => setMode("review")} variant="outline">
                Cancel
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

interface BulkReviewProps {
  objects: DetectedObject[];
  objectTypes: string[];
  onConfirmAll: (objects: DetectedObject[]) => void;
  onRejectAll: (objects: DetectedObject[]) => void;
  onConfirmOne: (object: DetectedObject) => void;
  onRejectOne: (object: DetectedObject) => void;
  onCorrectOne: (object: DetectedObject, corrections: { objectType?: string; identifier?: string; identifierKey?: string }) => void;
}

export function BulkReview({
  objects,
  objectTypes,
  onConfirmAll,
  onRejectAll,
  onConfirmOne,
  onRejectOne,
  onCorrectOne,
}: BulkReviewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"single" | "list">("single");

  const currentObject = objects[currentIndex];

  const handleNext = () => {
    setCurrentIndex((i) => Math.min(i + 1, objects.length - 1));
  };

  const handlePrev = () => {
    setCurrentIndex((i) => Math.max(i - 1, 0));
  };

  const handleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === objects.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(objects.map((o) => o.id)));
    }
  };

  const handleConfirmSelected = () => {
    const selected = objects.filter((o) => selectedIds.has(o.id));
    onConfirmAll(selected);
    setSelectedIds(new Set());
  };

  const handleRejectSelected = () => {
    const selected = objects.filter((o) => selectedIds.has(o.id));
    onRejectAll(selected);
    setSelectedIds(new Set());
  };

  if (objects.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No objects pending review
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === "single" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("single")}
          >
            Single View
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("list")}
          >
            List View
          </Button>
        </div>

        {viewMode === "list" && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleSelectAll}>
              {selectedIds.size === objects.length ? "Deselect All" : "Select All"}
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleConfirmSelected}
              disabled={selectedIds.size === 0}
            >
              <Check className="mr-2 h-4 w-4" />
              Confirm ({selectedIds.size})
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleRejectSelected}
              disabled={selectedIds.size === 0}
            >
              <X className="mr-2 h-4 w-4" />
              Reject ({selectedIds.size})
            </Button>
          </div>
        )}
      </div>

      {viewMode === "single" ? (
        <>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrev}
              disabled={currentIndex === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span>
              {currentIndex + 1} of {objects.length}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNext}
              disabled={currentIndex === objects.length - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <ObjectConfirmation
            object={currentObject}
            objectTypes={objectTypes}
            onConfirm={(obj) => {
              onConfirmOne(obj);
              handleNext();
            }}
            onReject={(obj) => {
              onRejectOne(obj);
              handleNext();
            }}
            onCorrect={(obj, corrections) => {
              onCorrectOne(obj, corrections);
              handleNext();
            }}
            onSkip={handleNext}
          />
        </>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="w-10 p-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === objects.length}
                    onChange={handleSelectAll}
                    className="rounded"
                  />
                </th>
                <th className="text-left p-3 text-sm font-medium">Type</th>
                <th className="text-left p-3 text-sm font-medium">Identifier</th>
                <th className="text-left p-3 text-sm font-medium">Confidence</th>
                <th className="text-left p-3 text-sm font-medium">Method</th>
                <th className="text-left p-3 text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {objects.map((obj) => (
                <tr key={obj.id} className="border-t hover:bg-muted/50">
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(obj.id)}
                      onChange={() => handleSelect(obj.id)}
                      className="rounded"
                    />
                  </td>
                  <td className="p-3 text-sm capitalize">
                    {obj.objectType.replace("_", " ")}
                  </td>
                  <td className="p-3 text-sm font-mono">{obj.identifier}</td>
                  <td className="p-3 text-sm">
                    <Badge
                      variant="outline"
                      className={
                        obj.confidence >= 0.8
                          ? "text-green-600"
                          : obj.confidence >= 0.5
                          ? "text-yellow-600"
                          : "text-red-600"
                      }
                    >
                      {Math.round(obj.confidence * 100)}%
                    </Badge>
                  </td>
                  <td className="p-3 text-sm">
                    <Badge variant="secondary">{obj.detectionMethod}</Badge>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onConfirmOne(obj)}
                        title="Confirm"
                      >
                        <Check className="h-4 w-4 text-green-600" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onRejectOne(obj)}
                        title="Reject"
                      >
                        <X className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
