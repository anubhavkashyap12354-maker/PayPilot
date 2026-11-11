"use client";

import React, { useEffect, useRef, useState } from "react";

interface PixelTrailProps {
  cellSize?: number;
  gridGap?: number;
  decay?: number;
  className?: string;
  isContainerRelative?: boolean;
}

interface CellData {
  col: number;
  row: number;
  heat: number;
}

export const PixelTrail: React.FC<PixelTrailProps> = ({
  cellSize = 20,
  gridGap = 2,
  decay = 0.94,
  className = "",
  isContainerRelative = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isSupported, setIsSupported] = useState<boolean>(false);

  useEffect(() => {
    // 1. Accessibility & Device Capability Check
    if (typeof window === "undefined") return;

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const hoverFinePointerQuery = window.matchMedia("(hover: hover) and (pointer: fine)");

    const evaluateSupport = () => {
      const prefersReducedMotion = reducedMotionQuery.matches;
      const hasFineHoverPointer = hoverFinePointerQuery.matches;
      // Never mount if reduced motion is enabled or device is touch/coarse
      const supported = !prefersReducedMotion && hasFineHoverPointer;
      setIsSupported(supported);
      return supported;
    };

    const initialSupported = evaluateSupport();

    // Listen for media query changes (e.g. user toggles reduced motion or docks device)
    const handleMotionChange = () => evaluateSupport();
    const handlePointerChange = () => evaluateSupport();

    try {
      reducedMotionQuery.addEventListener("change", handleMotionChange);
      hoverFinePointerQuery.addEventListener("change", handlePointerChange);
    } catch {
      // Fallback for older browsers
      reducedMotionQuery.addListener(handleMotionChange);
      hoverFinePointerQuery.addListener(handlePointerChange);
    }

    if (!initialSupported) {
      return () => {
        try {
          reducedMotionQuery.removeEventListener("change", handleMotionChange);
          hoverFinePointerQuery.removeEventListener("change", handlePointerChange);
        } catch {
          reducedMotionQuery.removeListener(handleMotionChange);
          hoverFinePointerQuery.removeListener(handlePointerChange);
        }
      };
    }

    return () => {
      try {
        reducedMotionQuery.removeEventListener("change", handleMotionChange);
        hoverFinePointerQuery.removeEventListener("change", handlePointerChange);
      } catch {
        reducedMotionQuery.removeListener(handleMotionChange);
        hoverFinePointerQuery.removeListener(handlePointerChange);
      }
    };
  }, []);

  useEffect(() => {
    if (!isSupported) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    // Step distance between cells = cellSize + gridGap
    const step = cellSize + gridGap;

    // Storage for active glowing cells: Map<string, CellData>
    const activeCells = new Map<string, CellData>();

    let animationFrameId: number | null = null;
    let lastX: number | null = null;
    let lastY: number | null = null;
    let isHoveringInteractive = false;
    let dpr = 1;

    // Function to resize canvas correctly with devicePixelRatio capped at 2
    const resizeCanvas = () => {
      if (!canvas) return;
      const rect = isContainerRelative && canvas.parentElement
        ? canvas.parentElement.getBoundingClientRect()
        : { width: window.innerWidth, height: window.innerHeight };

      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));

      dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      // Scale context so drawing uses CSS pixels
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };

    resizeCanvas();

    let resizeObserver: ResizeObserver | null = null;
    if (isContainerRelative && canvas.parentElement && typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => resizeCanvas());
      resizeObserver.observe(canvas.parentElement);
    } else {
      window.addEventListener("resize", resizeCanvas, { passive: true });
    }

    // Convert pixel coordinates to cell grid index
    const getCellCoords = (x: number, y: number) => {
      const col = Math.floor(x / step);
      const row = Math.floor(y / step);
      return { col, row };
    };

    // Ignite a cell to full heat
    const igniteCell = (col: number, row: number, boost: number = 1.0) => {
      const key = `${col},${row}`;
      const existing = activeCells.get(key);
      const newHeat = existing ? Math.min(1.0, existing.heat + 0.45 * boost) : boost;
      activeCells.set(key, { col, row, heat: newHeat });
    };

    // Interpolate pointer trail to eliminate gaps during fast motion
    const handlePointerMove = (e: PointerEvent | MouseEvent) => {
      let currentX = e.clientX;
      let currentY = e.clientY;

      if (isContainerRelative && canvas.parentElement) {
        const bounds = canvas.parentElement.getBoundingClientRect();
        currentX = e.clientX - bounds.left;
        currentY = e.clientY - bounds.top;
      }

      // Check if hovering over an interactive element (a, button, input)
      const target = e.target as HTMLElement | null;
      isHoveringInteractive = !!(target && target.closest && target.closest("a, button, input, [role='button']"));

      const boost = isHoveringInteractive ? 1.0 : 0.85;

      if (lastX === null || lastY === null) {
        const { col, row } = getCellCoords(currentX, currentY);
        igniteCell(col, row, boost);
      } else {
        const dx = currentX - lastX;
        const dy = currentY - lastY;
        const dist = Math.hypot(dx, dy);

        // Interpolation step along distance
        const interpolationStep = Math.max(4, step / 3);
        const steps = Math.ceil(dist / interpolationStep);

        for (let i = 0; i <= steps; i++) {
          const t = steps === 0 ? 1 : i / steps;
          const ix = lastX + dx * t;
          const iy = lastY + dy * t;
          const { col, row } = getCellCoords(ix, iy);
          igniteCell(col, row, boost);
        }
      }

      lastX = currentX;
      lastY = currentY;
    };

    const handlePointerLeave = () => {
      lastX = null;
      lastY = null;
    };

    // Attach pointer listeners to window or container
    const eventTarget = isContainerRelative && canvas.parentElement ? canvas.parentElement : window;
    eventTarget.addEventListener("pointermove", handlePointerMove as EventListener, { passive: true });
    eventTarget.addEventListener("pointerleave", handlePointerLeave as EventListener, { passive: true });

    // Single requestAnimationFrame animation loop
    const render = () => {
      const width = isContainerRelative && canvas.parentElement
        ? canvas.parentElement.clientWidth
        : window.innerWidth;
      const height = isContainerRelative && canvas.parentElement
        ? canvas.parentElement.clientHeight
        : window.innerHeight;

      // Clear the canvas in CSS pixel coordinate space
      ctx.clearRect(0, 0, width, height);

      if (activeCells.size > 0) {
        ctx.save();
        // Additive visual blending as specified
        ctx.globalCompositeOperation = "lighter";

        for (const [key, cell] of activeCells.entries()) {
          // Decay heat
          cell.heat *= decay;

          // Remove negligible heat cells (< 0.012)
          if (cell.heat < 0.012) {
            activeCells.delete(key);
            continue;
          }

          const x = cell.col * step;
          const y = cell.row * step;

          // Create white-to-blue gradient (#FFFFFF -> #5B9BF6 at 90 degrees)
          // 90 deg = top to bottom or left to right; vertical gradient along cell height
          const grad = ctx.createLinearGradient(x, y, x, y + cellSize);
          // White highlight transitioning to bright electric blue
          grad.addColorStop(0, `rgba(255, 255, 255, ${0.85 * cell.heat})`);
          grad.addColorStop(1, `rgba(91, 155, 246, ${0.9 * cell.heat})`);

          ctx.fillStyle = grad;

          // Render square cell
          ctx.fillRect(x, y, cellSize, cellSize);

          // Subtle luminous inner border
          ctx.strokeStyle = `rgba(147, 197, 253, ${0.4 * cell.heat})`;
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 0.5, y + 0.5, cellSize - 1, cellSize - 1);
        }

        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    // Start single loop
    animationFrameId = requestAnimationFrame(render);

    // Teardown cleanup
    return () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
      eventTarget.removeEventListener("pointermove", handlePointerMove as EventListener);
      eventTarget.removeEventListener("pointerleave", handlePointerLeave as EventListener);

      if (resizeObserver) {
        resizeObserver.disconnect();
      } else {
        window.removeEventListener("resize", resizeCanvas);
      }

      activeCells.clear();
    };
  }, [isSupported, cellSize, gridGap, decay, isContainerRelative]);

  // If accessibility disabled or touch/coarse, do not render canvas
  if (!isSupported) {
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`${
        isContainerRelative
          ? "absolute inset-0 pointer-events-none z-10"
          : "fixed inset-0 pointer-events-none z-30"
      } ${className}`}
      style={{
        pointerEvents: "none",
        userSelect: "none",
      }}
    />
  );
};

export default PixelTrail;
