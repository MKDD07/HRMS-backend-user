import { payslipApi } from '../../../lib/payslipApi';
import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Copy, Plus, Save, Unlock, X, AlertCircle } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Avatar } from '../../../components/ui/Avatar';
import { getMonthlySalary, getInitialMonthlyRecord, saveMonthlySalary } from '../../../lib/salaryStore';
import { EmployeeDirectory } from '../../../components/employees/EmployeeDirectory';
import { AddRowForm } from '../components/AddRowForm';
import { DownloadIconButton } from '../components/DownloadIconButton';
import { addRowForUsers } from '../lib/customRowsStore';
import {
  DEDUCTION_FIELDS,
  EARNING_FIELDS,
  applyScopedRows,
  computeTotals,
  fullName,
  getMonthRecord,
  inr,
  isFinal,
  previousMonth,
  withTotals
} from '../lib/payrollHelpers';

const inputCls = 'w-full h-8 px-2.5 rounded-lg border border-[#e2e9da] text-[13px] text-[#3e5432] disabled:bg-[#f2f5ed] disabled:text-[#98a58d]';

function NumberField({ label, value, onChange, disabled }) {
  return (
    <div>
      <label className="block text-[#7d8e70] mb-1 text-[13px]">{label}</label>
      <input type="number" disabled={disabled} value={value ?? 0} onChange={(e) => onChange(Number(e.target.value))} className={inputCls} />
    </div>
  );
}

