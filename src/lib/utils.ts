import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Teach tailwind-merge the custom design tokens from globals.css, so that
// e.g. `rounded-window` passed to <Card> replaces its default `rounded-sketch`.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      radius: ["sketch", "sketch-alt", "blob", "window", "window-bar", "panel"],
      shadow: [
        "pop-xs",
        "pop-sm",
        "pop",
        "pop-pink",
        "pop-yellow",
        "pop-cyan",
        "pop-green",
        "window",
        "panel",
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
