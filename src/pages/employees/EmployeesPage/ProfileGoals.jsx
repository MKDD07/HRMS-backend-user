import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { talentApi } from '../../../lib/talentApi';
import { GoalCard } from './GoalCard';
import { GoalsSkeleton } from './GoalsSkeleton';
import './ProfileGoals.scss';

const blankResult = () => ({ title: '', target: '', current: 0, formId: crypto.randomUUID() });

function GoalForm({ goal, employeeId, onSaved, onCancel }) {
  const [draft, setDraft] = useState(() => ({ ...goal, title: goal.title || '', due_date: goal.due_date || '', status: goal.status || 'Not started', notes: goal.notes || '', key_results: goal.key_results?.length ? goal.key_results.map(result => ({ ...result, formId: crypto.randomUUID() })) : [blankResult()] }));
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const change = (key, value) => setDraft(old => ({ ...old, [key]: value }));
  const changeResult = (index, key, value) => change('key_results', draft.key_results.map((result, i) => i === index ? { ...result, [key]: value } : result));
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await talentApi.save('goals', { ...draft, employee_id: employeeId, key_results: draft.key_results.map(({ title, target, current }) => ({ title: title.trim(), target: Number(target), current: Number(current) })) });
      onSaved();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <form className="card overview-card profile-goal-form" onSubmit={submit}><fieldset disabled={busy}>
    <div className="profile-goal-form__fields"><label>Goal<input value={draft.title} required maxLength={200} placeholder="What should this goal achieve?" onChange={event => change('title', event.target.value)} /></label><label>Due date<input type="date" value={draft.due_date} required onChange={event => change('due_date', event.target.value)} /></label><label>Status<select value={draft.status} onChange={event => change('status', event.target.value)}>{['Not started', 'On track', 'At risk', 'Completed', 'Cancelled'].map(status => <option key={status}>{status}</option>)}</select></label><label>Notes<textarea rows={2} value={draft.notes} placeholder="Context or success criteria" onChange={event => change('notes', event.target.value)} /></label></div>
    <div className="profile-goal-form__results"><div className="profile-goal-form__result-label">Key results<span>{draft.key_results.length} / 20</span></div>{draft.key_results.map((result, index) => <div className="profile-goal-form__result" key={result.formId}><div className="profile-goal-form__result-top"><span>Result {index + 1}</span>{draft.key_results.length > 1 && <Button variant="fadeout" size="sm" iconOnly icon={Trash2} aria-label={`Remove result ${index + 1}`} onClick={() => change('key_results', draft.key_results.filter((_, i) => i !== index))} />}</div><label>Result<input value={result.title} required placeholder="A measurable outcome" onChange={event => changeResult(index, 'title', event.target.value)} /></label><div className="profile-goal-form__numbers"><label>Target<input type="number" min="0.01" step="any" value={result.target} required onChange={event => changeResult(index, 'target', event.target.value)} /></label><label>Current<input type="number" min="0" step="any" value={result.current} required onChange={event => changeResult(index, 'current', event.target.value)} /></label></div></div>)}<Button size="sm" variant="outline" icon={Plus} disabled={draft.key_results.length >= 20} onClick={() => change('key_results', [...draft.key_results, blankResult()])}>Add key result</Button></div>
    {error && <p role="alert" className="people-error">{error}</p>}<div className="profile-goal-form__footer"><Button variant="outline" size="sm" disabled={busy} onClick={onCancel}>Cancel</Button><Button type="submit" size="sm" loading={busy}>{goal.id ? 'Save changes' : 'Create goal'}</Button></div>
  </fieldset></form>;
}

export function ProfileGoals({ employee }) {
  const employeeId = employee.user_id || employee.userid;
  const [rows, setRows] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState(''), [edit, setEdit] = useState(null), [revision, setRevision] = useState(0);
  useEffect(() => {
    let alive = true; setLoading(true); setError('');
    talentApi.list('goals').then(data => { if (alive) setRows(data.filter(row => [employeeId, employee.userid, employee.employee_id].filter(Boolean).includes(row.employee_id))); }).catch(err => { if (alive) setError(err.message); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [employeeId, employee.userid, employee.employee_id, employee.dossier_revision, revision]);
  if (loading) return <GoalsSkeleton />;
  return <div className="profile-goals">{error && <div className="people-error" role="alert">{error}<Button size="sm" variant="outline" onClick={() => setRevision(value => value + 1)}>Retry</Button></div>}
    {edit ? <GoalForm key={edit.id || 'new'} goal={edit} employeeId={employeeId} onCancel={() => setEdit(null)} onSaved={() => { setEdit(null); setRevision(value => value + 1); }} /> : <>
      {rows.map(row => <GoalCard key={row.id} goal={row} onEdit={setEdit} />)}
      {!rows.length && !error && <p className="card overview-card dossier-empty dossier-empty-card">No goals added.</p>}
      <div className="dossier-add-action"><Button size="sm" variant="colored" icon={Plus} disabled={Boolean(error)} onClick={() => setEdit({})}>Add goal</Button></div>
    </>}
  </div>;
}
