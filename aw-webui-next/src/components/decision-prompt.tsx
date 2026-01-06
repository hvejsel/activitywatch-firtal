"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  HelpCircle,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  GitBranch,
  Link2,
  Sparkles,
} from "lucide-react";

export interface PromptOption {
  id: string;
  label: string;
  description?: string;
  is_default?: boolean;
}

export interface UserPrompt {
  id: string;
  ambiguity_type: string;
  priority: number;
  title: string;
  message: string;
  options: PromptOption[];
  context: Record<string, unknown>;
  created_at: string;
  expires_at?: string;
  status: string;
}

interface DecisionPromptProps {
  prompt: UserPrompt;
  open: boolean;
  onClose: () => void;
  onResponse: (promptId: string, response: string, customValue?: string) => void;
  onDismiss: (promptId: string) => void;
}

const AMBIGUITY_ICONS: Record<string, typeof HelpCircle> = {
  decision_point: GitBranch,
  unknown_intent: HelpCircle,
  new_pattern: Sparkles,
  object_relationship: Link2,
  context_switch: Clock,
  object_confirmation: CheckCircle2,
  process_boundary: AlertTriangle,
};

const AMBIGUITY_COLORS: Record<string, string> = {
  decision_point: "bg-blue-100 text-blue-700",
  unknown_intent: "bg-gray-100 text-gray-700",
  new_pattern: "bg-purple-100 text-purple-700",
  object_relationship: "bg-green-100 text-green-700",
  context_switch: "bg-yellow-100 text-yellow-700",
  object_confirmation: "bg-teal-100 text-teal-700",
  process_boundary: "bg-orange-100 text-orange-700",
};

const PRIORITY_LABELS: Record<number, string> = {
  1: "Low",
  2: "Medium",
  3: "High",
  4: "Urgent",
};

