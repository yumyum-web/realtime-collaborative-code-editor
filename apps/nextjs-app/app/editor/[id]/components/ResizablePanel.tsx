import React, { useRef, useState, useCallback, useEffect } from "react";

interface ResizablePanelProps {
  children: React.ReactNode;
  isOpen: boolean;
  minWidth?: number;
  maxWidth?: number;
  defaultWidth?: number;
  side?: "left" | "right";
  storageKey?: string;
  onWidthChange?: (width: number) => void;
}

export function ResizablePanel({
  children,
  isOpen,
  minWidth = 280,
  maxWidth = 600,
  defaultWidth = 320,
  side = "right",
  storageKey,
  onWidthChange,
}: ResizablePanelProps) {
  const [width, setWidth] = useState(defaultWidth);
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Load saved width from localStorage
  useEffect(() => {
    if (storageKey) {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsedWidth = parseInt(saved, 10);
        if (parsedWidth >= minWidth && parsedWidth <= maxWidth) {
          setWidth(parsedWidth);
          if (onWidthChange) {
            onWidthChange(parsedWidth);
          }
        }
      }
    }
  }, [storageKey, minWidth, maxWidth, onWidthChange]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return;

      const newWidth =
        side === "right" ? window.innerWidth - e.clientX : e.clientX;

      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setWidth(newWidth);
        if (storageKey) {
          localStorage.setItem(storageKey, newWidth.toString());
        }
        if (onWidthChange) {
          onWidthChange(newWidth);
        }
      }
    },
    [isResizing, minWidth, maxWidth, side, storageKey, onWidthChange],
  );

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "ew-resize";
      document.body.style.userSelect = "none";

      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  // Notify parent when panel opens with current width
  useEffect(() => {
    if (isOpen && onWidthChange) {
      onWidthChange(width);
    }
  }, [isOpen, width, onWidthChange]);

  if (!isOpen) return null;

  return (
    <aside
      ref={panelRef}
      className="bg-sidebar border-l border-gray-700 flex flex-col transition-all duration-300 ease-in-out relative"
      style={{
        width: `${width}px`,
        minWidth: `${minWidth}px`,
        maxWidth: `${maxWidth}px`,
      }}
    >
      {/* Resize Handle */}
      <div
        onMouseDown={handleMouseDown}
        className={`absolute ${side === "right" ? "left-0" : "right-0"} top-0 w-1 h-full cursor-ew-resize hover:bg-blue-500 active:bg-blue-600 transition-colors z-50 group`}
        style={{ touchAction: "none" }}
      >
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-6 h-12 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-1 h-8 bg-blue-500 rounded-full"></div>
        </div>
      </div>

      {children}
    </aside>
  );
}
