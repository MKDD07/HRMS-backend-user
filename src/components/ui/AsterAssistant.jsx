import React, { useState } from 'react';
import { Sparkles, Globe, WandSparkles } from 'lucide-react';
import { Button } from './Button';
import { companyRequest } from '../../lib/companyAuth';
import './AsterAssistant.scss';

export function AsterWorking({ label = 'Aster AI is writing' }) {
  return <div className="aster-working" role="status"><span className="aster-orbit" aria-hidden="true"><Sparkles size={20}/></span><span>{label}<span className="aster-dots" aria-hidden="true">•••</span></span></div>;
}
function ResearchText({ text }) {
  return <div className="aster-research">{text.split(/(\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g).map((part, index) => {
    const match = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
    return match ? <a key={index} href={match[2]} target="_blank" rel="noopener noreferrer">{match[1]}</a> : <React.Fragment key={index}>{part}</React.Fragment>;
  })}</div>;
}
export function AsterAssistant({ page, context, onApply, disabled }) {
  const [prompt, setPrompt] = useState(''), [busy, setBusy] = useState(''), [error, setError] = useState(''), [result, setResult] = useState(null);
  async function run(action) {
    setBusy(action); setError(''); setResult(null);
    try { setResult(await companyRequest('/ai/' + page, { token: localStorage.getItem('pulse_hrms_token'), method: 'POST', body: JSON.stringify({ prompt, context, action }) })); }
    catch (failure) { setError(failure.message); } finally { setBusy(''); }
  }
  return <section className="aster-assistant" aria-label="Aster AI assistant">
    <header><span className="aster-emblem"><Sparkles size={18}/></span><div><strong>Aster AI</strong><p>{page === 'salary-structure' ? 'Draft salary structure details and research public guidance.' : 'Write a letter, improve its wording, or research a public topic.'}</p></div></header>
    <label>What would you like help with?<textarea rows={2} maxLength={3000} value={prompt} disabled={!!busy || disabled} onChange={e => setPrompt(e.target.value)} placeholder={page === 'salary-structure' ? 'Describe the role, grade and approved compensation range…' : 'e.g. Write a welcoming appointment letter, or fix the tone and grammar…'}/></label>
    <div className="aster-actions">{[['draft','Write draft',Sparkles],['improve','Improve wording',WandSparkles],['research','Search web',Globe]].map(([action,label,icon]) => <Button key={action} type="button" variant="outline" size="sm" icon={icon} disabled={!!busy || disabled || !prompt.trim()} onClick={() => run(action)}>{label}</Button>)}</div>
    <p className="aster-note">Drafting uses this document’s text. Web search sends only your public-topic request. Review suggestions before applying.</p>
    {busy && <AsterWorking label={busy === 'research' ? 'Aster AI is searching the web' : page === 'salary-structure' ? 'Aster AI is drafting salary details' : 'Aster AI is writing your letter'}/>}
    {error && <p role="alert" className="aster-error">{error}</p>}
    {result && <div className="aster-result">{result.research ? <ResearchText text={result.text}/> : page === 'salary-structure' ? <><strong>{result.name}</strong><p>{result.grade} · {result.annual_base_range}</p><textarea aria-label="Suggested salary description" rows={6} maxLength={4000} value={result.description} onChange={e => setResult({ ...result, description: e.target.value })}/></> : <><strong>{result.title}</strong><textarea aria-label="Suggested letter" rows={9} maxLength={10000} value={result.text} onChange={e => setResult({ ...result, text: e.target.value })}/></>}
      <div className="aster-actions">{!result.research && <Button type="button" disabled={disabled} onClick={() => { onApply(result); setResult(null); }}>Use draft</Button>}<Button type="button" variant="outline" onClick={() => setResult(null)}>Dismiss</Button></div>
    </div>}
  </section>;
}
