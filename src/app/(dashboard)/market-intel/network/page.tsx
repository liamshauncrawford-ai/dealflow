"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Network, AlertTriangle, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  NetworkGraph,
  type NetworkNode,
  type NetworkLink,
} from "@/components/market-intel/network-graph";
import { GC_RELATIONSHIP_STATUS } from "@/lib/market-intel-constants";

interface RelationshipGap {
  gcId: string;
  gcName: string;
  priority: string | null;
  facilityCount: number;
  hasQualifiedSub: boolean;
}

interface NetworkData {
  nodes: NetworkNode[];
  links: NetworkLink[];
  gaps: RelationshipGap[];
}

export default function NetworkPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });
  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);

  const { data, isLoading } = useQuery<NetworkData>({
    queryKey: ["network-graph"],
    queryFn: async () => {
      const res = await fetch("/api/market-intel/network");
      if (!res.ok) throw new Error("Failed to fetch network data");
      return res.json();
    },
  });

  // Measure container for responsive sizing
  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: rect.width,
          height: Math.max(500, window.innerHeight - 400),
        });
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const nodes = data?.nodes ?? [];
  const links = data?.links ?? [];
  const gaps = data?.gaps ?? [];

  const gcCount = nodes.filter((n) => n.type === "gc").length;
  const opCount = nodes.filter((n) => n.type === "operator").length;
  const targetCount = nodes.filter((n) => n.type === "target").length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Network className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-2xl font-bold tracking-tight">Relationship Network</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          GC-operator-target relationships and sub-qualification gaps
        </p>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-blue-500" />
          {gcCount} GCs
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-orange-500" />
          {opCount} Operators
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-violet-500" />
          {targetCount} Targets
        </span>
        {gaps.length > 0 && (
          <span className="flex items-center gap-1.5 text-amber-600">
            <AlertTriangle className="h-3.5 w-3.5" />
            {gaps.length} gaps
          </span>
        )}
      </div>

      {/* Graph + Detail panel */}
      <div className="flex gap-4">
        <div ref={containerRef} className="flex-1 rounded-lg border bg-background">
          {isLoading ? (
            <div className="flex items-center justify-center" style={{ height: dimensions.height }}>
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
            </div>
          ) : (
            <NetworkGraph
              nodes={nodes}
              links={links}
              width={dimensions.width - (selectedNode ? 320 : 0)}
              height={dimensions.height}
              onNodeClick={setSelectedNode}
            />
          )}
        </div>

        {/* Selected node detail */}
        {selectedNode && (
          <Card className="w-80 shrink-0">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{selectedNode.name}</CardTitle>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="rounded p-1 hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <span
                className="inline-flex w-fit rounded-full px-2 py-0.5 text-xs font-medium text-white"
                style={{ backgroundColor: selectedNode.color }}
              >
                {selectedNode.type.toUpperCase()}
              </span>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {selectedNode.type === "gc" && (
                <>
                  {selectedNode.priority && (
                    <div>
                      <span className="text-muted-foreground">Priority:</span>{" "}
                      {selectedNode.priority}
                    </div>
                  )}
                  {selectedNode.relationshipStatus && (
                    <div>
                      <span className="text-muted-foreground">Relationship:</span>{" "}
                      {GC_RELATIONSHIP_STATUS[selectedNode.relationshipStatus as keyof typeof GC_RELATIONSHIP_STATUS]?.label ??
                        selectedNode.relationshipStatus}
                    </div>
                  )}
                </>
              )}
              {selectedNode.type === "operator" && selectedNode.tier && (
                <div>
                  <span className="text-muted-foreground">Tier:</span>{" "}
                  {selectedNode.tier.replace(/_/g, " ")}
                </div>
              )}
              {selectedNode.type === "target" && selectedNode.compositeScore != null && (
                <div>
                  <span className="text-muted-foreground">Score:</span>{" "}
                  {selectedNode.compositeScore}
                </div>
              )}
              {/* Connections */}
              <div>
                <span className="text-muted-foreground">Connections:</span>{" "}
                {links.filter(
                  (l) =>
                    (typeof l.source === "string" ? l.source : (l.source as NetworkNode).id) === selectedNode.id ||
                    (typeof l.target === "string" ? l.target : (l.target as NetworkNode).id) === selectedNode.id
                ).length}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Relationship Gaps table */}
      {gaps.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Relationship Gaps
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium">GC Name</th>
                    <th className="pb-2 font-medium">Priority</th>
                    <th className="pb-2 text-right font-medium">Facilities</th>
                    <th className="pb-2 text-right font-medium">Qualified Sub?</th>
                  </tr>
                </thead>
                <tbody>
                  {gaps.map((g) => (
                    <tr key={g.gcId} className="border-b last:border-0">
                      <td className="py-2 font-medium">{g.gcName}</td>
                      <td className="py-2">{g.priority ?? "—"}</td>
                      <td className="py-2 text-right tabular-nums">{g.facilityCount}</td>
                      <td className="py-2 text-right">
                        <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
                          No
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
