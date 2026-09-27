import dagre from 'dagre';
import { MarkerType } from '@xyflow/react';

const NODE_WIDTH = 280;
const NODE_HEIGHT = 220;

/**
 * Computes automated topological layout for the organizational flowchart
 * @param {Object} db - The hierarchy database map keyed by user_id
 * @param {String} direction - 'TB' (Top-to-Bottom) or 'LR' (Left-to-Right)
 * @param {Object} callbacks - Node action callbacks
 */
export function getLayoutedElements(db, direction = 'TB', callbacks = {}) {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  dagreGraph.setGraph({
    rankdir: direction,
    ranksep: 90,
    nodesep: 50,
    marginx: 40,
    marginy: 40
  });

  const nodeIds = Object.keys(db);
  const nodes = [];
  const edges = [];
  const edgeSet = new Set();

  // Add all person nodes to Dagre graph
  nodeIds.forEach((userId) => {
    const person = db[userId];
    dagreGraph.setNode(userId, { width: NODE_WIDTH, height: NODE_HEIGHT });

    nodes.push({
      id: userId,
      type: 'employeeNode',
      data: {
        person,
        ...callbacks
      },
      position: { x: 0, y: 0 }
    });

    // Create edges for Senior -> Junior
    // (Senior is the manager, Junior is the subordinate reporting under)
    if (person.junior_ids && person.junior_ids.length > 0) {
      person.junior_ids.forEach((jId) => {
        if (db[jId]) {
          const edgeId = `edge-${userId}-${jId}`;
          if (!edgeSet.has(edgeId)) {
            edgeSet.add(edgeId);
            dagreGraph.setEdge(userId, jId);
            edges.push({
              id: edgeId,
              source: userId,
              target: jId,
              type: 'smoothstep',
              animated: true,
              style: { stroke: '#4F46E5', strokeWidth: 2 },
              markerEnd: {
                type: MarkerType.ArrowClosed,
                width: 18,
                height: 18,
                color: '#4F46E5'
              }
            });
          }
        }
      });
    }

    // Also support checking senior_ids to ensure all links are captured
    if (person.senior_ids && person.senior_ids.length > 0) {
      person.senior_ids.forEach((sId) => {
        if (db[sId]) {
          const edgeId = `edge-${sId}-${userId}`;
          if (!edgeSet.has(edgeId)) {
            edgeSet.add(edgeId);
            dagreGraph.setEdge(sId, userId);
            edges.push({
              id: edgeId,
              source: sId,
              target: userId,
              type: 'smoothstep',
              animated: true,
              style: { stroke: '#4F46E5', strokeWidth: 2 },
              markerEnd: {
                type: MarkerType.ArrowClosed,
                width: 18,
                height: 18,
                color: '#4F46E5'
              }
            });
          }
        }
      });
    }
  });

  // Calculate layout coordinates
  dagre.layout(dagreGraph);

  // Apply calculated coordinates back to nodes
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2
      }
    };
  });

  return { nodes: layoutedNodes, edges };
}
