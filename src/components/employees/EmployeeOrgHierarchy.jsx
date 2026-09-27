import React, { useState, useMemo, useRef } from 'react';
import {
  Users,
  Search,
  Plus,
  GitBranch,
  Layers,
  ChevronDown,
  ChevronRight,
  UserCheck,
  Edit3,
  Move,
  RotateCcw,
  Maximize2,
  Minimize2,
  ArrowRight,
  Shield,
  Briefcase,
  AlertCircle,
  ExternalLink,
  Check,
  Sparkles,
  UserPlus,
  CornerDownRight,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import {
  getHierarchyMap,
  saveHierarchyMap,
  computeLevels,
  canSetManager,
  setReportingManager,
  updateJobTitle,
  makeTopLevelRoot,
  resetHierarchyToDefault,
  buildHierarchyTree,
  STAGE_DESCRIPTIONS,
  MAX_STAGES
} from '../../lib/hierarchyStore';

export function EmployeeOrgHierarchy({
  employees = [],
  onSelectEmployee,
  onShowToast
}) {
  const [hierarchyMap, setHierarchyMap] = useState(() => getHierarchyMap());
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedNodes, setCollapsedNodes] = useState({});
  const [viewMode, setViewMode] = useState('tree'); // 'tree' | 'stages' | 'list'
  const [zoomLevel, setZoomLevel] = useState(1);

  // Drag and Drop state
  const [draggedUserId, setDraggedUserId] = useState(null);
  const [dragOverUserId, setDragOverUserId] = useState(null);
  const [dropValidation, setDropValidation] = useState(null);

  // Modals state
  const [addUnderTarget, setAddUnderTarget] = useState(null);
  const [selectedSubordinateId, setSelectedSubordinateId] = useState('');
  const [subordinateJobTitle, setSubordinateJobTitle] = useState('');

  const [changeManagerTarget, setChangeManagerTarget] = useState(null);
  const [selectedNewManagerId, setSelectedNewManagerId] = useState('');

  const [editJobTitleTarget, setEditJobTitleTarget] = useState(null);
  const [newJobTitleInput, setNewJobTitleInput] = useState('');

  // Build tree from employees and current hierarchyMap
  const { roots, allNodes, levels } = useMemo(() => {
    return buildHierarchyTree(employees, hierarchyMap);
  }, [employees, hierarchyMap]);

  // Find all employees matching the search query
  const matchingUserIds = useMemo(() => {
    if (!searchQuery.trim()) return new Set();
    const q = searchQuery.toLowerCase().trim();
    const matches = new Set();

    Object.values(allNodes).forEach((node) => {
      const matchName = node.name.toLowerCase().includes(q);
      const matchId = node.user_id.toLowerCase().includes(q);
      const matchTitle = (node.job_title || '').toLowerCase().includes(q);
      const matchDept = (node.department || '').toLowerCase().includes(q);

      if (matchName || matchId || matchTitle || matchDept) {
        matches.add(node.user_id);
      }
    });

    return matches;
  }, [searchQuery, allNodes]);

  // Auto-expand ancestors of matched nodes
  React.useEffect(() => {
    if (matchingUserIds.size > 0) {
      setCollapsedNodes((prev) => {
        const next = { ...prev };
        matchingUserIds.forEach((uid) => {
          let curr = allNodes[uid];
          while (curr && curr.reports_to) {
            next[curr.reports_to] = false;
            curr = allNodes[curr.reports_to];
          }
        });
        return next;
      });
    }
  }, [matchingUserIds, allNodes]);

  const toggleCollapse = (userId) => {
    setCollapsedNodes((prev) => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  const expandAll = () => setCollapsedNodes({});
  const collapseAll = () => {
    const next = {};
    Object.keys(allNodes).forEach((uid) => {
      if (allNodes[uid].children.length > 0) next[uid] = true;
    });
    setCollapsedNodes(next);
  };

  const handleResetHierarchy = () => {
    if (window.confirm('Reset organizational hierarchy to default corporate structure?')) {
      const def = resetHierarchyToDefault();
      setHierarchyMap(def);
      setCollapsedNodes({});
      if (onShowToast) {
        onShowToast({
          type: 'info',
          title: 'Hierarchy Reset',
          message: 'Corporate reporting structure restored to default verified records.'
        });
      }
    }
  };

  // --------------------------------------------------------------------------
  // Drag and Drop Handlers
  // --------------------------------------------------------------------------
  const handleDragStart = (e, userId) => {
    setDraggedUserId(userId);
    e.dataTransfer.setData('text/plain', userId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, targetUserId) => {
    e.preventDefault();
    if (!draggedUserId || draggedUserId === targetUserId) return;

    if (dragOverUserId !== targetUserId) {
      setDragOverUserId(targetUserId);
      const check = canSetManager(hierarchyMap, draggedUserId, targetUserId);
      setDropValidation(check);
    }
  };

  const handleDragLeave = (e, targetUserId) => {
    if (dragOverUserId === targetUserId) {
      setDragOverUserId(null);
      setDropValidation(null);
    }
  };

  const handleDrop = (e, targetUserId) => {
    e.preventDefault();
    setDragOverUserId(null);
    setDropValidation(null);

    const sourceUserId = draggedUserId || e.dataTransfer.getData('text/plain');
    setDraggedUserId(null);

    if (!sourceUserId || sourceUserId === targetUserId) return;

    const res = setReportingManager(sourceUserId, targetUserId);
    if (!res.success) {
      if (onShowToast) {
        onShowToast({
          type: 'error',
          title: 'Assignment Restricted',
          message: res.reason
        });
      }
      return;
    }

    setHierarchyMap({ ...res.map });
    const sourceName = allNodes[sourceUserId]?.name || sourceUserId;
    const targetName = allNodes[targetUserId]?.name || targetUserId;

    if (onShowToast) {
      onShowToast({
        type: 'success',
        title: 'Reporting Assigned',
        message: `${sourceName} now reports under ${targetName} (${targetUserId}).`
      });
    }
  };

  // --------------------------------------------------------------------------
  // Modal Actions: Add Under
  // --------------------------------------------------------------------------
  const handleOpenAddUnder = (node) => {
    setAddUnderTarget(node);
    // Find first employee not already reporting to this node and not in cycle
    const candidate = employees.find((e) => {
      const uid = e.userid || e.user_id;
      return uid !== node.user_id && canSetManager(hierarchyMap, uid, node.user_id).allowed;
    });
    setSelectedSubordinateId(candidate ? candidate.userid || candidate.user_id : '');
    setSubordinateJobTitle(candidate ? candidate.designation || 'Specialist' : '');
  };

  const handleConfirmAddUnder = () => {
    if (!addUnderTarget || !selectedSubordinateId) return;

    const res = setReportingManager(
      selectedSubordinateId,
      addUnderTarget.user_id,
      subordinateJobTitle.trim() || undefined
    );

    if (!res.success) {
      if (onShowToast) {
        onShowToast({
          type: 'error',
          title: 'Cannot Add Under',
          message: res.reason
        });
      }
      return;
    }

    setHierarchyMap({ ...res.map });
    setAddUnderTarget(null);

    // Expand manager so new report is visible
    setCollapsedNodes((prev) => ({ ...prev, [addUnderTarget.user_id]: false }));

    const subName = allNodes[selectedSubordinateId]?.name || selectedSubordinateId;
    if (onShowToast) {
      onShowToast({
        type: 'success',
        title: 'Subordinate Added',
        message: `${subName} now works under ${addUnderTarget.name}.`
      });
    }
  };

  // --------------------------------------------------------------------------
  // Modal Actions: Change Manager (Work Under)
  // --------------------------------------------------------------------------
  const handleOpenChangeManager = (node) => {
    setChangeManagerTarget(node);
    setSelectedNewManagerId(node.reports_to || '');
  };

  const handleConfirmChangeManager = () => {
    if (!changeManagerTarget) return;

    const targetUserId = changeManagerTarget.user_id;
    const newManager = selectedNewManagerId === 'ROOT' ? null : selectedNewManagerId || null;

    const res = setReportingManager(targetUserId, newManager);
    if (!res.success) {
      if (onShowToast) {
        onShowToast({
          type: 'error',
          title: 'Change Manager Failed',
          message: res.reason
        });
      }
      return;
    }

    setHierarchyMap({ ...res.map });
    setChangeManagerTarget(null);

    if (onShowToast) {
      onShowToast({
        type: 'success',
        title: 'Hierarchy Updated',
        message: newManager
          ? `${changeManagerTarget.name} now works under ${allNodes[newManager]?.name || newManager}.`
          : `${changeManagerTarget.name} is now a Top-Level Root (Executive).`
      });
    }
  };

  // --------------------------------------------------------------------------
  // Modal Actions: Edit Job Title
  // --------------------------------------------------------------------------
  const handleOpenEditJobTitle = (node) => {
    setEditJobTitleTarget(node);
    setNewJobTitleInput(node.job_title || '');
  };

  const handleConfirmEditJobTitle = () => {
    if (!editJobTitleTarget || !newJobTitleInput.trim()) return;

    const updated = updateJobTitle(editJobTitleTarget.user_id, newJobTitleInput.trim());
    setHierarchyMap({ ...updated });
    setEditJobTitleTarget(null);

    if (onShowToast) {
      onShowToast({
        type: 'success',
        title: 'Job Title Updated',
        message: `Designation for ${editJobTitleTarget.name} updated to "${newJobTitleInput.trim()}".`
      });
    }
  };

  // Candidate managers for change manager selection
  const validManagerOptions = useMemo(() => {
    if (!changeManagerTarget) return [];
    return employees
      .map((e) => {
        const uid = e.userid || e.user_id;
        const check = canSetManager(hierarchyMap, changeManagerTarget.user_id, uid);
        return {
          employee: e,
          user_id: uid,
          name: `${e.first_name || ''} ${e.last_name || ''}`.trim() || uid,
          stage_level: levels[uid] || 1,
          allowed: check.allowed,
          reason: check.reason
        };
      })
      .filter((opt) => opt.user_id !== changeManagerTarget.user_id);
  }, [changeManagerTarget, employees, hierarchyMap, levels]);

  // Candidate subordinates for add under
  const validSubordinateOptions = useMemo(() => {
    if (!addUnderTarget) return [];
    return employees
      .map((e) => {
        const uid = e.userid || e.user_id;
        const check = canSetManager(hierarchyMap, uid, addUnderTarget.user_id);
        return {
          employee: e,
          user_id: uid,
          name: `${e.first_name || ''} ${e.last_name || ''}`.trim() || uid,
          designation: e.designation || 'Staff',
          allowed: check.allowed,
          reason: check.reason
        };
      })
      .filter((opt) => opt.user_id !== addUnderTarget.user_id);
  }, [addUnderTarget, employees, hierarchyMap]);

  return (
    <div id="section-employee-hierarchy" className="mt-8 space-y-4">
      {/* Hierarchy Header Card */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] text-[#4F46E5] flex items-center justify-center border border-[#E0E7FF]">
                <GitBranch className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-[#111827]">
                    Enterprise Organizational Hierarchy
                  </h2>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[13px] font-semibold bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]">
                    Max {MAX_STAGES} Stages Enabled
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Top Controls Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Switcher */}
            <div className="flex items-center bg-[#F3F4F6] p-0.5 rounded-lg border border-[#E5E7EB]">
              <button
                type="button"
                onClick={() => setViewMode('tree')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-md transition-all ${viewMode === 'tree'
                  ? 'bg-white text-[#111827] shadow-xs'
                  : 'text-[#5F6368] hover:text-[#111827]'
                  }`}
              >
                <GitBranch className="w-3.5 h-3.5" />
                Visual Tree
              </button>
              <button
                type="button"
                onClick={() => setViewMode('stages')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-md transition-all ${viewMode === 'stages'
                  ? 'bg-white text-[#111827] shadow-xs'
                  : 'text-[#5F6368] hover:text-[#111827]'
                  }`}
              >
                <Layers className="w-3.5 h-3.5" />
                5-Stage Pipeline
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-md transition-all ${viewMode === 'list'
                  ? 'bg-white text-[#111827] shadow-xs'
                  : 'text-[#5F6368] hover:text-[#111827]'
                  }`}
              >
                <CornerDownRight className="w-3.5 h-3.5" />
                Indented Roster
              </button>
            </div>

            {/* Tree Zoom Controls */}
            {viewMode === 'tree' && (
              <div className="flex items-center bg-[#F3F4F6] p-0.5 rounded-lg border border-[#E5E7EB]">
                <button
                  type="button"
                  title="Zoom Out"
                  onClick={() => setZoomLevel((z) => Math.max(0.7, +(z - 0.1).toFixed(1)))}
                  className="p-1.5 text-[#5F6368] hover:text-[#111827] rounded"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] px-2 text-[#27292C]">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  type="button"
                  title="Zoom In"
                  onClick={() => setZoomLevel((z) => Math.min(1.3, +(z + 0.1).toFixed(1)))}
                  className="p-1.5 text-[#5F6368] hover:text-[#111827] rounded"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  title="Reset Zoom"
                  onClick={() => setZoomLevel(1)}
                  className="px-2 text-[11px] text-[#5F6368] hover:text-[#111827]"
                >
                  Reset
                </button>
              </div>
            )}

            {/* Expand / Collapse All */}
            <Button
              variant="secondary"
              size="sm"
              className="text-[13px]"
              onClick={expandAll}
              title="Expand all subordinate branches"
            >
              Expand All
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="text-[13px]"
              onClick={collapseAll}
              title="Collapse all subordinate branches"
            >
              Collapse
            </Button>

            {/* Reset to Default */}
            <Button
              variant="secondary"
              size="sm"
              icon={RotateCcw}
              className="text-[13px] text-[#5F6368]"
              onClick={handleResetHierarchy}
              title="Reset hierarchy to verified corporate default"
            >
              Reset
            </Button>
          </div>
        </div>

        {/* Search & Drag/Drop Instruction Banner */}
        <div className="mt-4 pt-4 border-t border-[#F3F4F6] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Input with Name/ID Filter */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search person by name, user_id, job title, or dept..."
              className="w-full pl-9 pr-8 text-[13px] h-9 rounded-lg border border-[#E5E7EB] bg-[#FFFFFF] focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5] placeholder-[#9CA3AF]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[13px] text-[#9CA3AF] hover:text-[#111827]"
              >
                ✕
              </button>
            )}
          </div>

          {/* Dynamic Drag Hint Pill */}
          <div className="flex items-center gap-2 text-[13px] text-[#5F6368] bg-[#F9FAFB] px-3 py-1.5 rounded-lg border border-[#E5E7EB]">
            <Move className="w-3.5 h-3.5 text-[#4F46E5]" />
            <span>
              <strong className="text-[#111827]">Drag & Drop:</strong> Grab any person card and drop onto another to set them as reporting manager.
            </span>
            {searchQuery && (
              <span className="font-semibold text-[#4F46E5] ml-auto">
                {matchingUserIds.size} match{matchingUserIds.size === 1 ? '' : 'es'}
              </span>
            )}
          </div>
        </div>

        {/* Stage Legend Pills */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-[#5F6368]">
          <span className="font-medium text-[#111827]">Chain of Command Stages:</span>
          {Object.entries(STAGE_DESCRIPTIONS).map(([lvl, info]) => (
            <span
              key={lvl}
              className={`inline-flex items-center px-2 py-0.5 rounded-md border font-medium ${info.color}`}
            >
              Stage {lvl}
            </span>
          ))}
        </div>
      </div>

      {/* Main Hierarchy Visualization Area */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-xs min-h-[480px] overflow-hidden">
        {viewMode === 'tree' && (
          <div
            className="overflow-x-auto overflow-y-auto pb-8 pt-4 transition-transform origin-top-left"
            style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center' }}
          >
            <div className="flex justify-center min-w-max">
              <div className="flex flex-col items-center gap-8">
                {roots.map((rootNode) => (
                  <HierarchyTreeNode
                    key={rootNode.user_id}
                    node={rootNode}
                    allNodes={allNodes}
                    levels={levels}
                    collapsedNodes={collapsedNodes}
                    toggleCollapse={toggleCollapse}
                    searchQuery={searchQuery}
                    matchingUserIds={matchingUserIds}
                    draggedUserId={draggedUserId}
                    dragOverUserId={dragOverUserId}
                    dropValidation={dropValidation}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onOpenAddUnder={handleOpenAddUnder}
                    onOpenChangeManager={handleOpenChangeManager}
                    onOpenEditJobTitle={handleOpenEditJobTitle}
                    onSelectEmployee={onSelectEmployee}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {viewMode === 'stages' && (
          <StageSwimlaneView
            allNodes={allNodes}
            levels={levels}
            searchQuery={searchQuery}
            matchingUserIds={matchingUserIds}
            draggedUserId={draggedUserId}
            dragOverUserId={dragOverUserId}
            dropValidation={dropValidation}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onOpenAddUnder={handleOpenAddUnder}
            onOpenChangeManager={handleOpenChangeManager}
            onOpenEditJobTitle={handleOpenEditJobTitle}
            onSelectEmployee={onSelectEmployee}
          />
        )}

        {viewMode === 'list' && (
          <IndentedRosterView
            roots={roots}
            levels={levels}
            searchQuery={searchQuery}
            matchingUserIds={matchingUserIds}
            onOpenAddUnder={handleOpenAddUnder}
            onOpenChangeManager={handleOpenChangeManager}
            onOpenEditJobTitle={handleOpenEditJobTitle}
            onSelectEmployee={onSelectEmployee}
          />
        )}
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* Modal: Add Subordinate Under Person                                   */}
      {/* --------------------------------------------------------------------- */}
      <Modal
        isOpen={!!addUnderTarget}
        onClose={() => setAddUnderTarget(null)}
        title={`Add Direct Report Under ${addUnderTarget?.name || 'Manager'}`}
        size="md"
      >
        {addUnderTarget && (
          <div className="space-y-4">
            <div className="p-3 bg-[#F9FAFB] rounded-xl border border-[#E5E7EB] flex items-center gap-3">
              <Avatar
                src={addUnderTarget.profile_pic_url}
                alt={addUnderTarget.name}
                size="md"
              />
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-sm text-[#111827]">
                    {addUnderTarget.name}
                  </h4>
                  <span className="text-[13px] text-[#4F46E5] bg-[#EEF2FF] px-1.5 py-0.5 rounded">
                    {addUnderTarget.user_id}
                  </span>
                </div>
                <p className="text-[13px] text-[#5F6368]">{addUnderTarget.job_title}</p>
                <div className="mt-1">
                  <span className="text-[11px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded">
                    Current Manager Level: Stage {levels[addUnderTarget.user_id] || 1}
                  </span>
                </div>
              </div>
            </div>

            {levels[addUnderTarget.user_id] >= MAX_STAGES ? (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-[13px] flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-semibold">Hierarchy Ceiling Limit Reached</strong>
                  This manager is currently at Stage {MAX_STAGES} (Maximum Allowed Depth). You cannot nest further subordinate stages under this person.
                </div>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-[13px] font-semibold text-[#27292C] mb-1">
                    Select Person to Work Under {addUnderTarget.name} *
                  </label>
                  <select
                    value={selectedSubordinateId}
                    onChange={(e) => {
                      setSelectedSubordinateId(e.target.value);
                      const sel = employees.find((emp) => (emp.userid || emp.user_id) === e.target.value);
                      if (sel) {
                        setSubordinateJobTitle(sel.designation || 'Specialist');
                      }
                    }}
                    className="w-full text-[13px] h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 focus:border-[#4F46E5]"
                  >
                    <option value="">-- Choose Employee by Name / user_id --</option>
                    {validSubordinateOptions.map((opt) => (
                      <option
                        key={opt.user_id}
                        value={opt.user_id}
                        disabled={!opt.allowed}
                      >
                        {opt.name} ({opt.user_id}) - {opt.designation} {!opt.allowed ? `[${opt.reason}]` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[13px] font-semibold text-[#27292C] mb-1">
                    Confirm / Customize Job Title
                  </label>
                  <input
                    type="text"
                    value={subordinateJobTitle}
                    onChange={(e) => setSubordinateJobTitle(e.target.value)}
                    placeholder="e.g. Senior Backend Engineer"
                    className="w-full text-[13px] h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 focus:border-[#4F46E5]"
                  />
                  <p className="text-[11px] text-[#5F6368] mt-1">
                    Will be placed at <strong>Stage {(levels[addUnderTarget.user_id] || 1) + 1}</strong> in the hierarchy.
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-[#E5E7EB]">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setAddUnderTarget(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    icon={UserPlus}
                    disabled={!selectedSubordinateId}
                    onClick={handleConfirmAddUnder}
                  >
                    Assign Under {addUnderTarget.name.split(' ')[0]}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* --------------------------------------------------------------------- */}
      {/* Modal: Change Reporting Manager (Work Under)                          */}
      {/* --------------------------------------------------------------------- */}
      <Modal
        isOpen={!!changeManagerTarget}
        onClose={() => setChangeManagerTarget(null)}
        title={`Work Under Selection for ${changeManagerTarget?.name || 'Employee'}`}
        size="md"
      >
        {changeManagerTarget && (
          <div className="space-y-4">
            <div className="p-3 bg-[#F9FAFB] rounded-xl border border-[#E5E7EB] flex items-center gap-3">
              <Avatar
                src={changeManagerTarget.profile_pic_url}
                alt={changeManagerTarget.name}
                size="md"
              />
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-sm text-[#111827]">
                    {changeManagerTarget.name}
                  </h4>
                  <span className="text-[13px] text-[#4F46E5] bg-[#EEF2FF] px-1.5 py-0.5 rounded">
                    {changeManagerTarget.user_id}
                  </span>
                </div>
                <p className="text-[13px] text-[#5F6368]">{changeManagerTarget.job_title}</p>
                <p className="text-[11px] text-[#5F6368] mt-0.5">
                  Currently reports to:{' '}
                  <strong className="text-[#111827]">
                    {changeManagerTarget.reports_to
                      ? `${allNodes[changeManagerTarget.reports_to]?.name || changeManagerTarget.reports_to} (${changeManagerTarget.reports_to})`
                      : 'None (Top-Level Executive / Stage 1)'}
                  </strong>
                </p>
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#27292C] mb-1">
                Select Person This Employee Works Under:
              </label>
              <select
                value={selectedNewManagerId}
                onChange={(e) => setSelectedNewManagerId(e.target.value)}
                className="w-full text-[13px] h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 focus:border-[#4F46E5]"
              >
                <option value="ROOT">
                  ★ Set as Top-Level Executive (No Reporting Manager / Stage 1)
                </option>
                <optgroup label="Available Managers in Organization">
                  {validManagerOptions.map((opt) => (
                    <option
                      key={opt.user_id}
                      value={opt.user_id}
                      disabled={!opt.allowed}
                    >
                      {opt.name} ({opt.user_id}) - Stage {opt.stage_level} {!opt.allowed ? `[${opt.reason}]` : ''}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div className="p-3 bg-[#EEF2FF] rounded-xl border border-[#E0E7FF] text-[13px] text-[#3730A3]">
              <div className="flex items-center gap-1.5 font-semibold">
                <Shield className="w-3.5 h-3.5" />
                Hierarchy Integrity & Validation
              </div>
              <p className="mt-1 text-[11px] text-[#4338CA]">
                Cyclic dependencies are automatically prohibited. Total organization depth cannot exceed {MAX_STAGES} stages.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#E5E7EB]">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setChangeManagerTarget(null)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={Check}
                onClick={handleConfirmChangeManager}
              >
                Save Reporting Manager
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* --------------------------------------------------------------------- */}
      {/* Modal: Edit Job Title                                                 */}
      {/* --------------------------------------------------------------------- */}
      <Modal
        isOpen={!!editJobTitleTarget}
        onClose={() => setEditJobTitleTarget(null)}
        title={`Edit Job Title for ${editJobTitleTarget?.name || 'Employee'}`}
        size="sm"
      >
        {editJobTitleTarget && (
          <div className="space-y-4">
            <div>
              <label className="block text-[13px] font-semibold text-[#27292C] mb-1">
                Designation / Job Title *
              </label>
              <input
                type="text"
                required
                value={newJobTitleInput}
                onChange={(e) => setNewJobTitleInput(e.target.value)}
                placeholder="e.g. Principal Systems Architect"
                className="w-full text-[13px] h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 focus:border-[#4F46E5]"
              />
              <p className="text-[11px] text-[#5F6368] mt-1 font-mono">
                Employee user_id: {editJobTitleTarget.user_id}
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#E5E7EB]">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setEditJobTitleTarget(null)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={Check}
                onClick={handleConfirmEditJobTitle}
              >
                Update Job Title
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Visual Tree Node Component (Recursive Layout with Connectors)
// ----------------------------------------------------------------------------
function HierarchyTreeNode({
  node,
  allNodes,
  levels,
  collapsedNodes,
  toggleCollapse,
  searchQuery,
  matchingUserIds,
  draggedUserId,
  dragOverUserId,
  dropValidation,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onOpenAddUnder,
  onOpenChangeManager,
  onOpenEditJobTitle,
  onSelectEmployee
}) {
  const isCollapsed = !!collapsedNodes[node.user_id];
  const hasChildren = node.children && node.children.length > 0;
  const isMatched = matchingUserIds.has(node.user_id);
  const isDragged = draggedUserId === node.user_id;
  const isDragOver = dragOverUserId === node.user_id;

  const stageLevel = levels[node.user_id] || 1;
  const stageInfo = STAGE_DESCRIPTIONS[stageLevel] || STAGE_DESCRIPTIONS[5];

  return (
    <div className="flex flex-col items-center relative">
      {/* Node Card Container */}
      <div
        draggable
        onDragStart={(e) => onDragStart(e, node.user_id)}
        onDragOver={(e) => onDragOver(e, node.user_id)}
        onDragLeave={(e) => onDragLeave(e, node.user_id)}
        onDrop={(e) => onDrop(e, node.user_id)}
        className={`group relative w-72 rounded-2xl p-4 transition-all duration-200 select-none cursor-grab active:cursor-grabbing border ${isDragged
          ? 'opacity-40 scale-95 border-dashed border-[#6366F1] bg-[#F5F3FF]'
          : isDragOver
            ? dropValidation?.allowed
              ? 'border-2 border-emerald-500 bg-emerald-50/70 shadow-lg scale-105'
              : 'border-2 border-rose-500 bg-rose-50/70 shadow-lg scale-105'
            : isMatched
              ? 'border-2 border-amber-500 bg-amber-50/40 shadow-md ring-4 ring-amber-100'
              : 'border-[#E5E7EB] bg-white hover:border-[#4F46E5] hover:shadow-md'
          }`}
      >
        {/* Drag Over Indicator Overlay */}
        {isDragOver && (
          <div className="absolute inset-x-2 -top-3 flex justify-center z-20">
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-sm ${dropValidation?.allowed
                ? 'bg-emerald-600 text-white'
                : 'bg-rose-600 text-white'
                }`}
            >
              {dropValidation?.allowed
                ? `Drop to report under ${node.name.split(' ')[0]}`
                : dropValidation?.reason || 'Invalid drop target'}
            </span>
          </div>
        )}

        {/* Top Header: Stage Level + Drag Handle */}
        <div className="flex items-center justify-between mb-2.5">
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${stageInfo.color}`}
          >
            Stage {stageLevel}: {stageInfo.label.split(':')[1] || 'Level'}
          </span>

          <div className="flex items-center gap-1">
            <span className="text-[11px] font-semibold text-[#4F46E5] bg-[#EEF2FF] px-1.5 py-0.5 rounded border border-[#E0E7FF]">
              {node.user_id}
            </span>
            <div
              title="Drag to change reporting manager"
              className="p-1 text-[#9CA3AF] hover:text-[#4F46E5] cursor-grab"
            >
              <Move className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>

        {/* Employee Info Header: Avatar + Names */}
        <div className="flex items-start gap-3">
          <div className="relative">
            <Avatar
              src={node.profile_pic_url}
              alt={node.name}
              size="md"
              className="border border-[#E5E7EB] shadow-xs"
            />
            {/* Direct reports count indicator */}
            {hasChildren && (
              <span
                className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#4F46E5] text-white text-[9px] font-bold flex items-center justify-center shadow-xs"
                title={`${node.children.length} direct report${node.children.length > 1 ? 's' : ''}`}
              >
                {node.children.length}
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3
              onClick={() => onSelectEmployee && onSelectEmployee(node.user_id)}
              className="text-sm font-bold text-[#111827] truncate hover:text-[#4F46E5] cursor-pointer"
              title={node.name}
            >
              {node.name}
            </h3>

            {/* Job Title with Quick Edit Icon */}
            <div className="flex items-center gap-1 group/title mt-0.5">
              <p
                className="text-[13px] font-medium text-[#4B5563] truncate"
                title={node.job_title}
              >
                {node.job_title}
              </p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenEditJobTitle(node);
                }}
                title="Edit Job Title"
                className="opacity-0 group-hover/title:opacity-100 p-0.5 text-[#9CA3AF] hover:text-[#4F46E5] transition-opacity"
              >
                <Edit3 className="w-3 h-3" />
              </button>
            </div>

            <p className="text-[11px] text-[#9CA3AF] truncate mt-0.5">
              {node.department}
            </p>
          </div>
        </div>

        {/* Reporting Chain Status Pill */}
        <div className="mt-3 pt-2.5 border-t border-[#F3F4F6] flex items-center justify-between text-[11px]">
          <span className="text-[#6B7280]">Works Under:</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenChangeManager(node);
            }}
            className="font-medium text-[#4F46E5] hover:underline truncate max-w-[150px]"
            title="Click to select or change who this person works under"
          >
            {node.reports_to
              ? `${allNodes[node.reports_to]?.name || node.reports_to}`
              : 'Top Executive (None)'}
          </button>
        </div>

        {/* Node Bottom Action Bar */}
        <div className="mt-2.5 pt-2 border-t border-[#F3F4F6] flex items-center justify-between gap-1.5">
          {/* Add Under Button */}
          <Button
            variant="secondary"
            size="sm"
            icon={Plus}
            disabled={stageLevel >= MAX_STAGES}
            onClick={(e) => {
              e.stopPropagation();
              onOpenAddUnder(node);
            }}
            className="text-[11px] h-7 px-2 py-0 border-[#E5E7EB] text-[#111827] hover:bg-[#F3F4F6]"
            title={
              stageLevel >= MAX_STAGES
                ? `Cannot add under: Max ${MAX_STAGES} stages reached`
                : `Add someone to work under ${node.name}`
            }
          >
            {stageLevel >= MAX_STAGES ? 'Max Stages' : 'Add Under'}
          </Button>

          {/* Change Manager Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onOpenChangeManager(node);
            }}
            className="text-[11px] h-7 px-2 py-0 text-[#6B7280] hover:text-[#111827]"
            title="Change who this person works under"
          >
            Change Manager
          </Button>

          {/* Dossier Quick Link */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onSelectEmployee) onSelectEmployee(node.user_id);
            }}
            title="View Full Profile Dossier"
            className="p-1 text-[#9CA3AF] hover:text-[#4F46E5] rounded"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Collapse / Expand Toggle Button on Node Bottom Edge */}
        {hasChildren && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleCollapse(node.user_id);
            }}
            className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-white border border-[#D1D5DB] shadow-xs flex items-center justify-center text-[#4B5563] hover:text-[#111827] hover:border-[#4F46E5] transition-all z-10"
            title={isCollapsed ? 'Expand reports' : 'Collapse reports'}
          >
            {isCollapsed ? (
              <span className="text-[10px] font-bold text-[#4F46E5]">
                +{node.children.length}
              </span>
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        )}
      </div>

      {/* Vertical Stem down to children */}
      {hasChildren && !isCollapsed && (
        <div className="w-0.5 h-6 bg-[#CBD5E1]" />
      )}

      {/* Children Branches */}
      {hasChildren && !isCollapsed && (
        <div className="flex justify-center relative pt-2">
          {/* Horizontal crossbar connecting all children */}
          {node.children.length > 1 && (
            <div
              className="absolute top-0 h-0.5 bg-[#CBD5E1]"
              style={{
                left: `calc(50% / ${node.children.length})`,
                right: `calc(50% / ${node.children.length})`
              }}
            />
          )}

          <div className="flex gap-6">
            {node.children.map((childNode) => (
              <div key={childNode.user_id} className="flex flex-col items-center relative">
                {/* Vertical hook from crossbar down into child */}
                <div className="w-0.5 h-4 bg-[#CBD5E1]" />
                <HierarchyTreeNode
                  node={childNode}
                  allNodes={allNodes}
                  levels={levels}
                  collapsedNodes={collapsedNodes}
                  toggleCollapse={toggleCollapse}
                  searchQuery={searchQuery}
                  matchingUserIds={matchingUserIds}
                  draggedUserId={draggedUserId}
                  dragOverUserId={dragOverUserId}
                  dropValidation={dropValidation}
                  onDragStart={onDragStart}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                  onOpenAddUnder={onOpenAddUnder}
                  onOpenChangeManager={onOpenChangeManager}
                  onOpenEditJobTitle={onOpenEditJobTitle}
                  onSelectEmployee={onSelectEmployee}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Stage 1 to 5 Swimlane Pipeline View
// ----------------------------------------------------------------------------
function StageSwimlaneView({
  allNodes,
  levels,
  searchQuery,
  matchingUserIds,
  draggedUserId,
  dragOverUserId,
  dropValidation,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onOpenAddUnder,
  onOpenChangeManager,
  onOpenEditJobTitle,
  onSelectEmployee
}) {
  // Group all nodes by stage level (1 to 5)
  const stages = [1, 2, 3, 4, 5].map((lvl) => {
    const members = Object.values(allNodes).filter(
      (n) => (levels[n.user_id] || 1) === lvl
    );
    return { level: lvl, members };
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 overflow-x-auto pb-4">
      {stages.map(({ level, members }) => {
        const info = STAGE_DESCRIPTIONS[level];
        return (
          <div
            key={level}
            className="flex flex-col rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-3 min-w-[240px]"
          >
            {/* Stage Column Header */}
            <div className="pb-3 mb-3 border-b border-[#E5E7EB] flex items-center justify-between">
              <div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${info.color}`}
                >
                  Stage {level}
                </span>
                <h4 className="text-[13px] font-bold text-[#111827] mt-1">
                  {info.label.split(':')[1] || `Level ${level}`}
                </h4>
              </div>
              <span className="text-[13px] font-bold px-2 py-0.5 rounded-full bg-white border border-[#E5E7EB] text-[#5F6368]">
                {members.length}
              </span>
            </div>

            {/* Stage Cards */}
            <div className="space-y-3 flex-1">
              {members.length === 0 ? (
                <div className="py-8 text-center text-[13px] text-[#9CA3AF] border-2 border-dashed border-[#E5E7EB] rounded-xl">
                  No personnel in Stage {level}
                </div>
              ) : (
                members.map((node) => {
                  const isMatched = matchingUserIds.has(node.user_id);
                  const isDragged = draggedUserId === node.user_id;
                  const isDragOver = dragOverUserId === node.user_id;

                  return (
                    <div
                      key={node.user_id}
                      draggable
                      onDragStart={(e) => onDragStart(e, node.user_id)}
                      onDragOver={(e) => onDragOver(e, node.user_id)}
                      onDragLeave={(e) => onDragLeave(e, node.user_id)}
                      onDrop={(e) => onDrop(e, node.user_id)}
                      className={`relative rounded-xl p-3 border transition-all cursor-grab active:cursor-grabbing ${isDragged
                        ? 'opacity-40 border-dashed border-[#6366F1] bg-[#F5F3FF]'
                        : isDragOver
                          ? dropValidation?.allowed
                            ? 'border-2 border-emerald-500 bg-emerald-50'
                            : 'border-2 border-rose-500 bg-rose-50'
                          : isMatched
                            ? 'border-2 border-amber-500 bg-amber-50/50 shadow-xs'
                            : 'border-[#E5E7EB] bg-white hover:border-[#4F46E5] shadow-xs'
                        }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <Avatar
                          src={node.profile_pic_url}
                          alt={node.name}
                          size="sm"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h5
                              onClick={() =>
                                onSelectEmployee && onSelectEmployee(node.user_id)
                              }
                              className="text-[13px] font-bold text-[#111827] truncate hover:text-[#4F46E5] cursor-pointer"
                            >
                              {node.name}
                            </h5>
                            <span className="text-[10px] font-semibold text-[#4F46E5]">
                              {node.user_id}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 group/title mt-0.5">
                            <p className="text-[11px] text-[#4B5563] truncate">
                              {node.job_title}
                            </p>
                            <button
                              type="button"
                              onClick={() => onOpenEditJobTitle(node)}
                              className="opacity-0 group-hover/title:opacity-100 text-[#9CA3AF] hover:text-[#4F46E5]"
                            >
                              <Edit3 className="w-2.5 h-2.5" />
                            </button>
                          </div>

                          <p className="text-[10px] text-[#9CA3AF] mt-0.5">
                            {node.reports_to
                              ? `↳ Works under: ${allNodes[node.reports_to]?.name?.split(' ')[0] || node.reports_to}`
                              : '★ Top Executive'}
                          </p>
                        </div>
                      </div>

                      {/* Card Actions */}
                      <div className="mt-2 pt-2 border-t border-[#F3F4F6] flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => onOpenAddUnder(node)}
                          disabled={level >= MAX_STAGES}
                          className="text-[10px] font-semibold text-[#4F46E5] hover:underline disabled:opacity-40"
                        >
                          + Add Under
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenChangeManager(node)}
                          className="text-[10px] text-[#6B7280] hover:text-[#111827]"
                        >
                          Work Under...
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Indented Roster / List View
// ----------------------------------------------------------------------------
function IndentedRosterView({
  roots,
  levels,
  searchQuery,
  matchingUserIds,
  onOpenAddUnder,
  onOpenChangeManager,
  onOpenEditJobTitle,
  onSelectEmployee
}) {
  const renderItem = (node, depth = 0) => {
    const isMatched = matchingUserIds.has(node.user_id);
    const stageLevel = levels[node.user_id] || 1;
    const stageInfo = STAGE_DESCRIPTIONS[stageLevel];

    return (
      <React.Fragment key={node.user_id}>
        <div
          className={`flex items-center justify-between p-3 rounded-xl border transition-all ${isMatched
            ? 'border-amber-400 bg-amber-50/50'
            : 'border-[#E5E7EB] bg-white hover:bg-[#F9FAFB]'
            }`}
          style={{ marginLeft: `${depth * 28}px` }}
        >
          <div className="flex items-center gap-3">
            {depth > 0 && (
              <CornerDownRight className="w-4 h-4 text-[#9CA3AF] shrink-0" />
            )}
            <Avatar src={node.profile_pic_url} alt={node.name} size="sm" />
            <div>
              <div className="flex items-center gap-2">
                <span
                  onClick={() => onSelectEmployee && onSelectEmployee(node.user_id)}
                  className="font-bold text-[13px] text-[#111827] hover:text-[#4F46E5] cursor-pointer"
                >
                  {node.name}
                </span>
                <span className="text-[10px] text-[#4F46E5] bg-[#EEF2FF] px-1 rounded">
                  {node.user_id}
                </span>
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${stageInfo.color}`}
                >
                  Stage {stageLevel}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-[#5F6368]">
                <span>{node.job_title}</span>
                <span>•</span>
                <span>{node.department}</span>
                <button
                  type="button"
                  onClick={() => onOpenEditJobTitle(node)}
                  className="text-[#9CA3AF] hover:text-[#4F46E5]"
                >
                  <Edit3 className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="text-[11px] h-7 px-2 py-0"
              disabled={stageLevel >= MAX_STAGES}
              onClick={() => onOpenAddUnder(node)}
            >
              + Add Under
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-[11px] h-7 px-2 py-0"
              onClick={() => onOpenChangeManager(node)}
            >
              Work Under...
            </Button>
          </div>
        </div>

        {node.children &&
          node.children.map((child) => renderItem(child, depth + 1))}
      </React.Fragment>
    );
  };

  return (
    <div className="space-y-2">
      {roots.map((root) => renderItem(root, 0))}
    </div>
  );
}
