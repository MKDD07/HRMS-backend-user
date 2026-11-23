import { TenantPanel } from '../../../components/ui/TenantPanel';
import { PayrollPersonSummary } from '../components/PayrollPersonSummary';
import { Button } from '../../../components/ui/Button';
import React, { useEffect, useState } from 'react';
import { Layers, Pencil, Trash2, Check, X } from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import { EmployeeDirectory } from '../../../components/employees/EmployeeDirectory';
import { AddRowForm } from '../components/AddRowForm';
import { addRowForUsers, deleteRow, describeScope, getRows, updateRow } from '../lib/customRowsStore';
import { fullName, inr } from '../lib/payrollHelpers';
import { IndiaStructureEditor } from '../components/IndiaStructureEditor';

/**
 * Tab 4: company-wide bands (read-only) + custom rows.
 * Single mode: rows for the clicked person. Multi mode: one row saved for every ticked person.
 */
export function StructureTab({ users, selectedUid, onSelect, year, month, onChanged, onToast, configuration, periodRecords, ledger, dataBusy, dataError }) {
  const [multi, setMulti] = useState(false);
  const [ids, setIds] = useState([]);
  const [rows, setRows] = useState([]);
  const [tick, setTick] = useState(0);
  const [editing, setEditing] = useState(null); // { id, name, amount }
  const [saving, setSaving] = useState(false);
  const schemas = configuration?.groups || [];

  const employee = users.find((u) => u.userid === selectedUid);
  const targets = multi ? ids : selectedUid ? [selectedUid] : [];

  useEffect(() => {
    setRows(selectedUid ? getRows(selectedUid) : []);
    setEditing(null);
  }, [selectedUid, tick, configuration]);

  const toggleMulti = () => {
    setIds(multi ? [] : selectedUid ? [selectedUid] : []);
    setMulti(!multi);
  };

  const refresh = () => {
    setTick((t) => t + 1);
    onChanged();
  };

  const perform = async action => {
    if (saving || dataBusy || dataError) return false;
    setSaving(true);
    try { await action(); return true; }
    catch (error) { onToast?.({ type: 'error', title: 'Component was not saved', message: error.message }); return false; }
    finally { setSaving(false); }
  };
  const save = row => perform(async () => {
    if (targets.length === 0) throw new Error('Select an employee.');
    await addRowForUsers(targets, row);
    refresh();
    onToast?.({
      type: 'success',
      title: 'Component saved to Cloudflare',
      message: `${row.name} (${inr(row.amount)}) added for ${targets.length} ${targets.length === 1 ? 'person' : 'people'}. ${describeScope(row.scope)}.`
    });
  });

  const remove = id => perform(async () => {
    await deleteRow(selectedUid, id);
    refresh();
  });

  const commitEdit = () => perform(async () => {
    await updateRow(selectedUid, editing.id, { name: editing.name.trim(), amount: Number(editing.amount) });
    refresh();
  });

  const targetLabel = multi
    ? `Applies to ${ids.length} selected ${ids.length === 1 ? 'person' : 'people'}`
    : `Applies to ${fullName(employee)}`;

  const headerToggle=<Button size="sm" variant={multi ? 'colored' : 'outline'} onClick={toggleMulti}>{multi?'Select one employee':'Select multiple'}</Button>;
  return <div className="employee-workspace payroll-structure"><div className="employee-workspace-content payroll-tab-stack">
    {employee && !multi && <PayrollPersonSummary employee={employee} detail="Recurring and one-time salary components"/>}
    {employee && !multi && <IndiaStructureEditor employee={employee} record={periodRecords?.[selectedUid]} previousSalary={ledger?.[selectedUid]?.[0]} year={year} month={month} onChanged={onChanged} onToast={onToast} dataBusy={dataBusy} dataError={dataError}/>}
    <TenantPanel title="Add a salary component" subtitle={multi?ids.length+' employees selected':targetLabel}><div className="payroll-panel-body">{targets.length ? <AddRowForm year={year} month={month} submitLabel="Save component" targetLabel={targetLabel} onSubmit={save}/> : <p className="tenant-empty">Select employees to add a component.</p>}</div></TenantPanel>
    <TenantPanel title="Saved components" subtitle={multi?'Select one employee to review their saved components.':rows.length+' components for '+fullName(employee)}><div className="payroll-panel-body payroll-saved-components">
      {multi ? <p className="payroll-muted">{ids.map(id=>fullName(users.find(person=>person.userid===id))).join(', ') || 'No employees selected.'}</p> : !rows.length ? <p className="tenant-empty">No custom components added.</p> : rows.map(row=><div key={row.id} className="payroll-component-row">{editing?.id===row.id ? <><label>Component name<input value={editing.name} onChange={event=>setEditing({...editing,name:event.target.value})}/></label><label>Amount<input type="number" min="0" step="0.01" value={editing.amount} onChange={event=>setEditing({...editing,amount:event.target.value})}/></label><div className="payroll-row-actions"><Button size="sm" variant="outline" onClick={() => setEditing(null)}>Cancel</Button><Button size="sm" variant="colored" disabled={!editing.name.trim() || !Number.isFinite(Number(editing.amount)) || Number(editing.amount) <= 0} onClick={commitEdit}>Save</Button></div></> : <><div><strong>{row.name}</strong><small>{row.type==='earning'?'Earning':'Deduction'} / {describeScope(row.scope)}</small></div><strong>{inr(row.amount)}</strong><div className="payroll-row-actions"><Button size="sm" variant="outline" iconOnly icon={Pencil} aria-label={'Edit ' + row.name} title="Edit component" onClick={() => setEditing({
  id: row.id,
  name: row.name,
  amount: row.amount
})} /><Button size="sm" variant="outline" iconOnly icon={Trash2} aria-label={'Delete ' + row.name} title="Delete component" onClick={() => remove(row.id)} /></div></>}</div>)}
    </div></TenantPanel>
    {schemas.length>0&&<TenantPanel title="Payroll groups" subtitle="Saved groups and their assigned payslip templates."><div className="payroll-panel-body payroll-saved-components">{schemas.map(schema=><div className="payroll-component-row" key={schema.id}><strong>{schema.name||'Payroll group'}</strong><span className="payroll-muted">{configuration?.templates?.find(template=>template.id===schema.template_id)?.name || 'No template assigned'}</span></div>)}</div></TenantPanel>}
  </div><div className="employee-workspace-directory"><EmployeeDirectory employees={users} selectedId={selectedUid} onSelect={person=>onSelect(person.userid)} multi={multi} selectedIds={ids} onToggle={id=>setIds(current=>current.includes(id)?current.filter(value=>value!==id):[...current,id])} onSelectAll={setIds} onClearAll={()=>setIds([])} headerAction={headerToggle} subtitle="Choose employees for salary components."/></div></div>;
}
