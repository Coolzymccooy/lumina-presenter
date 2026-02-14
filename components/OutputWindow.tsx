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
  const onCloseRef = useRef(onClose);
  const onBlockRef = useRef(onBlock);

  // React 18 StrictMode (dev): mount/cleanup/mount again.
  // Ignore the first cleanup so the popout doesn't close immediately.
  const effectRunIdRef = useRef(0);

  const targetWindow = useMemo(() => {
    if (externalWindow && !externalWindow.closed) return externalWindow;
    return null;
  }, [externalWindow]);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    onBlockRef.current = onBlock;
  }, [onBlock]);

  useEffect(() => {
    effectRunIdRef.current += 1;
    const runId = effectRunIdRef.current;

    let w: Window | null = null;
    const initialHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Lumina Output (Projector)</title>
    <style>
      body { margin: 0; padding: 0; background-color: black; overflow: hidden; }
      #output-root { width: 100vw; height: 100vh; }
    </style>
  </head>
  <body>
    <div id="output-root"></div>
  </body>
</html>`;

    if (targetWindow) {
      w = targetWindow;
      createdByMeRef.current = false;
    } else {
      // Open same-origin blank page to avoid blob: URLs in the address bar.
      w = winRef.current && !winRef.current.closed
          ? winRef.current
          : window.open("", windowName, features);
      
      createdByMeRef.current = true;
    }

    if (!w || w.closed || typeof w.closed === "undefined") {
      onBlockRef.current();
      return;
    }

    winRef.current = w;

    // Ensure host document exists, then inject React.
    const onWindowLoad = () => {
      if (!w || w.closed) return;

      if (!w.document.getElementById("output-root")) {
        try {
          w.document.open();
          w.document.write(initialHtml);
          w.document.close();
        } catch {
          // ignore
        }
      }
      
      // Ensure title is set again just in case
      w.document.title = "Lumina Output (Projector)";
      
      // Find the output root (create if needed)
      const div = w.document.getElementById("output-root");
      if (div) {
        setContainer(div);
      } else {
        // Fallback if shell write failed for some reason
        const newDiv = w.document.createElement("div");
        newDiv.id = "output-root";
        w.document.body.appendChild(newDiv);
        setContainer(newDiv);
      }

      // Copy styles (Vite dev injects <style> tags, Tailwind compiled CSS is <style>/<link>)
      const head = w.document.head;
      const markerName = "lumina-output-styles";
      
      if (!head.querySelector(`meta[name="${markerName}"]`)) {
        const marker = w.document.createElement("meta");
        marker.name = markerName;
        marker.content = "1";
        head.appendChild(marker);

        // Standard link tags
        Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')).forEach(
          (link) => {
            const newLink = w!.document.createElement("link");
            newLink.rel = "stylesheet";
            newLink.href = link.href;
            head.appendChild(newLink);
          }
        );

        // Style tags
        Array.from(document.querySelectorAll<HTMLStyleElement>("style")).forEach((style) => {
          const newStyle = w!.document.createElement("style");
          newStyle.textContent = style.textContent;
          head.appendChild(newStyle);
        });
        
        // Font imports (Google Fonts, etc.)
        Array.from(document.querySelectorAll<HTMLLinkElement>('link[href*="fonts.googleapis.com"]')).forEach(
          (link) => {
             const newLink = w!.document.createElement("link");
             newLink.rel = "stylesheet";
             newLink.href = link.href;
             head.appendChild(newLink);
          }
        );
      }
    };

    // If it's an existing window, it might already be loaded
    if (w.document.readyState === 'complete') {
        onWindowLoad();
    } else {
        w.addEventListener('load', onWindowLoad);
    }

    try {
      w.focus();
    } catch {
      // ignore
    }

    // Closed detection
    const checkClosed = window.setInterval(() => {
      if (w && w.closed) {
        onCloseRef.current();
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
      onCloseRef.current();
    };

    return () => {
      w?.removeEventListener('load', onWindowLoad); // Cleanup listener
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
  }, [targetWindow, windowName, features]);

  if (!container) return null;
  return createPortal(children, container);
};
