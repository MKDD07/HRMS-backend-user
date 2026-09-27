import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import {
  Maximize2,
  Minimize2,
  RefreshCw,
  ArrowDown,
  ArrowRight,
  GitBranch,
  Shield,
  HelpCircle,
  Move,
  Plus
} from 'lucide-react';
import { EmployeeFlowNode } from './EmployeeFlowNode';
import { getLayoutedElements } from '../../lib/flowchartLayout';
import {
  addSeniorToUser,
  addJuniorToUser,
  removeSeniorFromUser
} from '../../lib/hierarchyDatabase';

const nodeTypes = {
  employeeNode: EmployeeFlowNode
};

export function OrgFlowchartCanvas({
  db,
  onUpdateDb,
  onRemovePerson,
  onAddPersonToCanvas,
  onSelectEmployee,
  onOpenAddSeniorModal,
  onOpenAddJuniorModal,
  onOpenEditTitleModal,
  onShowToast
}) {
  const [direction, setDirection] = useState('TB'); // 'TB' or 'LR'
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const reactFlowWrapper = useRef(null);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);

  // Callbacks passed to individual nodes
  const nodeCallbacks = useMemo(
    () => ({
      onAddSenior: onOpenAddSeniorModal,
      onAddJunior: onOpenAddJuniorModal,
      onEditTitle: onOpenEditTitleModal,
      onRemovePerson,
      onSelectEmployee,
      onDropPersonOnNode: (sourceUserId, targetUserId, role) => {
        if (!sourceUserId || sourceUserId === targetUserId) return;

        // If sourceUserId is not in db (i.e. from available roster on right), add them first
        if (!db[sourceUserId] && onAddPersonToCanvas) {
          onAddPersonToCanvas(sourceUserId);
        }

        if (role === 'senior') {
          const res = addSeniorToUser(targetUserId, sourceUserId);
          if (!res.success) {
            onShowToast?.({
              type: 'error',
              title: 'Senior Assignment Failed',
              message: res.reason
            });
            return;
          }
          onUpdateDb(res.db);
          onShowToast?.({
            type: 'success',
            title: 'Senior Attached',
            message: `${res.db[sourceUserId]?.name || sourceUserId} is now a Senior to ${res.db[targetUserId]?.name || targetUserId}.`
          });
        } else if (role === 'junior') {
          const res = addJuniorToUser(targetUserId, sourceUserId);
          if (!res.success) {
            onShowToast?.({
              type: 'error',
              title: 'Junior Assignment Failed',
              message: res.reason
            });
            return;
          }
          onUpdateDb(res.db);
          onShowToast?.({
            type: 'success',
            title: 'Junior Attached',
            message: `${res.db[sourceUserId]?.name || sourceUserId} reports under ${res.db[targetUserId]?.name || targetUserId}.`
          });
        }
      }
    }),
    [
      db,
      onOpenAddSeniorModal,
      onOpenAddJuniorModal,
      onOpenEditTitleModal,
      onRemovePerson,
      onAddPersonToCanvas,
      onSelectEmployee,
      onUpdateDb,
      onShowToast
    ]
  );

  // Recompute Dagre Layout
  const applyLayout = useCallback(
    (currentDb, dir = direction) => {
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        currentDb,
        dir,
        nodeCallbacks
      );
      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
    },
    [direction, nodeCallbacks, setNodes, setEdges]
  );

  // Sync when database or callbacks change
  useEffect(() => {
    if (db && Object.keys(db).length > 0) {
      applyLayout(db, direction);
    }
  }, [db, direction, applyLayout]);

  // Handle interactive manual connection drag between nodes
  const onConnect = useCallback(
    (params) => {
      const seniorId = params.source;
      const juniorId = params.target;

      if (!seniorId || !juniorId || seniorId === juniorId) return;

      // Add seniorId as senior to juniorId
      const res = addSeniorToUser(juniorId, seniorId);
      if (!res.success) {
        onShowToast?.({
          type: 'error',
          title: 'Connection Denied',
          message: res.reason
        });
        return;
      }

      onUpdateDb(res.db);
      onShowToast?.({
        type: 'success',
        title: 'Reporting Edge Created',
        message: `${res.db[juniorId]?.name || juniorId} now reports under ${res.db[seniorId]?.name || seniorId}.`
      });
    },
    [onUpdateDb, onShowToast]
  );

  // Handle clicking on an edge to delete the reporting link
  const onEdgeClick = useCallback(
    (event, edge) => {
      event.stopPropagation();
      const seniorId = edge.source;
      const juniorId = edge.target;
      const seniorName = db[seniorId]?.name || seniorId;
      const juniorName = db[juniorId]?.name || juniorId;

      if (
        window.confirm(
          `Remove reporting connection? \n\n${juniorName} will no longer report under ${seniorName}.`
        )
      ) {
        const updated = removeSeniorFromUser(juniorId, seniorId);
        onUpdateDb(updated);
        onShowToast?.({
          type: 'info',
          title: 'Reporting Link Removed',
          message: `Severed connection between ${seniorName} and ${juniorName}.`
        });
      }
    },
    [db, onUpdateDb, onShowToast]
  );

  // Handle Drag Over Canvas
  const onDragOverCanvas = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // Handle Drop onto Canvas background to position a card
  const onDropCanvas = useCallback(
    (event) => {
      event.preventDefault();
      const userId = event.dataTransfer.getData('text/plain');
      if (!userId || !reactFlowInstance) return;

      // If user is dragged from unassigned right column roster, add them to the canvas
      if (!db[userId]) {
        if (onAddPersonToCanvas) {
          onAddPersonToCanvas(userId);
        }
        return;
      }

      const flowBounds = reactFlowWrapper.current?.getBoundingClientRect();
      if (!flowBounds) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY
      });

      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === userId) {
            return {
              ...node,
              position: {
                x: position.x - 140,
                y: position.y - 110
              }
            };
          }
          return node;
        })
      );

      onShowToast?.({
        type: 'info',
        title: 'Node Positioned',
        message: `Placed ${db[userId].name} onto flowchart canvas.`
      });
    },
    [db, reactFlowInstance, onAddPersonToCanvas, onShowToast, setNodes]
  );

  // Toggle layout direction
  const handleToggleDirection = (newDir) => {
    setDirection(newDir);
    applyLayout(db, newDir);
  };

  return (
    <div
      ref={reactFlowWrapper}
      className="w-full h-[720px] bg-[#F8FAFC] rounded-2xl border border-[#E2E8F0] relative overflow-hidden shadow-inner"
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgeClick={onEdgeClick}
        onInit={setReactFlowInstance}
        onDragOver={onDragOverCanvas}
        onDrop={onDropCanvas}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.2}
        maxZoom={1.6}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#4F46E5', strokeWidth: 2 }
        }}
      >
        <Background color="#CBD5E1" gap={20} size={1.5} />
        <Controls position="bottom-left" className="bg-white rounded-xl shadow-md border border-[#E2E8F0]" />
        <MiniMap
          position="bottom-right"
          nodeColor={(node) => {
            const person = node.data?.person;
            if (person?.stage === 1) return '#A855F7';
            if (person?.stage === 2) return '#3B82F6';
            if (person?.stage === 3) return '#10B981';
            if (person?.stage === 4) return '#F59E0B';
            return '#64748B';
          }}
          className="rounded-xl border border-[#E2E8F0] shadow-md overflow-hidden bg-white/90"
        />

        {/* Top Control Panel */}
        <Panel position="top-left" className="m-3">
          <div className="flex flex-wrap items-center gap-2 bg-white/95 backdrop-blur-xs p-2 rounded-xl border border-[#E2E8F0] shadow-sm">
            {/* Auto-Organize Flow Chart */}
            <button
              type="button"
              onClick={() => applyLayout(db, direction)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-semibold bg-[#EEF2FF] text-[#4F46E5] hover:bg-[#E0E7FF] rounded-lg transition-colors border border-[#C7D2FE]"
              title="Automatically organize and align all nodes using Dagre hierarchical graph algorithm"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Auto-Align Flow Chart
            </button>

            {/* Direction Toggle */}
            <div className="flex items-center bg-[#F1F5F9] p-0.5 rounded-lg border border-[#E2E8F0]">
              <button
                type="button"
                onClick={() => handleToggleDirection('TB')}
                className={`flex items-center gap-1 px-2.5 py-1 text-[13px] font-medium rounded-md transition-all ${direction === 'TB'
                    ? 'bg-white text-[#0F172A] shadow-xs font-semibold'
                    : 'text-[#64748B]'
                  }`}
                title="Top to Bottom Flow"
              >
                <ArrowDown className="w-3 h-3" />
                Top-Down
              </button>
              <button
                type="button"
                onClick={() => handleToggleDirection('LR')}
                className={`flex items-center gap-1 px-2.5 py-1 text-[13px] font-medium rounded-md transition-all ${direction === 'LR'
                    ? 'bg-white text-[#0F172A] shadow-xs font-semibold'
                    : 'text-[#64748B]'
                  }`}
                title="Left to Right Flow"
              >
                <ArrowRight className="w-3 h-3" />
                Left-Right
              </button>
            </div>

            {/* Fit View */}
            <button
              type="button"
              onClick={() => reactFlowInstance?.fitView({ padding: 0.2, duration: 400 })}
              className="flex items-center gap-1 px-2.5 py-1.5 text-[13px] font-medium text-[#475569] hover:bg-[#F1F5F9] rounded-lg border border-[#E2E8F0]"
            >
              Fit View
            </button>
          </div>
        </Panel>

        {/* Top-Right Legend Panel */}
        <Panel position="top-right" className="m-3">
          <div className="bg-white/95 backdrop-blur-xs p-3 rounded-xl border border-[#E2E8F0] shadow-sm text-[13px] space-y-1.5 max-w-[260px]">
            <div className="flex items-center gap-1.5 font-bold text-[#1E293B]">
              <GitBranch className="w-3.5 h-3.5 text-[#4F46E5]" />
              <span>Interactive Flow Chart Guide</span>
            </div>
            <p className="text-[11px] text-[#64748B]">
              • <strong>Directed Arrows:</strong> Manager (Senior) points to Direct Report (Junior).
            </p>
            <p className="text-[11px] text-[#64748B]">
              • <strong>Connect by Dragging:</strong> Drag handle from bottom of Senior to top of Junior.
            </p>
            <p className="text-[11px] text-[#64748B]">
              • <strong>Click Any Arrow:</strong> Click edge arrow to remove reporting link.
            </p>
            <p className="text-[11px] text-[#64748B]">
              • <strong>Multi-Reporting:</strong> A under B and C shows 2 incoming arrows to A.
            </p>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}
