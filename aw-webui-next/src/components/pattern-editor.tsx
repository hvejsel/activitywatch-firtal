"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, TestTube, Save, AlertCircle, CheckCircle } from "lucide-react";

export interface Pattern {
  id: string;
  pattern: string;
  objectType: string;
  identifierKey: string;
  patternType: "url" | "ocr" | "window_title";
  confidence: number;
  source: "default" | "user" | "learned";
  examples: string[];
  matchCount: number;
  confirmCount: number;
  rejectCount: number;
}

interface PatternEditorProps {
  patterns: Pattern[];
  objectTypes: string[];
  onSave: (patterns: Pattern[]) => void;
  onTest: (pattern: string, testValue: string) => boolean;
}

export function PatternEditor({
  patterns: initialPatterns,
  objectTypes,
  onSave,
  onTest,
}: PatternEditorProps) {
  const [patterns, setPatterns] = useState<Pattern[]>(initialPatterns);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testValue, setTestValue] = useState("");
  const [testResults, setTestResults] = useState<Record<string, boolean>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const handleAddPattern = () => {
    const newPattern: Pattern = {
      id: `pattern-${Date.now()}`,
      pattern: "",
      objectType: objectTypes[0] || "product",
      identifierKey: "id",
      patternType: "ocr",
      confidence: 0.5,
      source: "user",
      examples: [],
      matchCount: 0,
      confirmCount: 0,
      rejectCount: 0,
    };
    setPatterns([...patterns, newPattern]);
    setEditingId(newPattern.id);
    setHasChanges(true);
  };

  const handleUpdatePattern = (id: string, updates: Partial<Pattern>) => {
    setPatterns((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
    setHasChanges(true);
  };

  const handleDeletePattern = (id: string) => {
    setPatterns((prev) => prev.filter((p) => p.id !== id));
    setHasChanges(true);
  };

  const handleTestPattern = (pattern: Pattern) => {
    if (!testValue) return;
    const result = onTest(pattern.pattern, testValue);
    setTestResults((prev) => ({ ...prev, [pattern.id]: result }));
  };

  const handleTestAll = () => {
    if (!testValue) return;
    const results: Record<string, boolean> = {};
    patterns.forEach((p) => {
      results[p.id] = onTest(p.pattern, testValue);
    });
    setTestResults(results);
  };

  const handleSave = () => {
    onSave(patterns);
    setHasChanges(false);
  };

  const getPatternStats = (pattern: Pattern) => {
    const total = pattern.confirmCount + pattern.rejectCount;
    if (total === 0) return null;
    const accuracy = pattern.confirmCount / total;
    return { total, accuracy };
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Pattern Editor</h3>
          <p className="text-sm text-muted-foreground">
            Edit regex patterns for object detection
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleAddPattern}>
            <Plus className="mr-2 h-4 w-4" />
            Add Pattern
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges}>
            <Save className="mr-2 h-4 w-4" />
            Save Changes
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Test Patterns</CardTitle>
          <CardDescription>Enter a value to test against all patterns</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Enter test value (e.g., ORD-12345)"
              value={testValue}
              onChange={(e) => setTestValue(e.target.value)}
              className="flex-1"
            />
            <Button variant="outline" onClick={handleTestAll}>
              <TestTube className="mr-2 h-4 w-4" />
              Test All
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {patterns.map((pattern) => {
          const stats = getPatternStats(pattern);
          const isEditing = editingId === pattern.id;
          const testResult = testResults[pattern.id];

          return (
            <Card key={pattern.id} className={isEditing ? "ring-2 ring-primary" : ""}>
              <CardContent className="pt-4">
                {isEditing ? (
                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Object Type</Label>
                        <Select
                          value={pattern.objectType}
                          onValueChange={(v) =>
                            handleUpdatePattern(pattern.id, { objectType: v })
                          }
                        >
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
                        <Label>Pattern Type</Label>
                        <Select
                          value={pattern.patternType}
                          onValueChange={(v: "url" | "ocr" | "window_title") =>
                            handleUpdatePattern(pattern.id, { patternType: v })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="url">URL Pattern</SelectItem>
                            <SelectItem value="ocr">OCR Pattern</SelectItem>
                            <SelectItem value="window_title">Window Title</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Identifier Key</Label>
                      <Input
                        value={pattern.identifierKey}
                        onChange={(e) =>
                          handleUpdatePattern(pattern.id, {
                            identifierKey: e.target.value,
                          })
                        }
                        placeholder="e.g., order_id, sku"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Regex Pattern</Label>
                      <div className="flex gap-2">
                        <Input
                          value={pattern.pattern}
                          onChange={(e) =>
                            handleUpdatePattern(pattern.id, { pattern: e.target.value })
                          }
                          placeholder="e.g., Order\s*#?\s*([A-Z0-9-]+)"
                          className="font-mono text-sm"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleTestPattern(pattern)}
                          disabled={!testValue}
                        >
                          <TestTube className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Use capturing groups () to extract the identifier value
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => setEditingId(null)}
                      >
                        Done
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeletePattern(pattern.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="cursor-pointer"
                    onClick={() => setEditingId(pattern.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium capitalize">
                            {pattern.objectType.replace("_", " ")}
                          </span>
                          <Badge variant="outline">{pattern.patternType}</Badge>
                          <Badge
                            variant={pattern.source === "user" ? "default" : "secondary"}
                          >
                            {pattern.source}
                          </Badge>
                          {testResult !== undefined && (
                            testResult ? (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-red-600" />
                            )
                          )}
                        </div>
                        <div className="font-mono text-sm text-muted-foreground truncate max-w-lg">
                          {pattern.pattern || "(empty pattern)"}
                        </div>
                      </div>

                      <div className="text-right">
                        {stats && (
                          <div className="text-xs text-muted-foreground">
                            <div>{stats.total} matches</div>
                            <div
                              className={
                                stats.accuracy >= 0.8
                                  ? "text-green-600"
                                  : stats.accuracy >= 0.5
                                  ? "text-yellow-600"
                                  : "text-red-600"
                              }
                            >
                              {Math.round(stats.accuracy * 100)}% accuracy
                            </div>
                          </div>
                        )}
                        <Badge variant="outline" className="mt-1">
                          {Math.round(pattern.confidence * 100)}% conf
                        </Badge>
                      </div>
                    </div>

                    {pattern.examples.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {pattern.examples.slice(0, 5).map((ex, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {ex}
                          </Badge>
                        ))}
                        {pattern.examples.length > 5 && (
                          <Badge variant="secondary" className="text-xs">
                            +{pattern.examples.length - 5} more
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        {patterns.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No patterns defined. Click "Add Pattern" to create one.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
