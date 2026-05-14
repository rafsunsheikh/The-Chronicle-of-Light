import React, { useEffect, useCallback, useState } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  Controls,
  Background,
} from '@xyflow/react';
import { HistoricalIncident } from '../../types/incident';
import '@xyflow/react/dist/style.css';

interface GraphViewProps {
  incidents: HistoricalIncident[];
  onNodeClick: (incident: HistoricalIncident) => void;
}

interface IncidentNodeData {
  label: string;
  incident: HistoricalIncident;
  [key: string]: any;
}

interface IncidentEdgeData {
  [key: string]: any;
}

const nodeStyleMap: Record<string, React.CSSProperties> = {
  political: { backgroundColor: '#3b82f6', color: 'white' },
  religious: { backgroundColor: '#22c55e', color: 'white' },
  cultural: { backgroundColor: '#a855f7', color: 'white' },
  scientific: { backgroundColor: '#eab308', color: 'black' },
  military: { backgroundColor: '#ef4444', color: 'white' },
};

export const GraphView: React.FC<GraphViewProps> = ({
  incidents,
  onNodeClick,
}) => {
  const [nodes, setNodes] = useState<Node<IncidentNodeData>[]>([]);
  const [edges, setEdges] = useState<Edge<IncidentEdgeData>[]>([]);

  const onNodesChange = useCallback(() => {}, []);
  const onEdgesChange = useCallback(() => {}, []);

  useEffect(() => {
    if (incidents.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const graphNodes: Node<IncidentNodeData>[] = incidents.map((incident) => ({
      id: incident.id,
      type: 'default',
      position: { x: 0, y: 0 },
      data: {
        label: incident.title,
        incident: incident,
      },
      style: {
        ...nodeStyleMap[incident.category],
        padding: '10px',
        borderRadius: '8px',
        width: '200px',
      },
    }));

    const graphEdges: Edge<IncidentEdgeData>[] = [];
    incidents.forEach((incident) => {
      incident.connections.forEach((connectedId) => {
        graphEdges.push({
          id: `${incident.id}-${connectedId}`,
          source: incident.id,
          target: connectedId,
          animated: true,
          style: { stroke: '#666', strokeWidth: 2 },
        });
      });
    });

    setNodes(graphNodes);
    setEdges(graphEdges);
  }, [incidents]);

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node<IncidentNodeData>) => {
      const incident = node.data.incident;
      onNodeClick(incident);
    },
    [onNodeClick]
  );

  return (
    <div className="bg-white rounded-lg shadow-md p-4 h-96">
      <h2 className="text-2xl font-bold mb-4">Event Connections</h2>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        fitView
      >
        <Controls />
        <Background />
      </ReactFlow>
    </div>
  );
};
