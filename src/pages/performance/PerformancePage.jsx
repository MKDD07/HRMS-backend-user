import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Award,
  Target,
  BookOpen,
  Plus,
  Star,
  CheckCircle2,
  Clock,
  ChevronRight,
  Flame
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Tabs } from '../../components/ui/Tabs';
import { Modal } from '../../components/ui/Modal';
import { Progress } from '../../components/ui/Progress';
import { EmployeeDirectory } from '../../components/employees/EmployeeDirectory';

export function PerformancePage({
  api,
  currentUser,
  onShowToast
}) {
  const [activeTab, setActiveTab] = useState('goals');
  const [goals, setGoals] = useState([]);
  const [appraisals, setAppraisals] = useState([]);
  const [courses, setCourses] = useState([]);
  const [people, setPeople] = useState([]);
  const [selectedPerson, setSelectedPerson] = useState(currentUser || null);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);

  // New Goal State
  const [goalTitle, setGoalTitle] = useState('');
  const [goalQuarter, setGoalQuarter] = useState('Q3 2026');
  const [goalProgress, setGoalProgress] = useState(25);

  const loadData = async () => {
    try {
      const gRes = await api.getPerformanceGoals();
      if (gRes.data) setGoals(gRes.data);

      const aRes = await api.getAppraisals();
      if (aRes.data) setAppraisals(aRes.data);

      const cRes = await api.getCourses();
      if (cRes.data) setCourses(cRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    async function loadPeople() {
      try {
        const res = await api.getAllUsers();
        if (res?.data) {
          setPeople(res.data);
          if (!selectedPerson && res.data.length > 0) {
            setSelectedPerson(res.data[0]);
          }
        }
      } catch (err) {
        console.error('Failed to load people for performance panel:', err);
      }
    }

    if (api?.getAllUsers) {
      loadPeople();
    }
  }, [api, selectedPerson]);

  const handleCreateGoal = async (e) => {
    e.preventDefault();
    try {
      await api.createPerformanceGoal({
        title: goalTitle,
        quarter: goalQuarter,
        progress: Number(goalProgress),
        status: 'In Progress',
        assignee: `${currentUser.first_name} ${currentUser.last_name}`
      });
      setIsGoalModalOpen(false);
      setGoalTitle('');
      await loadData();
      if (onShowToast) {
        onShowToast({
          type: 'success',
          title: 'OKR Goal Registered',
          message: 'Quarterly key result mapped to performance tracker.'
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Performance & L&D Management"
        subtitle="Quarterly OKR tracking, continuous appraisal cycles, and employee learning certifications."
        breadcrumbs={['HRMS', 'Performance']}
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={Plus}
            onClick={() => setIsGoalModalOpen(true)}
          >
            Add Quarterly Goal
          </Button>
        }
      />

      {/* Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[13px] text-slate-400">Quarterly Target Completion</span>
            <h4 className="text-xl font-bold text-white font-display">78.5%</h4>
            <span className="text-[11px] text-emerald-400">On track for Q3 2026</span>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <Star className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[13px] text-slate-400">Average Performance Rating</span>
            <h4 className="text-xl font-bold text-white font-display">4.8 / 5.0</h4>
            <span className="text-[11px] text-slate-400">Top 10% organization-wide</span>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[13px] text-slate-400">Completed L&D Certifications</span>
            <h4 className="text-xl font-bold text-white font-display">6 Completed</h4>
            <span className="text-[11px] text-indigo-400">42 Hours logged</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-4">
          <Tabs
            tabs={[
              { id: 'goals', label: 'Quarterly OKRs & Goals' },
              { id: 'appraisals', label: 'Appraisal Reviews' },
              { id: 'l&d', label: 'Learning & Development' }
            ]}
            activeTab={activeTab}
            onChange={setActiveTab}
          />

          {/* OKRs & Goals Tab */}
          {activeTab === 'goals' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {goals.map((g) => (
            <div key={g.id} className="card p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white">{g.title}</h4>
                  <p className="text-[13px] text-slate-400 mt-0.5">
                    {g.quarter} • Owner: {g.assignee}
                  </p>
                </div>
                <Badge variant={g.progress >= 80 ? 'success' : 'info'}>
                  {g.status}
                </Badge>
              </div>

              <div className="space-y-1.5 pt-2">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-slate-400">Progress</span>
                  <span className="font-bold text-white">{g.progress}%</span>
                </div>
                <Progress value={g.progress} variant={g.progress >= 80 ? 'success' : 'primary'} />
              </div>

              <div className="text-[11px] text-slate-500 flex items-center justify-between pt-2 border-t border-slate-800">
                <span>Key Metric: Reliability & Uptime</span>
                <span className="text-indigo-400 font-medium">Sprint 18</span>
              </div>
            </div>
          ))}
        </div>
      )}

          {/* Appraisals Tab */}
          {activeTab === 'appraisals' && (
        <div className="card p-0 overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white font-display">
              Annual & Mid-Year Appraisal Cycle
            </h3>
            <Badge variant="info">Cycle: 2025-2026</Badge>
          </div>

          <div className="divide-y divide-slate-800/60">
            {appraisals.map((item) => (
              <div key={item.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-white">{item.cycle_name}</h4>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-semibold">
                      Final Score: {item.rating} / 5.0
                    </span>
                  </div>
                  <p className="text-[13px] text-slate-400 mt-1 max-w-xl leading-relaxed">
                    Manager Review: "{item.manager_feedback}"
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[13px] text-slate-400 block">Reviewed by</span>
                  <p className="text-[13px] font-bold text-slate-200">{item.reviewer_name}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

          {/* L&D Tab */}
          {activeTab === 'l&d' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((course) => (
            <div key={course.id} className="card p-5 space-y-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
                <BookOpen className="w-5 h-5" />
              </div>

              <div>
                <h4 className="text-sm font-bold text-white">{course.title}</h4>
                <p className="text-[13px] text-slate-400 mt-0.5">{course.provider} • {course.duration_hours} Hours</p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Completion</span>
                  <span className="font-semibold text-white">{course.progress}%</span>
                </div>
                <Progress value={course.progress} variant={course.progress === 100 ? 'success' : 'primary'} />
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[13px]">
                <span className="text-slate-500">Badge Earned</span>
                <span className="text-emerald-400 font-medium">Verified</span>
              </div>
            </div>
          ))}
        </div>
      )}

        </div>

        <EmployeeDirectory
          employees={people}
          selectedId={selectedPerson?.userid || null}
          onSelect={(person) => setSelectedPerson(person)}
        />
      </div>

      {/* Add Goal Modal */}
      <Modal
        isOpen={isGoalModalOpen}
        onClose={() => setIsGoalModalOpen(false)}
        title="Add Quarterly OKR Goal"
      >
        <form onSubmit={handleCreateGoal} className="space-y-4">
          <div>
            <label className="block text-[13px] font-semibold text-slate-300 mb-1">
              Objective & Key Result (OKR) Title *
            </label>
            <input
              type="text"
              required
              value={goalTitle}
              onChange={(e) => setGoalTitle(e.target.value)}
              placeholder="e.g. Optimize CI/CD pipeline latency by 35%"
              className="w-full text-[13px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[13px] font-semibold text-slate-300 mb-1">
                Quarter Target
              </label>
              <select
                value={goalQuarter}
                onChange={(e) => setGoalQuarter(e.target.value)}
                className="w-full h-10 text-[13px]"
              >
                <option value="Q3 2026">Q3 2026 (Jul - Sep)</option>
                <option value="Q4 2026">Q4 2026 (Oct - Dec)</option>
                <option value="Q1 2027">Q1 2027 (Jan - Mar)</option>
              </select>
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-slate-300 mb-1">
                Current Progress % ({goalProgress}%)
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={goalProgress}
                onChange={(e) => setGoalProgress(e.target.value)}
                className="w-full mt-2"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsGoalModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Save OKR Goal
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
