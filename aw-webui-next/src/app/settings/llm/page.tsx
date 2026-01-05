"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function LLMSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">LLM Settings</h1>
        <p className="text-muted-foreground">
          Configure AI models for screenshot analysis and object detection
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Primary Provider</CardTitle>
          <CardDescription>
            Select the main LLM provider for analysis
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Provider</Label>
            <Select defaultValue="ollama">
              <SelectTrigger>
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ollama">Ollama (Local)</SelectItem>
                <SelectItem value="claude">Claude (Anthropic)</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Model</Label>
            <Select defaultValue="qwen2.5-vl:7b">
              <SelectTrigger>
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="qwen2.5-vl:7b">Qwen2.5-VL 7B (Recommended)</SelectItem>
                <SelectItem value="llava:latest">LLaVA</SelectItem>
                <SelectItem value="minicpm-v:latest">MiniCPM-V</SelectItem>
                <SelectItem value="moondream:latest">Moondream</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ollama Configuration</CardTitle>
          <CardDescription>
            Configure your local Ollama instance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Ollama URL</Label>
            <Input defaultValue="http://localhost:11434" />
          </div>
          <Button variant="outline">Test Connection</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Claude Configuration</CardTitle>
          <CardDescription>
            Configure Anthropic Claude as fallback provider
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>API Key</Label>
            <Input type="password" placeholder="sk-ant-..." />
          </div>
          <div className="space-y-2">
            <Label>Model</Label>
            <Select defaultValue="claude-3-haiku">
              <SelectTrigger>
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="claude-3-haiku">Claude 3 Haiku (Fast)</SelectItem>
                <SelectItem value="claude-3-sonnet">Claude 3.5 Sonnet</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fallback Settings</CardTitle>
          <CardDescription>
            Configure fallback behavior when primary provider fails
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <input type="checkbox" id="enable-fallback" defaultChecked />
            <Label htmlFor="enable-fallback">Enable fallback to secondary provider</Label>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button>Save Settings</Button>
      </div>
    </div>
  );
}
