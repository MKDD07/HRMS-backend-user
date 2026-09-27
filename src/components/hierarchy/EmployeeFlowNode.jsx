import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import {
  Shield,
  Layers,
  Edit3,
  UserPlus,
  Users,
  Plus,
  Trash2,
  ArrowDown
} from 'lucide-react';
import { STAGE_CONFIG, MAX_RELATIONS } from '../../lib/hierarchyDatabase';
import { Avatar } from '../ui/Avatar';

function EmployeeFlowNodeComponent({ data, isConnectable }) {
  const {
    person,
    onAddSenior,
    onAddJunior,
    onEditTitle,
    onRemovePerson,
    onSelectEmployee,
    onDropPersonOnNode
  } = data;

  const stageInfo = STAGE_CONFIG[person.stage] || STAGE_CONFIG[5];
  const seniorsCount = (person.senior_ids || []).length;
  const juniorsCount = (person.junior_ids || []).length;
  const seniorString = (person.senior_ids || []).join(', ');
  const juniorString = (person.junior_ids || []).join(', ');

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e, role) => {
    e.preventDefault();
    e.stopPropagation();
    const sourceUserId = e.dataTransfer.getData('text/plain');
    if (sourceUserId && onDropPersonOnNode) {
      onDropPersonOnNode(sourceUserId, person.user_id, role);
    }
  };

  return (
    <div className="relative w-[280px] bg-white rounded-2xl border-2 border-[#E5E7EB] hover:border-[#4F46E5] shadow-md hover:shadow-lg transition-all text-[13px] font-sans select-none group">
      {/* Top Handle: For Incoming Senior Links (This person reports UNDER) */}
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        className="w-3.5 h-3.5 bg-[#4F46E5] border-2 border-white shadow-sm"
        title="Incoming reporting line (Senior)"
      />

      {/* Node Header */}
      <div className="px-3.5 py-2.5 bg-[#F9FAFB] rounded-t-2xl border-b border-[#E5E7EB] flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-[#4F46E5] bg-[#EEF2FF] px-2 py-0.5 rounded border border-[#E0E7FF]">
            {person.user_id}
          </span>
          <span
            className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${stageInfo.badge}`}
          >
            Stage {person.stage}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onEditTitle && onEditTitle(person)}
            className="p-1 text-[#9CA3AF] hover:text-[#4F46E5] hover:bg-[#EEF2FF] rounded transition-colors"
            title="Edit Job Title"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemovePerson && onRemovePerson(person.user_id);
            }}
            className="p-1 text-[#9CA3AF] hover:text-[#DC2626] hover:bg-rose-50 rounded transition-colors"
            title={`Remove ${person.name} from flow chart`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Node Body */}
      <div className="p-3.5 space-y-2.5">
        {/* Person Info */}
        <div className="flex items-start gap-2.5">
          <Avatar
            src={person.profile_pic_url}
            avatarId={person.avatar_id}
            name={person.name}
            size="sm"
            className="border border-[#E5E7EB] shrink-0 mt-0.5"
          />
          <div className="min-w-0 flex-1">
            <h4
              onClick={() => onSelectEmployee && onSelectEmployee(person.user_id)}
              className="font-bold text-[#111827] hover:text-[#4F46E5] cursor-pointer truncate text-[13px]"
              title={person.name}
            >
              {person.name}
            </h4>
            <p className="text-[11px] text-[#4B5563] font-medium truncate mt-0.5" title={person.job_title}>
              {person.job_title}
            </p>
            <span className="text-[10px] text-[#9CA3AF] block truncate">
              {person.department}
            </span>
          </div>
        </div>

        {/* Senior & Junior Comma Lists */}
        <div className="space-y-1.5 pt-2 border-t border-[#F3F4F6] text-[10px]">
          {/* Seniors (Reports under) */}
          <div
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, 'senior')}
            className="p-1.5 rounded-lg bg-[#F8FAFC] border border-dashed border-[#CBD5E1] hover:border-[#4F46E5] transition-colors"
            title="Drag a person card here to add as Senior"
          >
            <div className="flex items-center justify-between text-[#64748B]">
              <span className="font-semibold text-[#334155]">Reports Under (Seniors):</span>
              <span className="text-[9px] font-bold text-[#4F46E5]">
                {seniorsCount}/{MAX_RELATIONS}
              </span>
            </div>
            <div className="text-[#4F46E5] truncate font-medium mt-0.5">
              {seniorString ? `[${seniorString}]` : <span className="text-[#94A3B8] italic font-sans">Top Executive (None)</span>}
            </div>
          </div>

          {/* Juniors (Manages) */}
          <div
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, 'junior')}
            className="p-1.5 rounded-lg bg-[#F0FDF4] border border-dashed border-[#BBF7D0] hover:border-[#059669] transition-colors"
            title="Drag a person card here to add as Junior"
          >
            <div className="flex items-center justify-between text-[#166534]">
              <span className="font-semibold">Direct Reports (Juniors):</span>
              <span className="text-[9px] font-bold text-[#059669]">
                {juniorsCount}/{MAX_RELATIONS}
              </span>
            </div>
            <div className="text-[#059669] truncate font-medium mt-0.5">
              {juniorString ? `[${juniorString}]` : <span className="text-[#94A3B8] italic font-sans">Individual Contributor</span>}
            </div>
          </div>
        </div>

        {/* Quick Node Actions Bar */}
        <div className="flex items-center justify-between pt-1 border-t border-[#F3F4F6] text-[10px]">
          <button
            type="button"
            onClick={() => onAddSenior && onAddSenior(person)}
            disabled={seniorsCount >= MAX_RELATIONS}
            className="text-[#4F46E5] hover:underline font-semibold flex items-center gap-0.5 disabled:opacity-40"
          >
            <Plus className="w-2.5 h-2.5" /> Senior
          </button>
          <span className="text-[#E2E8F0]">|</span>
          <button
            type="button"
            onClick={() => onAddJunior && onAddJunior(person)}
            disabled={juniorsCount >= MAX_RELATIONS}
            className="text-[#059669] hover:underline font-semibold flex items-center gap-0.5 disabled:opacity-40"
          >
            <Plus className="w-2.5 h-2.5" /> Junior
          </button>
        </div>
      </div>

      {/* Bottom Handle: Outgoing Links (Works Under / Manages Subordinates) */}
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        className="w-3.5 h-3.5 bg-[#059669] border-2 border-white shadow-sm"
        title="Outgoing direct report line (Junior)"
      />
    </div>
  );
}

export const EmployeeFlowNode = memo(EmployeeFlowNodeComponent);
