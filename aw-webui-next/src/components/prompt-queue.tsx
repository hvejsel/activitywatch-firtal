"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { DecisionPrompt, QuickPrompt, type UserPrompt } from "./decision-prompt";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, CheckCircle2, XCircle, ChevronRight } from "lucide-react";

const AW_SERVER_URL = process.env.NEXT_PUBLIC_AW_SERVER_URL || "http://localhost:5600";
const API_BASE = `${AW_SERVER_URL}/api/0`;

interface PromptQueueProps {
  pollInterval?: number;
  showNotifications?: boolean;
  maxToasts?: number;
}

async function fetchPendingPrompts(): Promise<UserPrompt[]> {
  try {
    const response = await fetch(`${API_BASE}/taskmining/prompts/pending`);
    if (!response.ok) {
      throw new Error(`Failed to fetch prompts: ${response.status}`);
    }
    return response.json();
  } catch (error) {
    console.error("Failed to fetch prompts:", error);
    return [];
  }
}

async function submitResponse(
  promptId: string,
  response: string,
  customValue?: string
): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/taskmining/prompts/${promptId}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ response, custom_value: customValue }),
    });
    return res.ok;
  } catch (error) {
    console.error("Failed to submit response:", error);
    return false;
  }
}

async function dismissPrompt(promptId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/taskmining/prompts/${promptId}/dismiss`, {
      method: "POST",
    });
    return res.ok;
  } catch (error) {
    console.error("Failed to dismiss prompt:", error);
    return false;
  }
}

export function PromptQueue({
  pollInterval = 30000,
  showNotifications = true,
  maxToasts = 3,
}: PromptQueueProps) {
  const [prompts, setPrompts] = useState<UserPrompt[]>([]);
  const [activePrompt, setActivePrompt] = useState<UserPrompt | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [notifiedPrompts, setNotifiedPrompts] = useState<Set<string>>(new Set());

  const loadPrompts = useCallback(async () => {
    const pending = await fetchPendingPrompts();
    setPrompts(pending);
    return pending;
  }, []);

  // Poll for new prompts
  useEffect(() => {
    loadPrompts();
    const interval = setInterval(loadPrompts, pollInterval);
    return () => clearInterval(interval);
  }, [loadPrompts, pollInterval]);

  // Show toast notifications for new prompts
  useEffect(() => {
    if (!showNotifications) return;

    const newPrompts = prompts.filter((p) => !notifiedPrompts.has(p.id));
    if (newPrompts.length === 0) return;

    // Only show toasts for high-priority prompts
    const toShow = newPrompts
      .filter((p) => p.priority >= 2)
      .slice(0, maxToasts);

    toShow.forEach((prompt) => {
      toast.custom(
        (toastId) => (
          <div className="flex items-start gap-3 p-4 bg-background border rounded-lg shadow-lg max-w-sm">
            <Bell className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{prompt.title}</p>
              <p className="text-xs text-muted-foreground truncate">
                {prompt.message}
              </p>
              <div className="flex gap-2 mt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    toast.dismiss(toastId);
                    handleDismiss(prompt.id);
                  }}
                >
                  Later
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    toast.dismiss(toastId);
                    setActivePrompt(prompt);
                    setDialogOpen(true);
                  }}
                >
                  Answer
                </Button>
              </div>
            </div>
            <button
              onClick={() => toast.dismiss(toastId)}
              className="text-muted-foreground hover:text-foreground"
            >
              <XCircle className="h-4 w-4" />
            </button>
          </div>
        ),
        {
          duration: 15000,
          position: "bottom-right",
        }
      );
    });

    // Mark all new prompts as notified
    setNotifiedPrompts((prev) => {
      const next = new Set(prev);
      newPrompts.forEach((p) => next.add(p.id));
      return next;
    });
  }, [prompts, showNotifications, maxToasts, notifiedPrompts]);

  const handleResponse = async (
    promptId: string,
    response: string,
    customValue?: string
  ) => {
    const success = await submitResponse(promptId, response, customValue);
    if (success) {
      toast.success("Response recorded", {
        description: "Thank you for your feedback!",
      });
      setPrompts((prev) => prev.filter((p) => p.id !== promptId));
    } else {
      toast.error("Failed to submit response");
    }
  };

  const handleDismiss = async (promptId: string) => {
    const success = await dismissPrompt(promptId);
    if (success) {
      setPrompts((prev) => prev.filter((p) => p.id !== promptId));
    }
  };

  const handleOpenPrompt = (prompt: UserPrompt) => {
    setActivePrompt(prompt);
    setDialogOpen(true);
  };

  return (
    <>
      {/* Dialog for full prompt */}
      {activePrompt && (
        <DecisionPrompt
          prompt={activePrompt}
          open={dialogOpen}
          onClose={() => {
            setDialogOpen(false);
            setActivePrompt(null);
          }}
          onResponse={handleResponse}
          onDismiss={handleDismiss}
        />
      )}
    </>
  );
}

// Prompt indicator for navigation/header
interface PromptIndicatorProps {
  onClick?: () => void;
}

export function PromptIndicator({ onClick }: PromptIndicatorProps) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    async function loadCount() {
      const prompts = await fetchPendingPrompts();
      setCount(prompts.length);
    }
    loadCount();
    const interval = setInterval(loadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  if (count === 0) return null;

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className="relative"
    >
      <Bell className="h-4 w-4" />
      <Badge
        variant="destructive"
        className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
      >
        {count}
      </Badge>
    </Button>
  );
}

// Prompt list for settings or dedicated page
interface PromptListProps {
  onPromptOpen?: (prompt: UserPrompt) => void;
}

export function PromptList({ onPromptOpen }: PromptListProps) {
  const [prompts, setPrompts] = useState<UserPrompt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const data = await fetchPendingPrompts();
      setPrompts(data);
      setLoading(false);
    }
    load();
  }, []);

  const handleDismiss = async (promptId: string) => {
    const success = await dismissPrompt(promptId);
    if (success) {
      setPrompts((prev) => prev.filter((p) => p.id !== promptId));
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8 text-muted-foreground">Loading...</div>
    );
  }

  if (prompts.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <CheckCircle2 className="h-8 w-8 mx-auto mb-2" />
        <p>No pending prompts</p>
        <p className="text-sm">All caught up!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {prompts.map((prompt) => (
        <div
          key={prompt.id}
          className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
          onClick={() => onPromptOpen?.(prompt)}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-xs">
                {prompt.ambiguity_type.replace(/_/g, " ")}
              </Badge>
              <Badge
                variant={prompt.priority >= 3 ? "destructive" : "secondary"}
                className="text-xs"
              >
                {prompt.priority >= 3 ? "High" : "Normal"}
              </Badge>
            </div>
            <p className="font-medium text-sm">{prompt.title}</p>
            <p className="text-xs text-muted-foreground truncate">
              {prompt.message}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              handleDismiss(prompt.id);
            }}
          >
            <XCircle className="h-4 w-4" />
          </Button>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      ))}
    </div>
  );
}
