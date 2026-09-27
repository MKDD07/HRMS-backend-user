import React, { useEffect, useState } from 'react';
import { Layers, Pencil, Trash2, Check, X } from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import { getAllSalarySchemas } from '../../../lib/salaryStore';
import { EmployeeDirectory } from '../../../components/employees/EmployeeDirectory';
import { AddRowForm } from '../components/AddRowForm';
import { addRowForUsers, deleteRow, describeScope, getRows, updateRow } from '../lib/customRowsStore';
import { fullName, inr } from '../lib/payrollHelpers';

/**
 * Tab 4: company-wide bands (read-only) + custom rows.
 * Single mode: rows for the clicked person. Multi mode: one row saved for every ticked person.
 */
export function StructureTab({ users, selectedUid, onSelect, year, month, onChanged, onToast }) {
  const [multi, setMulti] = useState(false);
  const [ids, setIds] = useState([]);
  const [rows, setRows] = useState([]);
  const [tick, setTick] = useState(0);
  const [editing, setEditing] = useState(null); // { id, name, amount }
  const schemas = getAllSalarySchemas();

  const employee = users.find((u) => u.userid === selectedUid);
  const targets = multi ? ids : selectedUid ? [selectedUid] : [];

  useEffect(() => {
    setRows(selectedUid ? getRows(selectedUid) : []);
    setEditing(null);
  }, [selectedUid, tick]);

  const toggleMulti = () => {
    setIds(multi ? [] : selectedUid ? [selectedUid] : []);
    setMulti(!multi);
  };

  const refresh = () => {
    setTick((t) => t + 1);
    onChanged();
  };

  const save = (row) => {
    if (targets.length === 0) return;
    addRowForUsers(targets, row);
    refresh();
    onToast?.({
      type: 'success',
      title: 'Saved to database',
      message: `${row.name} (${inr(row.amount)}) added for ${targets.length} ${targets.length === 1 ? 'person' : 'people'}. ${describeScope(row.scope)}.`
    });
  };

  const remove = (id) => {
    deleteRow(selectedUid, id);
    refresh();
  };

  const commitEdit = () => {
    updateRow(selectedUid, editing.id, { name: editing.name.trim(), amount: Number(editing.amount) });
    refresh();
  };

  const targetLabel = multi
    ? `Applies to ${ids.length} selected ${ids.length === 1 ? 'person' : 'people'}`
    : `Applies to ${fullName(employee)}`;

  const headerToggle = (
    <button
      type="button"
      onClick={toggleMulti}
      className={`w-full h-8 rounded-lg border text-[13px] font-semibold ${multi ? 'bg-[#587443] border-[#587443] text-white' : 'bg-white border-[#e2e9da] text-[#3e5432]'
        }`}
    >
      {multi ? 'Selecting multiple. Tap to go back to one person' : 'Select multiple people'}
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="employee-workspace">
        <div className="employee-workspace-content space-y-4">
          <div className="card p-5 bg-white border border-[#e2e9da] space-y-4">
            <div className="pb-3 border-b border-[#edf1e7]">
              <h4 className="text-sm font-bold text-[#3e5432]">
                Custom pay rows for {multi ? `${ids.length} selected people` : fullName(employee)}
              </h4>
              <p className="text-[13px] text-[#7d8e70]">
                Rows saved here appear on the salary draft for every month you choose.
              </p>
            </div>

            {targets.length === 0 ? (
              <p className="text-[13px] text-[#7d8e70] py-6 text-center">Tick at least one person on the right to add a row.</p>
            ) : (
              <AddRowForm year={year} month={month} submitLabel="Save to database" targetLabel={targetLabel} onSubmit={save} />
            )}

            {multi ? (
              <div className="text-[13px] text-[#7d8e70]">
                {ids.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {ids.map((id) => (
                      <span key={id} className="px-2 py-0.5 rounded-full bg-[#f0f5e9] text-[#587443] font-medium">
                        {fullName(users.find((u) => u.userid === id))}
                      </span>
                    ))}
                  </div>
                )}
                <p className="mt-2">Switch back to one person to see and edit their saved rows.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <h5 className="text-[13px] font-bold text-[#7d8e70]">Saved rows ({rows.length})</h5>
                {rows.length === 0 ? (
                  <p className="text-[13px] text-[#7d8e70] italic">No custom rows yet for {fullName(employee)}.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {rows.map((r) => {
                      const earning = r.type === 'earning';
                      const isEditing = editing?.id === r.id;
                      return (
                        <div
                          key={r.id}
                          className={`p-3 rounded-lg border text-[13px] ${earning ? 'border-[#486537]/30 bg-[#ECFDF5]/40' : 'border-[#EF4444]/30 bg-[#FEF2F2]/40'
                            }`}
                        >
                          {isEditing ? (
                            <div className="space-y-2">
                              <input
                                className="w-full h-7 px-2 rounded border border-[#e2e9da] bg-white"
                                value={editing.name}
                                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                              />
                              <input
                                type="number"
                                className="w-full h-7 px-2 rounded border border-[#e2e9da] bg-white font-mono"
                                value={editing.amount}
                                onChange={(e) => setEditing({ ...editing, amount: e.target.value })}
                              />
                              <div className="flex justify-end gap-1">
                                <button type="button" onClick={() => setEditing(null)} className="p-1 text-[#7d8e70]" title="Cancel"><X className="w-3.5 h-3.5" /></button>
                                <button type="button" onClick={commitEdit} className="p-1 text-[#486537]" title="Save"><Check className="w-3.5 h-3.5" /></button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="font-semibold text-[#3e5432]">{r.name}</span>
                                <span className={`block font-semibold ${earning ? 'text-[#486537]' : 'text-[#EF4444]'}`}>
                                  {earning ? '+' : '-'}{inr(r.amount)} / month
                                </span>
                                <span className="block text-[11px] text-[#7d8e70] mt-0.5">{describeScope(r.scope)}</span>
                              </div>
                              <div className="flex items-center">
                                <button type="button" onClick={() => setEditing({ id: r.id, name: r.name, amount: r.amount })} className="p-1 text-[#7d8e70] hover:text-[#587443]" title="Edit row"><Pencil className="w-3.5 h-3.5" /></button>
                                <button type="button" onClick={() => remove(r.id)} className="p-1 text-[#DC2626]" title="Delete row"><Trash2 className="w-3.5 h-3.5" /></button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                <p className="text-[11px] text-[#7d8e70]">Finalized months are never changed by edits here.</p>
              </div>
            )}
          </div>

          <div className="card p-5 bg-white border border-[#e2e9da] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#edf1e7]">
              <div>
                <h4 className="text-sm font-bold text-[#3e5432] flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  Company-wide standard structures
                </h4>
                <p className="text-[13px] text-[#7d8e70]">Same for everyone. Custom rows above sit on top of these.</p>
              </div>
              <Badge variant="neutral">{schemas.length} bands</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {schemas.map((s) => (
                <div key={s.salary_id} className="p-4 rounded-xl border border-[#e2e9da] bg-white">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-[#587443] bg-[#f0f5e9] px-2 py-0.5 rounded">{s.salary_id}</span>
                    <span className="text-[11px] text-[#7d8e70]">{s.assigned_count ?? 0} staff</span>
                  </div>
                  <h5 className="font-bold text-[13px] text-[#3e5432] mt-2">{s.name}</h5>
                  <p className="text-[11px] text-[#7d8e70] mt-1 line-clamp-2">{s.description}</p>
                  <div className="mt-3 pt-2 border-t border-[#edf1e7] flex items-center justify-between text-[11px]">
                    <span className="text-[#7d8e70]">Base range</span>
                    <strong className="text-[#3e5432]">{s.annual_base_range}</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="employee-workspace-directory">
          <EmployeeDirectory
            employees={users}
            selectedId={selectedUid}
            onSelect={(e) => onSelect(e.userid)}
            subtitle={multi ? 'Select people for custom pay rows.' : 'Select a person to manage their pay structure.'}
            multi={multi}
            selectedIds={ids}
            onToggle={(id) => setIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))}
            onSelectAll={setIds}
            onClearAll={() => setIds([])}
            headerExtra={headerToggle}
          />
        </div>
      </div>
    </div>
  );
}
