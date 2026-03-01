import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface OutputWindowProps {
  onClose: () => void;
  onBlock: () => void;
  children: React.ReactNode;
  title?: string;

  /**
   * Pass the Window you opened synchronously inside the Launch Output click.
   * This avoids popup blockers.
   */
  externalWindow?: Window | null;

  /** Optional fallback if externalWindow is not provided. */
  windowName?: string;
  features?: string;
}

/**
 * Projector popout window.
 * - Copies styles into the new window so Tailwind/Vite injected CSS works.
 * - Handles React 18 StrictMode double-invocation (dev) so the popout does not close immediately.
 */
export const OutputWindow: React.FC<OutputWindowProps> = ({
  onClose,
  onBlock,
  children,
  title = "Lumina Output (Projector)",
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
  // Ignore the first cleanup so the popout does not close immediately.
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
    <title>${title}</title>
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
      // Use about:blank so a reused named window is always navigated back to same-origin.
      w = winRef.current && !winRef.current.closed
        ? winRef.current
        : window.open("about:blank", windowName, features);
      createdByMeRef.current = true;
    }

    if (!w || w.closed || typeof w.closed === "undefined") {
      onBlockRef.current();
      return;
    }

    winRef.current = w;

    let mountRetryTimer: number | null = null;
    let mountAttempts = 0;
    const maxMountAttempts = 30;

    const stopRetries = () => {
      if (mountRetryTimer !== null) {
        window.clearInterval(mountRetryTimer);
        mountRetryTimer = null;
      }
    };

    const copyStyles = (hostDocument: Document) => {
      const head = hostDocument.head;
      if (!head) return;
      const markerName = "lumina-output-styles";
      if (head.querySelector(`meta[name="${markerName}"]`)) return;

      const marker = hostDocument.createElement("meta");
      marker.name = markerName;
      marker.content = "1";
      head.appendChild(marker);

      Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')).forEach((link) => {
        const newLink = hostDocument.createElement("link");
        newLink.rel = "stylesheet";
        newLink.href = link.href;
        if (link.crossOrigin) newLink.crossOrigin = link.crossOrigin;
        head.appendChild(newLink);
      });

      Array.from(document.querySelectorAll<HTMLStyleElement>("style")).forEach((style) => {
        const newStyle = hostDocument.createElement("style");
        newStyle.textContent = style.textContent;
        head.appendChild(newStyle);
      });

      Array.from(document.querySelectorAll<HTMLLinkElement>('link[href*="fonts.googleapis.com"]')).forEach((link) => {
        const newLink = hostDocument.createElement("link");
        newLink.rel = "stylesheet";
        newLink.href = link.href;
        head.appendChild(newLink);
      });

      // Fallback: inline same-origin CSS rules so popup can still render if linked CSS fails to load.
      const inlineCss = hostDocument.createElement("style");
      inlineCss.setAttribute("data-lumina-inline-css", "1");
      const cssText: string[] = [];
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          const rules = (sheet as CSSStyleSheet).cssRules;
          if (!rules) continue;
          for (const rule of Array.from(rules)) {
            cssText.push(rule.cssText);
          }
        } catch {
          // Cross-origin stylesheets may block cssRules access; skip those.
        }
      }
      inlineCss.textContent = cssText.join("\n");
      head.appendChild(inlineCss);

      // Safety baseline so the host never appears as a blank black page.
      const baseline = hostDocument.createElement("style");
      baseline.setAttribute("data-lumina-baseline", "1");
      baseline.textContent = `
        html, body, #output-root {
          margin: 0;
          width: 100%;
          height: 100%;
          background: #000;
        }
      `;
      head.appendChild(baseline);
    };

    const ensureHostReady = () => {
      if (!w || w.closed) return false;
      try {
        const hostDocument = w.document;

        if (!hostDocument.getElementById("output-root")) {
          if (hostDocument.body) {
            const div = hostDocument.createElement("div");
            div.id = "output-root";
            div.style.width = "100vw";
            div.style.height = "100vh";
            hostDocument.body.appendChild(div);
          } else {
            hostDocument.open();
            hostDocument.write(initialHtml);
            hostDocument.close();
          }
        }

        hostDocument.title = title;
        const div = hostDocument.getElementById("output-root");
        if (!div) return false;
        div.style.width = "100vw";
        div.style.height = "100vh";
        div.style.background = "black";

        setContainer((prev) => (prev === div ? prev : div));
        copyStyles(hostDocument);
        return true;
      } catch {
        return false;
      }
    };

    const startRetries = () => {
      if (mountRetryTimer !== null) return;
      mountRetryTimer = window.setInterval(() => {
        mountAttempts += 1;
        if (ensureHostReady()) {
          stopRetries();
          return;
        }
        if (mountAttempts >= maxMountAttempts) {
          stopRetries();
          onBlockRef.current();
        }
      }, 100);
    };

    const onWindowLoad = () => {
      if (ensureHostReady()) {
        stopRetries();
        return;
      }
      startRetries();
    };

    if (!ensureHostReady()) {
      w.addEventListener("load", onWindowLoad);
      startRetries();
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

    return () => {
      stopRetries();
      w?.removeEventListener("load", onWindowLoad);
      window.removeEventListener("unload", handleParentUnload);
      window.removeEventListener("beforeunload", handleParentUnload);
      window.clearInterval(checkClosed);
      try {
        if (w) w.onbeforeunload = null;
      } catch {
        // ignore
      }

      // StrictMode dev: ignore first cleanup
      if (runId === 1 && effectRunIdRef.current === 2) return;

      // Close only if we created it
      if (createdByMeRef.current) {
        try {
          if (w && !w.closed) w.close();
        } catch {
          // ignore
        }
      }
    };
  }, [targetWindow, windowName, features, title]);

  if (!container) return null;
  return createPortal(children, container);
};
