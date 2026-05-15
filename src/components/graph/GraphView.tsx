import React, { useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import SpriteText from 'three-spritetext';
import * as THREE from 'three';
import { HistoricalIncident } from '../../types/incident';

const LABEL_VISIBLE_DISTANCE = 160;

interface GraphViewProps {
  incidents: HistoricalIncident[];
  onNodeClick: (incident: HistoricalIncident) => void;
}

interface GraphNode {
  id: string;
  name: string;
  category: string;
  dynasty?: string;
  region?: string;
  startDate: string;
  incident: HistoricalIncident;
  val: number;
}

interface GraphLink {
  source: string;
  target: string;
}

const CATEGORY_COLOR: Record<string, string> = {
  political: '#3B82F6',
  religious: '#10B981',
  cultural: '#8B5CF6',
  scientific: '#F59E0B',
  military: '#EF4444',
};

const DEFAULT_COLOR = '#1B8A87';

export const GraphView: React.FC<GraphViewProps> = ({
  incidents,
  onNodeClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);
  const [size, setSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 384,
  });

  const data = useMemo(() => {
    const nodeIds = new Set(incidents.map((i) => i.id));
    const nodes: GraphNode[] = incidents.map((incident) => ({
      id: incident.id,
      name: incident.title,
      category: incident.category,
      dynasty: incident.dynasty,
      region: incident.region,
      startDate: incident.startDate,
      incident,
      val: Math.max(4, (incident.connections?.length ?? 0) * 3),
    }));

    const seen = new Set<string>();
    const links: GraphLink[] = [];
    incidents.forEach((incident) => {
      incident.connections.forEach((connectedId) => {
        if (!nodeIds.has(connectedId)) return;
        const key = [incident.id, connectedId].sort().join('::');
        if (seen.has(key)) return;
        seen.add(key);
        links.push({ source: incident.id, target: connectedId });
      });
    });

    return { nodes, links };
  }, [incidents]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      setSize({ width: el.clientWidth, height: el.clientHeight });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const g = graphRef.current;
    if (!g) return;
    g.cameraPosition({ x: 0, y: 0, z: 380 });
    const controls = g.controls() as {
      autoRotate?: boolean;
      autoRotateSpeed?: number;
      addEventListener?: (e: string, cb: () => void) => void;
      removeEventListener?: (e: string, cb: () => void) => void;
    };
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.6;

    const camera = g.camera() as THREE.PerspectiveCamera;
    const scene = g.scene() as THREE.Scene;
    const worldPos = new THREE.Vector3();

    const updateLabelVisibility = () => {
      scene.traverse((obj: THREE.Object3D) => {
        if (!obj.userData?.isNodeLabel) return;
        if (!obj.parent) return;
        obj.parent.getWorldPosition(worldPos);
        const distance = camera.position.distanceTo(worldPos);
        obj.visible = distance < LABEL_VISIBLE_DISTANCE;
      });
    };

    const handle = window.setInterval(updateLabelVisibility, 80);
    controls.addEventListener?.('change', updateLabelVisibility);
    updateLabelVisibility();

    return () => {
      window.clearInterval(handle);
      controls.removeEventListener?.('change', updateLabelVisibility);
    };
  }, [data]);

  return (
    <div className="bg-white rounded-lg shadow-md p-4 h-96 flex flex-col">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-2xl font-bold">Event Connections</h2>
        <span className="text-xs text-slate-500">
          drag to rotate · scroll to zoom · right-click to pan
        </span>
      </div>
      <div
        ref={containerRef}
        className="relative flex-1 rounded overflow-hidden bg-slate-900"
      >
        {size.width > 0 && (
          <ForceGraph3D
            ref={graphRef}
            width={size.width}
            height={size.height}
            graphData={data}
            backgroundColor="#0f172a"
            nodeLabel={(node: GraphNode) =>
              `<div style="background:#fff;color:#0f172a;padding:6px 10px;border-radius:6px;font-family:'Public Sans',sans-serif;font-size:12px;box-shadow:0 4px 12px rgba(0,0,0,0.2)">
                <div style="font-weight:600">${node.name}</div>
                <div style="color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:.06em;margin-top:2px">${node.category} · ${node.dynasty}</div>
              </div>`
            }
            nodeColor={(node: GraphNode) =>
              CATEGORY_COLOR[node.category] ?? DEFAULT_COLOR
            }
            nodeVal={(node: GraphNode) => node.val}
            nodeOpacity={0.95}
            nodeResolution={16}
            nodeThreeObjectExtend={true}
            nodeThreeObject={(node: GraphNode) => {
              const sprite = new SpriteText(node.name);
              sprite.color = '#ffffff';
              sprite.backgroundColor = 'rgba(15, 23, 42, 0.85)';
              sprite.padding = 3;
              sprite.borderRadius = 3;
              sprite.textHeight = 4;
              sprite.fontFace = 'Public Sans, sans-serif';
              sprite.fontWeight = '600';
              const radius = Math.cbrt(node.val) * 1.6 + 4;
              sprite.position.set(0, radius, 0);
              sprite.material.depthWrite = false;
              sprite.material.depthTest = false;
              sprite.renderOrder = 999;
              sprite.userData.isNodeLabel = true;
              sprite.visible = false;
              return sprite;
            }}
            linkColor={() => 'rgba(148, 163, 184, 0.55)'}
            linkWidth={0.6}
            linkOpacity={0.65}
            linkDirectionalParticles={2}
            linkDirectionalParticleSpeed={0.005}
            linkDirectionalParticleWidth={1.6}
            linkDirectionalParticleColor={() => '#2EB6B0'}
            enableNodeDrag={true}
            enableNavigationControls={true}
            showNavInfo={false}
            onNodeClick={(node: GraphNode) => {
              const g = graphRef.current;
              if (g && 'x' in node && 'y' in node && 'z' in node) {
                const n = node as unknown as { x: number; y: number; z: number };
                const distance = 120;
                const distRatio =
                  1 + distance / Math.hypot(n.x || 1, n.y || 1, n.z || 1);
                g.cameraPosition(
                  { x: n.x * distRatio, y: n.y * distRatio, z: n.z * distRatio },
                  n,
                  800
                );
              }
              onNodeClick(node.incident);
            }}
          />
        )}
      </div>
    </div>
  );
};