/** Tab 2: edit one person's month (left), pick person (right). Draft, then finalize. */
export function ProcessingTab({ users, selectedUid, onSelect, year, month, version, onChanged, onToast, onDownload }) {
  const employee = users.find((u) => u.userid === selectedUid);
  const [form, setForm] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false), [loadError, setLoadError] = useState('');

  useEffect(() => {
    let active = true; setForm(null); setLoadError(''); setShowAdd(false);
    if (!employee) return;
    payslipApi.records(employee.userid).then(records => {
      if (!active) return;
      const saved = records.find(record => record.month === month && record.year === String(year));
      const rec = saved ? { ...saved.salary, year, month, user_id: employee.userid } : getMonthlySalary(employee.userid, year, month) || getInitialMonthlyRecord(employee.userid, year, month);
      setForm(JSON.parse(JSON.stringify(applyScopedRows(rec, employee.userid, year, month))));
    }).catch(error => { if (active) setLoadError(error.message); });
    return () => { active = false; };
  }, [selectedUid, year, month, version]);

  const totals = useMemo(() => computeTotals(form), [form]);
  const locked = isFinal(form);
  const negative = totals.net < 0;
  const name = fullName(employee);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const persist = async (status, extra = {}) => {
    if (saving || !form) return;
    setSaving(true);
    try {
      const rec = withTotals({ ...form, employee_name: name, status, ...extra });
      const issued = await payslipApi.saveSalary({ employee, salary: rec, month, year });
      saveMonthlySalary(employee.userid, year, month, rec); setForm(rec); onChanged();
      window.dispatchEvent(new Event('payslip-records-changed'));
      onToast?.({ type: issued.status === 'failed' ? 'warning' : 'success', title: 'Salary saved', message: issued.status === 'failed' ? issued.error : issued.status === 'ready' ? 'PDF stored in R2.' : 'Salary saved; generation is pending.' });
    } catch (error) { onToast?.({ type: 'error', title: 'Salary was not saved', message: error.message }); } finally { setSaving(false); }
  };
  const saveDraft = () => persist('Draft', { updated_at: new Date().toISOString() });
  const finalize = () => { if (!negative) return persist('Finalized', { finalized_at: new Date().toISOString() }); };
  const unlock = () => persist('Draft', { finalized_at: null });

  const copyLastMonth = () => {
    const prev = previousMonth(year, month);
    const last = getMonthlySalary(employee.userid, prev.year, prev.month);
    if (!last) {
      onToast?.({ type: 'warning', title: 'Nothing to copy', message: `No saved salary for ${prev.month} ${prev.year}.` });
      return;
    }
    const keys = [...EARNING_FIELDS, ...DEDUCTION_FIELDS].map(([k]) => k);
    setForm((f) => {
      const next = { ...f };
      keys.forEach((k) => (next[k] = last[k] ?? 0));
      return next;
    });
    onToast?.({ type: 'info', title: 'Copied', message: `Values from ${prev.month} ${prev.year}. Save the draft to keep them.` });
  };

  const removeCustom = (listKey, item) => {
    setForm((f) => ({
      ...f,
      [listKey]: f[listKey].filter((c) => c.id !== item.id),
      // a removed scoped row must not come back for this month
      skipped_row_ids: item.row_id ? [...(f.skipped_row_ids || []), item.row_id] : f.skipped_row_ids
    }));
  };

  const editCustom = (listKey, idx, amount) =>
    setForm((f) => ({ ...f, [listKey]: f[listKey].map((c, i) => (i === idx ? { ...c, amount } : c)) }));

  const addRow = (row) => {
    addRowForUsers([employee.userid], row);
    setForm((f) => applyScopedRows(f, employee.userid, year, month));
    setShowAdd(false);
    onToast?.({ type: 'success', title: 'Row added', message: `${row.name} added for ${name}.` });
  };

  const renderCustom = (listKey, tone) =>
    (form[listKey] || []).map((c, idx) => (
      <div key={c.id || idx}>
        <label className={`flex items-center justify-between mb-1 text-[13px] font-semibold ${tone}`}>
          <span>{c.name}{c.source === 'scoped' ? ' (from structure)' : ' (custom)'}</span>
          {!locked && (
            <button type="button" onClick={() => removeCustom(listKey, c)} title="Remove from this month" className="text-[#98a58d] hover:text-[#DC2626]">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </label>
        <input type="number" disabled={locked || saving} value={c.amount || 0} onChange={(e) => editCustom(listKey, idx, Number(e.target.value))} className={inputCls} />
      </div>
    ));

  return (
    <div className="employee-workspace">
      <div className="employee-workspace-content space-y-4">
        {!form ? (
          <div className="card p-12 text-center text-[13px] text-[#7d8e70]">{loadError || (employee ? 'Loading saved salary...' : 'Pick a person on the right to edit their salary.')}</div>
        ) : (
          <>
            <div className="card p-4 bg-white border border-[#e2e9da] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Avatar src={employee?.profile_pic_url} avatarId={employee?.avatar_id} name={name} size="md" />
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-[#3e5432]">{name}</h4>
                    <span className="text-[13px] text-[#587443] font-bold bg-[#f0f5e9] px-1.5 rounded">{employee?.userid}</span>
                    <Badge variant={locked ? 'success' : 'warning'}>{form.status || 'Draft'}</Badge>
                  </div>
                  <p className="text-[13px] text-[#7d8e70]">{month} {year}{locked ? ' · locked' : ''}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <DownloadIconButton size="md" onClick={() => onDownload(employee, form)} />
                {locked ? (
                  <Button variant="secondary" size="sm" icon={Unlock} disabled={saving} onClick={unlock}>Unlock</Button>
                ) : (
                  <>
                    <Button variant="outline" size="sm" icon={Copy} onClick={copyLastMonth}>Copy last month</Button>
                    <Button variant="outline" size="sm" icon={Plus} onClick={() => setShowAdd((s) => !s)}>Add row</Button>
                    <Button variant="secondary" size="sm" icon={Save} disabled={saving} onClick={saveDraft}>Save draft</Button>
                    <Button variant="primary" size="sm" icon={CheckCircle2} disabled={negative || saving} onClick={finalize}>Finalize salary</Button>
                  </>
                )}
              </div>
            </div>

            {negative && !locked && (
              <div className="flex items-center gap-2 text-[13px] text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] rounded-lg p-2.5">
                <AlertCircle className="w-4 h-4" />
                Deductions are higher than earnings. Reduce a deduction before finalizing.
              </div>
            )}

            {showAdd && !locked && (
              <AddRowForm
                year={year}
                month={month}
                submitLabel="Add row"
                targetLabel={`Adds to ${name} only`}
                onSubmit={addRow}
              />
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="card p-4 bg-white border border-[#e2e9da] space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#edf1e7]">
                  <span className="text-[13px] font-bold text-[#486537]">Earnings and allowances</span>
                  <strong className="text-[13px] text-[#486537]">{inr(totals.gross)}</strong>
                </div>
                <div className="space-y-2.5">
                  {EARNING_FIELDS.map(([key, label]) => (
                    <NumberField key={key} label={label} value={form[key]} disabled={locked} onChange={(v) => set(key, v)} />
                  ))}
                  {renderCustom('custom_earnings', 'text-[#587443]')}
                </div>
              </div>

              <div className="card p-4 bg-white border border-[#e2e9da] space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#edf1e7]">
                  <span className="text-[13px] font-bold text-[#EF4444]">Deductions and taxes</span>
                  <strong className="text-[13px] text-[#EF4444]">{inr(totals.deductions)}</strong>
                </div>
                <div className="space-y-2.5">
                  {DEDUCTION_FIELDS.map(([key, label]) => (
                    <NumberField key={key} label={label} value={form[key]} disabled={locked} onChange={(v) => set(key, v)} />
                  ))}
                  {renderCustom('custom_deductions', 'text-[#DC2626]')}
                </div>

                <div className="pt-3 border-t border-[#edf1e7]">
                  <div className="p-3 bg-[#f8faf5] rounded-xl border border-[#e2e9da] space-y-1 text-[13px] text-[#7d8e70]">
                    <div className="flex justify-between"><span>Gross</span><strong className="text-[#3e5432]">{inr(totals.gross)}</strong></div>
                    <div className="flex justify-between"><span>Deductions</span><strong className="text-[#EF4444]">-{inr(totals.deductions)}</strong></div>
                    <div className="flex justify-between pt-1 border-t border-[#e2e9da]">
                      <span className="font-bold text-[#3e5432]">Net payable</span>
                      <strong className={`text-sm ${negative ? 'text-[#EF4444]' : 'text-[#486537]'}`}>{inr(totals.net)}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="employee-workspace-directory">
        <EmployeeDirectory
          employees={users}
          selectedId={selectedUid}
          onSelect={(e) => onSelect(e.userid)}
          subtitle="Select a person to edit their monthly payroll."
          renderMeta={(emp) => {
            const rec = getMonthRecord(emp, year, month);
            return (
              <div className="flex items-center justify-between">
                <Badge variant={isFinal(rec) ? 'success' : 'warning'}>{isFinal(rec) ? 'Finalized' : 'Draft'}</Badge>
                <strong className="text-[11px] text-[#486537]">{inr(rec.monthly_net)}</strong>
              </div>
            );
          }}
        />
      </div>
    </div>
  );
}