export function DecisionPrompt({
  prompt,
  open,
  onClose,
  onResponse,
  onDismiss,
}: DecisionPromptProps) {
  const [selectedOption, setSelectedOption] = useState<string>("");
  const [customValue, setCustomValue] = useState("");
  const [isOther, setIsOther] = useState(false);

  const Icon = AMBIGUITY_ICONS[prompt.ambiguity_type] || HelpCircle;
  const badgeColor = AMBIGUITY_COLORS[prompt.ambiguity_type] || "bg-gray-100 text-gray-700";

  const handleSubmit = () => {
    if (isOther && customValue) {
      onResponse(prompt.id, "other", customValue);
    } else if (selectedOption) {
      onResponse(prompt.id, selectedOption);
    }
    setSelectedOption("");
    setCustomValue("");
    setIsOther(false);
    onClose();
  };

  const handleDismiss = () => {
    onDismiss(prompt.id);
    setSelectedOption("");
    setCustomValue("");
    setIsOther(false);
    onClose();
  };

  const handleOptionChange = (value: string) => {
    if (value === "other") {
      setIsOther(true);
      setSelectedOption("");
    } else {
      setIsOther(false);
      setSelectedOption(value);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <Icon className="h-5 w-5 text-muted-foreground" />
            <Badge className={badgeColor}>
              {prompt.ambiguity_type.replace(/_/g, " ")}
            </Badge>
            <Badge variant="outline">
              {PRIORITY_LABELS[prompt.priority] || "Normal"}
            </Badge>
          </div>
          <DialogTitle>{prompt.title}</DialogTitle>
          <DialogDescription>{prompt.message}</DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <RadioGroup
            value={isOther ? "other" : selectedOption}
            onValueChange={handleOptionChange}
          >
            {prompt.options.map((option) => (
              <div
                key={option.id}
                className="flex items-start space-x-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer"
                onClick={() => handleOptionChange(option.id)}
              >
                <RadioGroupItem value={option.id} id={option.id} className="mt-0.5" />
                <div className="flex-1">
                  <Label htmlFor={option.id} className="font-medium cursor-pointer">
                    {option.label}
                  </Label>
                  {option.description && (
                    <p className="text-sm text-muted-foreground">{option.description}</p>
                  )}
                </div>
              </div>
            ))}

            <div
              className="flex items-start space-x-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer"
              onClick={() => handleOptionChange("other")}
            >
              <RadioGroupItem value="other" id="other" className="mt-0.5" />
              <div className="flex-1">
                <Label htmlFor="other" className="font-medium cursor-pointer">
                  Other
                </Label>
                <p className="text-sm text-muted-foreground">Provide your own answer</p>
              </div>
            </div>
          </RadioGroup>

          {isOther && (
            <div className="mt-4 ml-6">
              <Input
                placeholder="Type your answer..."
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                autoFocus
              />
            </div>
          )}

          {prompt.context && Object.keys(prompt.context).length > 0 && (
            <div className="mt-4 p-3 bg-muted/50 rounded-lg">
              <p className="text-xs font-medium text-muted-foreground mb-2">Context</p>
              <div className="text-xs space-y-1">
                {Object.entries(prompt.context).map(([key, value]) => (
                  <div key={key} className="flex">
                    <span className="text-muted-foreground w-24 shrink-0">
                      {key.replace(/_/g, " ")}:
                    </span>
                    <span className="font-mono truncate">
                      {typeof value === "string"
                        ? value.slice(0, 50)
                        : JSON.stringify(value).slice(0, 50)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={handleDismiss}>
            Skip
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedOption && (!isOther || !customValue)}
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface PromptToastProps {
  prompt: UserPrompt;
  onOpen: () => void;
  onDismiss: () => void;
}

export function PromptToast({ prompt, onOpen, onDismiss }: PromptToastProps) {
  const Icon = AMBIGUITY_ICONS[prompt.ambiguity_type] || HelpCircle;
  const badgeColor = AMBIGUITY_COLORS[prompt.ambiguity_type] || "bg-gray-100 text-gray-700";

  return (
    <div className="flex items-start gap-3 p-4 bg-background border rounded-lg shadow-lg max-w-sm animate-in slide-in-from-right">
      <Icon className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Badge className={`${badgeColor} text-xs`}>
            {prompt.ambiguity_type.replace(/_/g, " ")}
          </Badge>
        </div>
        <p className="font-medium text-sm">{prompt.title}</p>
        <p className="text-xs text-muted-foreground truncate">{prompt.message}</p>
        <div className="flex gap-2 mt-2">
          <Button size="sm" variant="outline" onClick={onDismiss}>
            Later
          </Button>
          <Button size="sm" onClick={onOpen}>
            Answer
          </Button>
        </div>
      </div>
      <button
        onClick={onDismiss}
        className="text-muted-foreground hover:text-foreground"
      >
        <XCircle className="h-4 w-4" />
      </button>
    </div>
  );
}

interface QuickPromptProps {
  prompt: UserPrompt;
  onResponse: (promptId: string, response: string) => void;
  onExpand: () => void;
}

export function QuickPrompt({ prompt, onResponse, onExpand }: QuickPromptProps) {
  const Icon = AMBIGUITY_ICONS[prompt.ambiguity_type] || HelpCircle;

  // Show only first 2-3 options for quick response
  const quickOptions = prompt.options.slice(0, 3);

  return (
    <div className="p-4 bg-background border rounded-lg shadow-lg max-w-md">
      <div className="flex items-start gap-3">
        <Icon className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-medium text-sm mb-2">{prompt.title}</p>
          <div className="flex flex-wrap gap-2">
            {quickOptions.map((option) => (
              <Button
                key={option.id}
                size="sm"
                variant="outline"
                onClick={() => onResponse(prompt.id, option.id)}
              >
                {option.label}
              </Button>
            ))}
            {prompt.options.length > 3 && (
              <Button size="sm" variant="ghost" onClick={onExpand}>
                More...
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
