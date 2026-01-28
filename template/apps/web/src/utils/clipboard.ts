import type React from "react";

/**
 * Copy text to clipboard with fallback for non-secure contexts.
 * Uses modern Clipboard API when available, falls back to execCommand.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // Try modern clipboard API first
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn("Clipboard API failed, trying fallback:", err);
    }
  }

  // Fallback: create temporary textarea
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const success = document.execCommand("copy");
    document.body.removeChild(textArea);
    return success;
  } catch (err) {
    console.error("Fallback copy failed:", err);
    return false;
  }
}

/**
 * Generate a random 6-digit numeric access code.
 */
export function generateAccessCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Copy text from an input element using its ref.
 * Works inside dialogs with focus traps where navigator.clipboard may fail.
 */
export function copyFromInput(inputRef: React.RefObject<HTMLInputElement | null>): boolean {
  const input = inputRef.current;
  if (!input) return false;

  try {
    // Store the current selection
    const start = input.selectionStart;
    const end = input.selectionEnd;

    // Select all text in the input
    input.focus();
    input.select();
    input.setSelectionRange(0, input.value.length);

    // Execute copy command
    const success = document.execCommand("copy");

    // Restore selection and blur
    if (start !== null && end !== null) {
      input.setSelectionRange(start, end);
    }
    input.blur();

    return success;
  } catch (err) {
    console.error("[copyFromInput] Failed:", err);
    return false;
  }
}
