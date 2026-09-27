import React, { useState, useEffect } from 'react';
import {
  Briefcase,
  Plus,
  Users,
  Search,
  CheckCircle2,
  Calendar,
  Mail,
  Phone,
  FileText,
  ChevronRight,
  UserPlus,
  ArrowRight
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Tabs } from '../../components/ui/Tabs';
import { Modal } from '../../components/ui/Modal';
import { FilterBar } from '../../components/ui/FilterBar';

export function RecruitmentPage({
  api,
  onShowToast
}) {
  const [activeTab, setActiveTab] = useState('pipeline');
  const [jobs, setJobs] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [isAddJobOpen, setIsAddJobOpen] = useState(false);

  // New Job Form
  const [jobTitle, setJobTitle] = useState('');
  const [jobDept, setJobDept] = useState('Engineering');
  const [jobLocation, setJobLocation] = useState('HQ Vashi / Hybrid');
  const [jobExperience, setJobExperience] = useState('3-5 Years');

  const loadData = async () => {
    try {
      const jRes = await api.getJobOpenings();
      if (jRes.data) setJobs(jRes.data);

      const cRes = await api.getCandidates();
      if (cRes.data) setCandidates(cRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateJob = async (e) => {
    e.preventDefault();
    try {
      await api.createJobOpening({
        title: jobTitle,
        department: jobDept,
        location: jobLocation,
        experience: jobExperience,
        open_positions: 2,
        status: 'Open'
      });
      setIsAddJobOpen(false);
      setJobTitle('');
      await loadData();
      if (onShowToast) {
        onShowToast({
          type: 'success',
          title: 'Opening Published',
          message: `${jobTitle} requisition is now active in ATS.`
        });
      }
    } catch (err) {
      if (onShowToast) {
        onShowToast({
          type: 'error',
          title: 'Publish Error',
          message: err.message
        });
      }
    }
  };

  const handleAdvanceCandidate = async (candidateId, nextStage) => {
    try {
      await api.updateCandidateStage(candidateId, nextStage);
      await loadData();
      if (onShowToast) {
        onShowToast({
          type: 'success',
          title: 'Candidate Advanced',
          message: `Moved candidate to ${nextStage} stage.`
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');

  const filteredCandidates = candidates.filter((c) => {
    const term = search.toLowerCase();
    const matchesSearch =
      (c.name || '').toLowerCase().includes(term) ||
      (c.role_applied || '').toLowerCase().includes(term) ||
      (c.email || '').toLowerCase().includes(term);
    const matchesDept = selectedDept === 'All' || (c.department || '') === selectedDept;
    return matchesSearch && matchesDept;
  });

  const filteredJobs = jobs.filter((j) => {
    const term = search.toLowerCase();
    const matchesSearch =
      (j.title || '').toLowerCase().includes(term) ||
      (j.location || '').toLowerCase().includes(term);
    const matchesDept = selectedDept === 'All' || (j.department || '') === selectedDept;
    return matchesSearch && matchesDept;
  });

  const PIPELINE_STAGES = [
    { id: 'Applied', title: 'Applied / In Review', color: 'border-[#CBD5E1]' },
    { id: 'Screening', title: 'HR Screening', color: 'border-[#818CF8]' },
    { id: 'Technical', title: 'Tech Evaluation', color: 'border-[#FCD34D]' },
    { id: 'Interview', title: 'Executive Bar Raiser', color: 'border-[#67E8F9]' },
    { id: 'Offered', title: 'Offer Extended', color: 'border-[#6EE7B7]' }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recruitment & Talent ATS"
        subtitle="Track job requisitions, manage applicant pipeline stages, and streamline enterprise hiring."
        breadcrumbs={['HRMS', 'ATS']}
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={Plus}
            onClick={() => setIsAddJobOpen(true)}
          >
            Create Job Requisition
          </Button>
        }
      />

      {/* Tabs */}
      <Tabs
        tabs={[
          { id: 'pipeline', label: 'Candidate Pipeline Board' },
          { id: 'jobs', label: `Active Openings (${filteredJobs.length})` }
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {/* Universal FilterBar */}
      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={activeTab === 'pipeline' ? "Filter candidates by name, role, email..." : "Filter openings by job title or location..."}
      >
        <select
          value={selectedDept}
          onChange={(e) => setSelectedDept(e.target.value)}
          className="filter-bar__select text-[13px]"
        >
          <option value="All">All Departments</option>
          <option value="Engineering & Technology">Engineering & Technology</option>
          <option value="Engineering">Engineering</option>
          <option value="Human Resources">Human Resources</option>
          <option value="Product & Design">Product & Design</option>
          <option value="Executive Leadership">Executive Leadership</option>
          <option value="Finance & Accounts">Finance & Accounts</option>
        </select>
      </FilterBar>

      {/* Candidate Pipeline Kanban Board */}
      {activeTab === 'pipeline' && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {PIPELINE_STAGES.map((stage) => {
            const stageCandidates = filteredCandidates.filter((c) => c.stage === stage.id);

            return (
              <div
                key={stage.id}
                className={`bg-[#FFFFFF] border ${stage.color} rounded-xl p-3 flex flex-col min-h-[460px] shadow-2xs`}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-[#E5E7EB]">
                  <h4 className="text-[13px] font-bold text-[#27292C]">
                    {stage.title}
                  </h4>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#F3F4F6] text-[#4F46E5] font-semibold">
                    {stageCandidates.length}
                  </span>
                </div>

                {/* Candidate Cards */}
                <div className="space-y-2.5 flex-1">
                  {stageCandidates.length === 0 ? (
                    <div className="h-32 flex items-center justify-center text-[11px] text-[#9CA3AF] border border-dashed border-[#E5E7EB] rounded-lg">
                      No candidates
                    </div>
                  ) : (
                    stageCandidates.map((c) => (
                      <div
                        key={c.id}
                        className="p-3 bg-[#F9FAFB] border border-[#E5E7EB] hover:border-[#CBD5E1] rounded-lg space-y-2 transition-all group shadow-2xs"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h5 className="text-[13px] font-bold text-[#27292C] group-hover:text-[#4F46E5] transition-colors">
                              {c.name}
                            </h5>
                            <p className="text-[11px] text-[#4F46E5] font-medium">
                              {c.role_applied}
                            </p>
                          </div>
                          <span className="text-[10px] text-[#5F6368] font-mono">
                            {c.experience}
                          </span>
                        </div>

                        <div className="text-[11px] text-[#5F6368] space-y-0.5">
                          <p className="truncate">{c.email}</p>
                          <p className="text-[#9CA3AF]">{c.applied_date}</p>
                        </div>

                        {/* Stage progress action */}
                        <div className="pt-2 border-t border-[#E5E7EB] flex items-center justify-between">
                          <span className="text-[10px] text-[#000000] font-semibold">
                            Score: {c.score || '88/100'}
                          </span>
                          {stage.id !== 'Offered' && (
                            <button
                              type="button"
                              onClick={() => {
                                const nextStageIndex = PIPELINE_STAGES.findIndex((s) => s.id === stage.id) + 1;
                                if (nextStageIndex < PIPELINE_STAGES.length) {
                                  handleAdvanceCandidate(c.id, PIPELINE_STAGES[nextStageIndex].id);
                                }
                              }}
                              className="text-[10px] text-[#4F46E5] hover:text-[#4338CA] flex items-center gap-1 font-semibold cursor-pointer"
                            >
                              Advance <ArrowRight className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Active Jobs Tab */}
      {activeTab === 'jobs' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredJobs.map((job) => (
            <div key={job.id} className="card p-5 space-y-4 hover:border-[#CBD5E1] transition-all bg-white border border-[#E5E7EB]">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-bold text-[#27292C]">
                    {job.title}
                  </h3>
                  <p className="text-[13px] text-[#4F46E5] font-medium mt-0.5">
                    {job.department} • {job.experience}
                  </p>
                </div>
                <Badge variant={job.status === 'Open' ? 'success' : 'neutral'}>
                  {job.status}
                </Badge>
              </div>

              <div className="text-[13px] text-[#5F6368] space-y-1.5 bg-[#F9FAFB] p-3 rounded-lg border border-[#E5E7EB]">
                <p>Location: <strong className="text-[#27292C]">{job.location}</strong></p>
                <p>Open Positions: <strong className="text-[#000000]">{job.open_positions} Headcount</strong></p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[#E5E7EB] text-[13px]">
                <span className="text-[#9CA3AF]">Posted {job.created_at || 'Recent'}</span>
                <Button variant="secondary" size="sm">
                  View Applicants
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Requisition Modal */}
      <Modal
        isOpen={isAddJobOpen}
        onClose={() => setIsAddJobOpen(false)}
        title="Create Job Requisition"
      >
        <form onSubmit={handleCreateJob} className="space-y-4">
          <div>
            <label className="block text-[13px] font-semibold text-slate-300 mb-1">
              Job Title *
            </label>
            <input
              type="text"
              required
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="e.g. Senior Backend Engineer (Node/Go)"
              className="w-full text-[13px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[13px] font-semibold text-slate-300 mb-1">
                Department
              </label>
              <select
                value={jobDept}
                onChange={(e) => setJobDept(e.target.value)}
                className="w-full h-10 text-[13px]"
              >
                <option value="Engineering">Engineering</option>
                <option value="Product & Design">Product & Design</option>
                <option value="Sales & Ops">Sales & Ops</option>
                <option value="Human Resources">Human Resources</option>
              </select>
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-slate-300 mb-1">
                Experience Band
              </label>
              <input
                type="text"
                value={jobExperience}
                onChange={(e) => setJobExperience(e.target.value)}
                className="w-full text-[13px]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-slate-300 mb-1">
              Work Location & Mode
            </label>
            <input
              type="text"
              value={jobLocation}
              onChange={(e) => setJobLocation(e.target.value)}
              className="w-full text-[13px]"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsAddJobOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Publish Requisition
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
