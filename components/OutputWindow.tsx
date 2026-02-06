import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface OutputWindowProps {
  onClose: () => void;
  onBlock: () => void;
  children: React.ReactNode;

  /**
   * ✅ Pass the Window you opened synchronously inside the Launch Output click.
   * This avoids popup blockers.
   */
  externalWindow?: Window | null;

  /** Optional fallback: if externalWindow isn't provided, OutputWindow can attempt to open one (may be blocked). */
  windowName?: string;
  features?: string;
}

/**
 * Projector popout window.
 * - Copies styles into the new window so Tailwind/Vite injected CSS works.
 * - Handles React 18 StrictMode double-invocation (dev) so the window doesn't instantly close.
 */
export const OutputWindow: React.FC<OutputWindowProps> = ({
  onClose,
  onBlock,
  children,
  externalWindow = null,
  windowName = "LuminaOutput",
  features = "width=1280,height=720,menubar=no,toolbar=no,location=no,status=no",
}) => {
  const winRef = useRef<Window | null>(null);
  const createdByMeRef = useRef(false);
  const [container, setContainer] = useState<HTMLElement | null>(null);

  // React 18 StrictMode (dev): mount/cleanup/mount again.
  // Ignore the first cleanup so the popout doesn't close immediately.
  const effectRunIdRef = useRef(0);

  const targetWindow = useMemo(() => {
    if (externalWindow && !externalWindow.closed) return externalWindow;
    return null;
  }, [externalWindow]);

  useEffect(() => {
    effectRunIdRef.current += 1;
    const runId = effectRunIdRef.current;

    let w: Window | null = null;

    if (targetWindow) {
      w = targetWindow;
      createdByMeRef.current = false;
    } else {
      w =
        winRef.current && !winRef.current.closed
          ? winRef.current
          : window.open("", windowName, features);
      createdByMeRef.current = true;
    }

    if (!w || w.closed || typeof w.closed === "undefined") {
      onBlock();
      return;
    }

    winRef.current = w;

    // Base document
    w.document.title = "Lumina Output (Projector)";
    
    // Force title persistence
    const titleScript = w.document.createElement('script');
    titleScript.innerHTML = `
      setInterval(() => {
        if (document.title !== "Lumina Output (Projector)") {
          document.title = "Lumina Output (Projector)";
        }
      }, 1000);
    `;
    w.document.head.appendChild(titleScript);

    w.document.body.style.margin = "0";
    w.document.body.style.padding = "0";
    w.document.body.style.overflow = "hidden";
    w.document.body.style.backgroundColor = "black";

    // Clear body
    w.document.body.innerHTML = "";

    // Root container
    const div = w.document.createElement("div");
    div.id = "output-root";
    div.style.width = "100vw";
    div.style.height = "100vh";
    div.style.background = "black";
    w.document.body.appendChild(div);
    setContainer(div);

    // Copy styles (Vite dev injects <style> tags, Tailwind compiled CSS is <style>/<link>)
    const head = w.document.head;
    const markerName = "lumina-output-styles";
    const existingMarker = head.querySelector(`meta[name="${markerName}"]`);

    if (!existingMarker) {
      const marker = w.document.createElement("meta");
      marker.name = markerName;
      marker.content = "1";
      head.appendChild(marker);

      Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')).forEach(
        (link) => {
          const newLink = w!.document.createElement("link");
          newLink.rel = "stylesheet";
          newLink.href = link.href;
          head.appendChild(newLink);
        }
      );

      Array.from(document.querySelectorAll<HTMLStyleElement>("style")).forEach((style) => {
        const newStyle = w!.document.createElement("style");
        newStyle.textContent = style.textContent;
        head.appendChild(newStyle);
      });
    }

    try {
      w.focus();
    } catch {
      // ignore
    }

    // Closed detection
    const checkClosed = window.setInterval(() => {
      if (w && w.closed) {
        onClose();
        window.clearInterval(checkClosed);
      }
    }, 500);

    // Ensure child closes if parent reloads/closes
    const handleParentUnload = () => {
      try {
        w?.close();
      } catch {
        // ignore
      }
    };

    window.addEventListener("unload", handleParentUnload);
    window.addEventListener("beforeunload", handleParentUnload);

    w.onbeforeunload = () => {
      onClose();
    };

    return () => {
      window.removeEventListener("unload", handleParentUnload);
      window.removeEventListener("beforeunload", handleParentUnload);
      window.clearInterval(checkClosed);

      // StrictMode dev: ignore first cleanup
      if (runId == 1 && effectRunIdRef.current === 2) return;

      // Close only if we created it
      if (createdByMeRef.current) {
        try {
          if (w && !w.closed) w.close();
        } catch {
          // ignore
        }
      }
    };
  }, [targetWindow, windowName, features, onClose, onBlock]);

  if (!container) return null;
  return createPortal(children, container);
};
