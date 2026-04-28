"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Eye, EyeOff, Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ── Model catalogue ────────────────────────────────────────────────────────

type ModelEntry = { id: string; label: string; vision: boolean; provider: string };

export const OPENROUTER_MODELS: ModelEntry[] = [
  // Anthropic
  { id: "anthropic/claude-opus-4", label: "Claude Opus 4", vision: true, provider: "Anthropic" },
  { id: "anthropic/claude-sonnet-4-5", label: "Claude Sonnet 4.5", vision: true, provider: "Anthropic" },
  { id: "anthropic/claude-3.5-haiku", label: "Claude 3.5 Haiku", vision: true, provider: "Anthropic" },
  // OpenAI
  { id: "openai/gpt-4o", label: "GPT-4o", vision: true, provider: "OpenAI" },
  { id: "openai/gpt-4o-mini", label: "GPT-4o mini", vision: true, provider: "OpenAI" },
  { id: "openai/o3-mini", label: "o3-mini", vision: false, provider: "OpenAI" },
  // Google
  { id: "google/gemini-2.5-pro-preview-05-06", label: "Gemini 2.5 Pro", vision: true, provider: "Google" },
  { id: "google/gemini-2.5-flash-preview-05-20", label: "Gemini 2.5 Flash", vision: true, provider: "Google" },
  { id: "google/gemini-2.0-flash-001", label: "Gemini 2.0 Flash", vision: true, provider: "Google" },
  // Qwen
  { id: "qwen/qwen3-235b-a22b", label: "Qwen3 235B", vision: false, provider: "Qwen" },
  { id: "qwen/qwen3-30b-a3b", label: "Qwen3 30B", vision: false, provider: "Qwen" },
  { id: "qwen/qwen-2.5-72b-instruct", label: "Qwen 2.5 72B", vision: false, provider: "Qwen" },
  { id: "qwen/qwq-32b", label: "QwQ 32B", vision: false, provider: "Qwen" },
  // DeepSeek
  { id: "deepseek/deepseek-chat-v3-0324", label: "DeepSeek V3", vision: false, provider: "DeepSeek" },
  { id: "deepseek/deepseek-r1", label: "DeepSeek R1", vision: false, provider: "DeepSeek" },
  { id: "deepseek/deepseek-r1-0528", label: "DeepSeek R1 (0528)", vision: false, provider: "DeepSeek" },
  // Meta
  { id: "meta-llama/llama-4-maverick", label: "Llama 4 Maverick", vision: true, provider: "Meta" },
  { id: "meta-llama/llama-4-scout", label: "Llama 4 Scout", vision: true, provider: "Meta" },
  { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B", vision: false, provider: "Meta" },
  // Mistral
  { id: "mistralai/mistral-large", label: "Mistral Large", vision: false, provider: "Mistral" },
  { id: "mistralai/mistral-small-3.1-24b-instruct", label: "Mistral Small 3.1", vision: true, provider: "Mistral" },
  { id: "mistralai/devstral-small-2505", label: "Devstral Small", vision: false, provider: "Mistral" },
  // xAI
  { id: "x-ai/grok-3-beta", label: "Grok 3", vision: false, provider: "xAI" },
  { id: "x-ai/grok-3-mini-beta", label: "Grok 3 Mini", vision: false, provider: "xAI" },
  // Microsoft
  { id: "microsoft/phi-4", label: "Phi-4", vision: false, provider: "Microsoft" },
  { id: "microsoft/phi-4-multimodal-instruct", label: "Phi-4 Multimodal", vision: true, provider: "Microsoft" },
];

const PROVIDERS = [...new Set(OPENROUTER_MODELS.map((m) => m.provider))];

// ── Inner form (reusable in modal or inline) ───────────────────────────────

type ContentProps = { onSaved?: () => void };

export function AiKeySettingsContent({ onSaved }: ContentProps) {
  const [keyInput, setKeyInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [model, setModel] = useState("anthropic/claude-sonnet-4-5");
  const [customModel, setCustomModel] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [keyPreview, setKeyPreview] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set(PROVIDERS));
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/settings/ai")
      .then((r) => r.json())
      .then((d) => {
        setHasKey(d.hasKey ?? false);
        setKeyPreview(d.keyPreview ?? null);
        const savedModel = d.model ?? "anthropic/claude-sonnet-4-5";
        const known = OPENROUTER_MODELS.find((m) => m.id === savedModel);
        if (known) {
          setModel(savedModel);
          setUseCustom(false);
        } else {
          setCustomModel(savedModel);
          setUseCustom(true);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggleProvider = (p: string) =>
    setExpandedProviders((prev) => {
      const next = new Set(prev);
      next.has(p) ? next.delete(p) : next.add(p);
      return next;
    });

  const filteredModels = search.trim()
    ? OPENROUTER_MODELS.filter(
        (m) =>
          m.label.toLowerCase().includes(search.toLowerCase()) ||
          m.id.toLowerCase().includes(search.toLowerCase()) ||
          m.provider.toLowerCase().includes(search.toLowerCase())
      )
    : OPENROUTER_MODELS;

  const filteredProviders = search.trim()
    ? [...new Set(filteredModels.map((m) => m.provider))]
    : PROVIDERS;

  const activeModelId = useCustom ? customModel.trim() || "" : model;

  const save = async () => {
    const finalModel = useCustom ? customModel.trim() : model;
    if (!finalModel) return;

    setSaving(true);
    setSaved(false);
    try {
      const body: { key?: string; model: string } = { model: finalModel };
      if (keyInput.trim()) body.key = keyInput.trim();

      await fetch("/api/settings/ai", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (keyInput.trim()) {
        setHasKey(true);
        setKeyPreview(`${keyInput.trim().slice(0, 8)}…`);
        setKeyInput("");
      }
      setSaved(true);
      setTimeout(() => { setSaved(false); onSaved?.(); }, 1500);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* API Key */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-foreground">OpenRouter API Key</label>
        {hasKey && !keyInput && (
          <p className="text-[11px] text-muted-foreground">
            Current key: <span className="font-mono text-foreground">{keyPreview}</span>
            <span className="ml-2 text-muted-foreground/70">— enter a new key to replace</span>
          </p>
        )}
        <div className="relative">
          <input
            type={showKey ? "text" : "password"}
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder={hasKey ? "Enter new key to replace…" : "sk-or-…"}
            autoComplete="off"
            className={cn(
              "w-full rounded-md border border-border bg-background py-2 pl-3 pr-9 font-mono text-xs",
              "placeholder:font-sans placeholder:text-muted-foreground",
              "focus:border-primary/60 focus:outline-none"
            )}
          />
          <button
            type="button"
            onClick={() => setShowKey((v) => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Get your key at{" "}
          <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="text-primary underline-offset-2 hover:underline">
            openrouter.ai/keys
          </a>
          . Stored securely, never returned to the browser.
        </p>
      </div>

      {/* Model picker */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-foreground">Model</label>
          {!useCustom && activeModelId && (
            <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[200px]">{activeModelId}</span>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search models…"
            className="w-full rounded-md border border-border bg-background py-1.5 pl-7 pr-3 text-xs placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none"
          />
          {search && (
            <button type="button" onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Model list grouped by provider */}
        <div className="max-h-56 overflow-y-auto rounded-md border border-border bg-background">
          {filteredProviders.map((provider) => {
            const models = filteredModels.filter((m) => m.provider === provider);
            const expanded = search.trim() || expandedProviders.has(provider);
            return (
              <div key={provider}>
                <button
                  type="button"
                  onClick={() => toggleProvider(provider)}
                  className="flex w-full items-center justify-between px-3 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground uppercase tracking-wide transition-colors bg-muted/30"
                >
                  {provider}
                  <ChevronDown className={cn("h-3 w-3 transition-transform", expanded ? "rotate-0" : "-rotate-90")} />
                </button>
                {expanded && models.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => { setModel(m.id); setUseCustom(false); }}
                    className={cn(
                      "flex w-full items-center justify-between px-3 py-2 text-left text-xs transition-colors",
                      !useCustom && model === m.id
                        ? "bg-primary/15 text-foreground"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    )}
                  >
                    <span className="font-medium">{m.label}</span>
                    <div className="flex items-center gap-1.5">
                      {m.vision && <span className="text-[9px] text-primary/70 font-medium">vision</span>}
                      {!useCustom && model === m.id && <Check className="h-3 w-3 text-primary" />}
                    </div>
                  </button>
                ))}
              </div>
            );
          })}
          {filteredProviders.length === 0 && (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">No models match &ldquo;{search}&rdquo;</p>
          )}
        </div>

        {/* Custom model ID */}
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => setUseCustom((v) => !v)}
            className={cn("text-left text-[11px] transition-colors", useCustom ? "text-primary" : "text-muted-foreground hover:text-foreground")}
          >
            {useCustom ? "▼" : "▶"} Use custom model ID
          </button>
          {useCustom && (
            <input
              type="text"
              value={customModel}
              onChange={(e) => setCustomModel(e.target.value)}
              placeholder="e.g. mistralai/mistral-large-2411"
              autoFocus
              className="w-full rounded-md border border-border bg-background py-1.5 px-3 font-mono text-xs placeholder:font-sans placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none"
            />
          )}
        </div>
      </div>

      {/* Save */}
      <Button
        onClick={save}
        disabled={saving || (!keyInput.trim() && !hasKey) || (useCustom && !customModel.trim())}
        className="w-full"
      >
        {saving ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : saved ? <Check className="mr-2 h-3.5 w-3.5" /> : null}
        {saved ? "Saved!" : "Save Settings"}
      </Button>

      {!hasKey && (
        <p className="text-center text-[11px] text-muted-foreground">
          Add an API key to enable AI animation.
        </p>
      )}
    </div>
  );
}

// ── Modal wrapper ──────────────────────────────────────────────────────────

type ModalProps = { onClose: () => void };

export function AiKeySettings({ onClose }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">AI Settings</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Connect your <span className="text-foreground font-medium">OpenRouter</span> account to power AI animation.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <AiKeySettingsContent onSaved={onClose} />
      </div>
    </div>
  );
}
