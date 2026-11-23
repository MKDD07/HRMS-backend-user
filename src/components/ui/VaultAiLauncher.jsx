import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, X, Send, ArrowUpRight, RotateCcw, Volume2 } from 'lucide-react';
import { Button } from './Button';
import { companyRequest } from '../../lib/companyAuth';
import { conversationKey, newConversation, restoreConversation } from '../../lib/asterConversation.mjs';
import { saveAsterLetter } from '../../lib/asterVaultLetter';
import './VaultAiLauncher.scss';
export function VaultAiLauncher({ currentUser, onStart }) {
  const key = conversationKey(currentUser);
  const [people,setPeople] = useState([]), [employeeId,setEmployeeId] = useState('');
  useEffect(() => { let live=true; const load=()=>companyRequest('/documents/assistant/directory',{token:localStorage.getItem('pulse_hrms_token')}).then(value=>{if(live)setPeople(value);}).catch(()=>{}); load(); window.addEventListener('aster-vault-saved',load); return()=>{live=false;window.removeEventListener('aster-vault-saved',load);}; }, []);
  const goTo = location => window.dispatchEvent(new CustomEvent('aster-document-location',{detail:location}));
  const [open, setOpen] = useState(false), [phase, setPhase] = useState(''), [writing, setWriting] = useState('');
  const [session, setSession] = useState(() => { try { return restoreConversation(localStorage.getItem(key)); } catch { return newConversation(); } });
  const controller = useRef(null), generation = useRef(0), scroll = useRef(null), input = useRef(null), anchor = useRef(null), sessionRef = useRef(session);
  sessionRef.current = session;
  const update = fn => setSession(old => { const next = fn(old); return { ...next, messages: next.messages.slice(-20) }; });
  useEffect(() => {
    try { for (const name of Object.keys(localStorage)) if (name.startsWith('aster-chat:')) { try { if (JSON.parse(localStorage.getItem(name)).expiresAt <= Date.now()) localStorage.removeItem(name); } catch { localStorage.removeItem(name); } } } catch {}
    return () => { generation.current++; controller.current?.abort(); window.speechSynthesis?.cancel(); };
  }, []);
  useEffect(() => { try { if (session.expiresAt > Date.now()) localStorage.setItem(key, JSON.stringify(session)); } catch {} }, [key, session]);
  useEffect(() => { const timeout = setTimeout(() => { generation.current++; controller.current?.abort(); setPhase(''); setWriting(''); try { localStorage.removeItem(key); } catch {} setSession(newConversation()); }, Math.max(0,session.expiresAt-Date.now())); return () => clearTimeout(timeout); }, [session.expiresAt, key]);
  useEffect(() => { if (open) input.current?.focus(); }, [open]);
  useEffect(() => { if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight; }, [session.messages, writing, phase, open]);
  function hide() { setOpen(false); anchor.current?.querySelector('button')?.focus(); }
  function reset() { if (phase) return; window.speechSynthesis?.cancel(); setWriting(''); setSession(newConversation()); }
  async function send(event) {
    event.preventDefault();
    const prompt = sessionRef.current.input.trim(); if (!prompt || phase) return;
    const id = ++generation.current; controller.current = new AbortController();
    update(old => ({ ...old, input: '', messages: [...old.messages, { id: crypto.randomUUID(), role: 'user', text: prompt }] }));
    setPhase('Thinking'); onStart?.();
    try {
      const result = await companyRequest('/documents/assistant/help', { token: localStorage.getItem('pulse_hrms_token'), method: 'POST', signal: controller.current.signal, body: JSON.stringify({ prompt, userid:employeeId || sessionRef.current.pendingUserid || undefined, previousText: sessionRef.current.pending?.text || sessionRef.current.latest?.text || '', skipMissing: /^(skip|skip missing details|leave blanks)[.!]?$/i.test(prompt) }) });
      if (generation.current !== id) return;
      if (result.kind === 'message') { update(old => ({ ...old, pending:result.pending || old.pending, ...(result.userid ? { pendingUserid:result.userid } : {}), messages: [...old.messages,{id:crypto.randomUUID(),role:'assistant',text:result.text,location:result.location,needsDetails:!!result.pending}] })); if(result.alertsUpdated) window.dispatchEvent(new Event('aster-document-alerts')); return; }
      setPhase('Writing');
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) for (let count = 0; count < result.text.length; count += Math.max(20,Math.ceil(result.text.length/70))) { if (generation.current !== id) return; setWriting(result.text.slice(0,count)); await new Promise(resolve => setTimeout(resolve,25)); }
      if (generation.current !== id) return;
      setPhase('Saving draft'); const messageId = crypto.randomUUID();
      update(old => ({ ...old, latest: result, pending: null, pendingUserid: null, messages: [...old.messages, { id: messageId, role: 'assistant', title: result.title, text: result.text, type: result.letter_type, location:result.location }] })); setWriting('');
      const saved = await saveAsterLetter(result); if (generation.current !== id) return;
      update(old => ({ ...old, messages: old.messages.map(message => message.id === messageId ? { ...message, savedId: saved.id || saved.document_id, location:{page:"documents",policyView:"ai",documentId:saved.id || saved.document_id} } : message) }));
    } catch (error) { if (generation.current === id) { setWriting(''); update(old => ({ ...old, messages: [...old.messages, { id: crypto.randomUUID(), role: 'assistant', error: true, text: error.name === 'AbortError' ? 'The request was interrupted. Send your request again to continue.' : error.message }] })); } }
    finally { if (generation.current === id) setPhase(''); }
  }
  function read(text) { window.speechSynthesis?.cancel(); window.speechSynthesis?.speak(new SpeechSynthesisUtterance(text)); }
  return <div className="aster-chat-anchor" ref={anchor}>
    <Button iconOnly icon={Sparkles} variant="colored" className={`aster-chat-trigger ${phase ? 'is-working' : ''}`} title="Aster AI" aria-label="Open Aster AI conversation" aria-expanded={open} aria-controls="aster-chat-panel" onClick={() => setOpen(value => !value)}/>
    <section id="aster-chat-panel" className={`aster-chat-panel ${open ? 'is-open' : ''} ${phase ? 'is-generating' : ''}`} aria-label="Aster AI conversation" role="dialog" aria-hidden={!open} inert={!open} onKeyDown={e => { if(e.key === 'Escape') { e.stopPropagation(); hide(); } }}>
      <header><span className="aster-chat-avatar"><Sparkles size={21}/></span><div><strong>Aster AI</strong><small>{phase ? `${phase}…` : 'Your document assistant · 24-hour conversation'}</small></div><Button iconOnly size="sm" variant="fadeout" icon={RotateCcw} disabled={!!phase} title="Start a new conversation" aria-label="Start a new conversation" onClick={reset}/><Button iconOnly size="sm" variant="fadeout" icon={X} title="Hide chat — keep conversation" aria-label="Hide chat — keep conversation" onClick={hide}/></header>
      <label className="aster-chat-employee">Employee (optional for letters)<select value={employeeId} disabled={!!phase} onChange={e=>setEmployeeId(e.target.value)}><option value="">Detect from name in your request</option>{people.map(person=><option key={person.userid} value={person.userid}>{person.name} - {person.employee_code}</option>)}</select></label><div className="aster-chat-messages" ref={scroll}>
        {!session.messages.length && <div className="aster-chat-welcome"><Sparkles size={28}/><h3>What shall we write?</h3><p>Describe a letter. I’ll open the vault, draft it and save a Word copy for review.</p><div>{['Write an experience letter','Check missing documents for the selected employee','Draft an appointment letter'].map(text => <button key={text} onClick={() => { update(old => ({ ...old,input:text })); input.current?.focus(); }}>{text}<ArrowUpRight size={14}/></button>)}</div></div>}
        {session.messages.map(message => <article key={message.id} className={`aster-chat-message is-${message.role} ${message.error ? 'is-error' : ''}`}><small>{message.role === 'user' ? 'You' : 'Aster AI'}</small>{message.title && <strong>{message.title}</strong>}<p>{message.text}</p>{message.needsDetails && session.pending && <Button size="sm" variant="outline" disabled={!!phase} onClick={() => { update(old => ({...old,input:'Skip missing details'})); input.current?.focus(); }}>Skip ? leave blank spaces</Button>}{message.location && <Button variant="outline" size="sm" icon={ArrowUpRight} onClick={()=>goTo(message.location)}>Open document location</Button>}{message.savedId && <footer><span>Word draft saved · {message.type}</span>{window.speechSynthesis && <Button size="sm" variant="fadeout" iconOnly icon={Volume2} aria-label="Read letter aloud" onClick={() => read(message.text)}/>}</footer>}</article>)}
        {phase && <article className="aster-chat-message is-assistant"><small>Aster AI · {phase}</small>{writing ? <p className="aster-chat-typewriter">{writing}</p> : <span className="aster-chat-thinking" role="status" aria-label="Aster AI is working"><i/><i/><i/></span>}</article>}
      </div>
      <form onSubmit={send}><label className="sr-only" htmlFor="aster-chat-input">Message Aster AI</label><textarea id="aster-chat-input" ref={input} rows={2} maxLength={3000} value={session.input} disabled={!!phase} onChange={e => update(old => ({ ...old, input: e.target.value }))} onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if(!phase) e.currentTarget.form.requestSubmit(); } }} placeholder="Tell Aster what to write or change…"/><Button iconOnly icon={Send} type="submit" aria-label="Send message to Aster AI" disabled={!!phase || !session.input.trim()}/></form>
      <footer><span>Closing hides chat; work continues while this app stays open.</span><Button size="sm" variant="fadeout" onClick={hide}>Close</Button></footer>
    </section>
  </div>;
}
