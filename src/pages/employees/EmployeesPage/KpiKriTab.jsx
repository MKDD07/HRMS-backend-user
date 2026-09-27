import React, { useState } from 'react';
import { CheckCircle2, Edit, ShieldCheck, TrendingUp } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { getEmployeeKpiKri, saveEmployeeKpiKri } from '../employeeDataHelpers';
import { PanelHeader } from './employeeUi';

const clampScore = (v) => Math.min(5, Math.max(1, Number(v) || 1));
const kriVariant = (level) => (/high|critical/i.test(level || '') ? 'warning' : 'success');

export function KpiKriTab({ employee, onShowToast }) {
  const [data, setData] = useState(() => getEmployeeKpiKri(employee.userid));
  const [isEditing, setIsEditing] = useState(false);
  const [score, setScore] = useState(() => data?.overall_rating ?? '');

  if (!data) {
    return (
      <div className="p-8 text-center text-[#5F6368]">
        No KPI or KRI evaluation has been recorded for {employee.first_name} yet.
      </div>
    );
  }

  const handleSave = () => {
    const rating = clampScore(score);
    const updated = { ...data, overall_rating: rating };
    setData(updated);
    setScore(rating);
    saveEmployeeKpiKri(employee.userid, updated);
    setIsEditing(false);
    onShowToast?.({
      type: 'success',
      title: 'Performance Scorecard Saved',
      message: `KPI & KRI evaluation score set to ${rating} / 5.0.`
    });
  };

  return (
    <div className="space-y-4 pt-1">
      <PanelHeader
        title="Key Performance & Risk Indicator Scorecard"
        subtitle={`Cycle: ${data.review_period} • Status: ${data.rating_category}`}
      >
        <Button
          variant={isEditing ? 'secondary' : 'primary'}
          size="xs"
          icon={isEditing ? CheckCircle2 : Edit}
          onClick={() => (isEditing ? handleSave() : setIsEditing(true))}
        >
          {isEditing ? 'Save Scores' : 'Edit Evaluation'}
        </Button>
      </PanelHeader>

      <div className="p-3.5 rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="text-[#5F6368]">Executive Rating Score</span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-xl font-semibold text-[#111827]">{score}</span>
            <span className="text-[#5F6368]">/ 5.0 Rating</span>
            <Badge variant="success">{data.rating_category}</Badge>
          </div>
        </div>

        {isEditing && (
          <div className="flex items-center gap-2">
            <label className="font-semibold text-[#27292C]">Set Score:</label>
            <input
              type="number"
              step="0.1"
              min="1"
              max="5"
              value={score}
              onChange={(e) => setScore(e.target.value)}
              className="w-16 text-center p-1 rounded border border-[#D1D5DB]"
            />
          </div>
        )}
      </div>

      <section className="space-y-2.5">
        <h5 className="font-semibold text-[#111827] flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-[#4F46E5]" />
          Key Performance Indicators (KPIs)
        </h5>
        <div className="space-y-2">
          {data.kpis.map((kpi) => (
            <div key={kpi.id} className="p-3 rounded-xl border border-[#E5E7EB] bg-white space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-[#111827]">{kpi.name}</p>
                  <p className="text-[#5F6368]">{kpi.description}</p>
                </div>
                <Badge variant={kpi.status === 'Exceeded' ? 'success' : 'neutral'}>
                  {kpi.status} ({kpi.score}/5.0)
                </Badge>
              </div>
              <div className="flex items-center gap-3 text-[#5F6368]">
                <span>Target: <strong className="text-[#111827]">{kpi.target}</strong></span>
                <span>•</span>
                <span>Achieved: <strong className="text-[#059669]">{kpi.achieved}</strong></span>
                <span>•</span>
                <span>Weight: <strong className="text-[#111827]">{kpi.weight}</strong></span>
              </div>
              <div className="w-full bg-[#F3F4F6] rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-[#4F46E5] h-1.5 rounded-full"
                  style={{ width: `${Math.min(100, (kpi.score / 5) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2.5 pt-1">
        <h5 className="font-semibold text-[#111827] flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-[#059669]" />
          Key Risk Indicators (KRIs) & Governance
        </h5>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {data.kris.map((kri) => (
            <div key={kri.id} className="p-3 rounded-xl border border-[#E5E7EB] bg-white space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-[#111827] leading-snug">{kri.name}</p>
                <Badge variant={kriVariant(kri.level)}>{kri.level}</Badge>
              </div>
              <p className="text-[#4B5563]"><strong>Indicator:</strong> {kri.indicator}</p>
              <p className="text-[#059669] font-semibold">
                Current: {kri.current_value} (Threshold: {kri.threshold})
              </p>
              <p className="text-[#6B7280] italic border-t border-[#F3F4F6] pt-1 mt-1">{kri.mitigation}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
