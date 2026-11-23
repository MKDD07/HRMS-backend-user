import { AsterWorking } from './AsterAssistant';
import React, { useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from './Button';
import { companyRequest } from '../../lib/companyAuth';
import './DepartmentAiDraft.scss';

export function DepartmentAiDraft({ name, targets, responsibilities, onApply, disabled }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [result, setResult] = useState(null);
  const original = useRef(null);
  function updateResult(next) { setResult(next); onApply(next); }
  async function generate() {
    original.current = { targets, responsibilities };
    setBusy(true); setError(''); setResult(null);
    try {
      const generated = await companyRequest('/ai/department-draft', { token: localStorage.getItem('pulse_hrms_token'), method: 'POST', body: JSON.stringify({ name, targets, responsibilities }) });
      updateResult(generated);
    } catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  return <section className="department-ai-draft" aria-label="AI department drafting">
    <div className="departments-actions"><Button type="button" variant="outline" icon={Sparkles} loading={busy} disabled={disabled || !name?.trim()} onClick={generate}>Draft with Aster AI</Button><span>Suggest targets and responsibilities. Review before saving.</span></div>
    {busy && <AsterWorking label="Aster AI is drafting department details"/>}
    {error && <p role="alert">{error}</p>}
    {result && <div className="department-ai-preview"><p className="department-ai-applied" role="status">Added to the department form. Review before saving.</p><label>Suggested targets<textarea disabled={disabled} rows={4} maxLength={4000} value={result.targets} onChange={e => updateResult({ ...result, targets: e.target.value })}/></label><label>Suggested responsibilities<textarea disabled={disabled} rows={4} maxLength={4000} value={result.responsibilities} onChange={e => updateResult({ ...result, responsibilities: e.target.value })}/></label><div className="departments-actions"><Button type="button" variant="outline" disabled={disabled} onClick={() => setResult(null)}>Done reviewing</Button><Button type="button" variant="outline" disabled={disabled} onClick={() => { if (original.current) onApply(original.current); setResult(null); }}>Discard suggestion</Button></div></div>}
  </section>;
}
