"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyPromptButton({ prompt, title }: { prompt: string; title: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "unavailable">("idle");

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setStatus("copied");
    } catch {
      setStatus("unavailable");
    }
  }

  return (
    <div className="sw-chatgpt-prompt-copy">
      <button type="button" className="sw-public-link" aria-label={`Copy prompt for ${title}`} onClick={copyPrompt}>
        {status === "copied" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        {status === "copied" ? "Copied" : "Copy prompt"}
      </button>
      <span role="status" className={status === "unavailable" ? "sw-chatgpt-prompt-copy__feedback" : "sr-only"}>
        {status === "copied" ? "Prompt copied." : status === "unavailable" ? "Select the prompt text to copy it." : ""}
      </span>
    </div>
  );
}
