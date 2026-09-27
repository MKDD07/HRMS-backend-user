import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Download,
  Calendar,
  Filter,
  FileSpreadsheet,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  Clock,
  Printer
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { LeaveTrendChart } from '../../components/charts/LeaveTrendChart';

export function ReportsPage({
  api,
  onShowToast
}) {
  const [reports, setReports] = useState([]);
  const [dailyReports, setDailyReports] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState('September');

  useEffect(() => {
    async function loadReports() {
      try {
        const rRes = await api.getReportsSummary();
        if (rRes.data) setReports(rRes.data);

        const dRes = await api.getDailyWorkReports();
        if (dRes.data) setDailyReports(dRes.data);
      } catch (err) {
        console.error(err);
      }
    }
    loadReports();
  }, [api]);

  const handleExport = (reportName) => {
    if (onShowToast) {
      onShowToast({
        type: 'success',
        title: 'Export Generated',
        message: `${reportName} for ${selectedMonth} 2026 exported to CSV.`
      });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Executive Analytics"
        subtitle="Generate statutory compliance exports, employee shift audits, and annual workforce trends."
        breadcrumbs={['HRMS', 'Analytics']}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={Download}
              onClick={() => handleExport('Comprehensive HR Master Ledger')}
            >
              Export All Data
            </Button>
          </div>
        }
      />

      {/* Leave Utilization Trend Chart */}
      <div className="card p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-white font-display">
              6-Month Leave Pattern & Utilization
            </h3>
            <p className="text-[13px] text-slate-400">
              Analysis across Casual, Sick, and Privilege Leave categories
            </p>
          </div>
          <Badge variant="info">
            Seasonal Peak: August
          </Badge>
        </div>

        <LeaveTrendChart />
      </div>

      {/* Standard Statutory & Audit Reports List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reports.map((r) => (
          <div
            key={r.id}
            className="card p-5 space-y-3 flex flex-col justify-between hover:border-slate-700 transition-all"
          >
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white font-display">
                    {r.name}
                  </h4>
                  <span className="text-[11px] text-indigo-400 font-mono">
                    {r.category}
                  </span>
                </div>
                <Badge variant={r.status === 'Ready' ? 'success' : 'neutral'}>
                  {r.status}
                </Badge>
              </div>
              <p className="text-[13px] text-slate-400 mt-2">
                {r.description}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[13px]">
              <span className="text-slate-500 text-[11px]">
                Updated: {r.last_generated || 'Today, 06:00 AM'}
              </span>
              <Button
                variant="secondary"
                size="sm"
                icon={FileSpreadsheet}
                onClick={() => handleExport(r.name)}
              >
                Export CSV
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Daily Work Reports (DWR) Logs */}
      <div className="card p-0 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white font-display">
              Immutable Daily Work Report (DWR) Logs
            </h3>
            <p className="text-[13px] text-slate-400">
              Real-time daily task submissions locked by employees on date of work.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            icon={Download}
            onClick={() => handleExport('DWR Logs')}
          >
            Download Log
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Sprint / Project</th>
                <th className="py-3 px-4">Completed Deliverables</th>
                <th className="py-3 px-4">Hours</th>
                <th className="py-3 px-4">Lock Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {dailyReports.map((dwr) => (
                <tr key={dwr.id} className="hover:bg-slate-800/30">
                  <td className="py-2.5 px-4 text-slate-400">
                    {dwr.report_date}
                  </td>
                  <td className="py-2.5 px-4 font-bold text-white">
                    {dwr.employee_name}
                  </td>
                  <td className="py-2.5 px-4 text-indigo-300">
                    {dwr.project_name}
                  </td>
                  <td className="py-2.5 px-4 max-w-sm truncate text-slate-300">
                    {dwr.tasks_completed}
                  </td>
                  <td className="py-2.5 px-4 font-semibold text-slate-200">
                    {dwr.hours_spent}h
                  </td>
                  <td className="py-2.5 px-4">
                    <Badge variant="success">Locked & Verified</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
