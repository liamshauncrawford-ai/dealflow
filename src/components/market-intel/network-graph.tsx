"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";

// Dynamic import to avoid SSR issues with canvas
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false }) as any;

export interface NetworkNode {
  id: string;
  name: string;
  type: "gc" | "operator" | "target";
  val: number;
  color: string;
  tier?: string | null;
  priority?: string | null;
  relationshipStatus?: string | null;
  compositeScore?: number | null;
  // d3 adds these at runtime
  x?: number;
  y?: number;
}

export interface NetworkLink {
  source: string | NetworkNode;
  target: string | NetworkNode;
  type: "builds_for" | "qualified_sub" | "proximity";
  label?: string;
}

interface NetworkGraphProps {
  nodes: NetworkNode[];
  links: NetworkLink[];
  width: number;
  height: number;
  onNodeClick?: (node: NetworkNode) => void;
}

export function NetworkGraph({ nodes, links, width, height, onNodeClick }: NetworkGraphProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const nodeCanvasObject = useCallback(
    (node: NetworkNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const label = node.name;
      const fontSize = Math.max(10 / globalScale, 2);
      const radius = node.val / 2;
      const x = node.x ?? 0;
      const y = node.y ?? 0;

      // Draw circle
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = node.color;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 1.5 / globalScale;
      ctx.stroke();

      // Label
      if (globalScale > 0.6) {
        ctx.font = `${fontSize}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = "rgba(0,0,0,0.8)";
        const truncated = label.length > 20 ? label.slice(0, 18) + "..." : label;
        ctx.fillText(truncated, x, y + radius + 2 / globalScale);
      }
    },
    []
  );

  const linkCanvasObject = useCallback(
    (link: NetworkLink, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const source = link.source as NetworkNode;
      const target = link.target as NetworkNode;
      if (!source.x || !source.y || !target.x || !target.y) return;

      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);

      if (link.type === "builds_for") {
        ctx.strokeStyle = "rgba(59,130,246,0.4)";
        ctx.lineWidth = 1.5 / globalScale;
        ctx.setLineDash([]);
      } else if (link.type === "qualified_sub") {
        ctx.strokeStyle = "rgba(34,197,94,0.5)";
        ctx.lineWidth = 1.2 / globalScale;
        ctx.setLineDash([4 / globalScale, 3 / globalScale]);
      } else {
        ctx.strokeStyle = "rgba(156,163,175,0.3)";
        ctx.lineWidth = 0.8 / globalScale;
        ctx.setLineDash([2 / globalScale, 2 / globalScale]);
      }

      ctx.stroke();
      ctx.setLineDash([]);
    },
    []
  );

  if (!mounted) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border bg-muted/20"
        style={{ width, height }}
      >
        <p className="text-sm text-muted-foreground">Loading graph...</p>
      </div>
    );
  }

  return (
    <ForceGraph2D
      graphData={{ nodes, links }}
      width={width}
      height={height}
      nodeCanvasObject={nodeCanvasObject}
      linkCanvasObjectMode={() => "replace"}
      linkCanvasObject={linkCanvasObject}
      onNodeClick={(node: unknown) => onNodeClick?.(node as NetworkNode)}
      cooldownTicks={100}
      nodeRelSize={1}
      enableNodeDrag
      backgroundColor="transparent"
    />
  );
}
