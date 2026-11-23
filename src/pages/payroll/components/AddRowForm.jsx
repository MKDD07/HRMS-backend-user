import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { ScopePicker } from './ScopePicker';
import { ROW_TEMPLATES } from '../constants/rowTemplates';

/**
 * Add a custom earning/deduction with a month scope.
 * Used in Tab 2 (one person) and Tab 4 (one or many people).
 * onSubmit receives { name, amount, type, scope } and should save it.
 */
export function AddRowForm({ year, month, onSubmit, submitLabel = 'Save row', targetLabel }) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState(0);
  const [type, setType] = useState('earning');
  const [scope, setScope] = useState({ mode: 'once', year: String(year), month, months: [month] });

  const scopeInvalid = scope.mode === 'selected' && (!scope.months || scope.months.length === 0);
  const canSave = name.trim() && Number(amount) > 0 && !scopeInvalid;

  const applyTemplate = (t) => {
    setName(t.name);
    setAmount(t.amount);
    setType(t.type);
  };

  const submit = async () => {
    if (!canSave) return;
    const saved = await onSubmit({
      name: name.trim(),
      amount: Number(amount),
      type,
      scope: {
        mode: scope.mode,
        year: String(scope.year || year),
        month: scope.month || month,
        months: scope.months || []
      }
    });
    if (saved !== false) setName('');
  };

  return <div className="payroll-add-component">
    <label className="payroll-template-field">Starting template<select value={ROW_TEMPLATES.some(template=>template.name===name)?name:''} onChange={event=>{const template=ROW_TEMPLATES.find(item=>item.name===event.target.value);if(template)applyTemplate(template);}}><option value="">Custom component</option>{ROW_TEMPLATES.map(template=><option key={template.name}>{template.name}</option>)}</select></label>
    <div className="payroll-fields"><label>Component name<input placeholder="e.g. Travel allowance" value={name} onChange={event=>setName(event.target.value)}/></label><label>Monthly amount (INR)<input type="number" min="0" step="0.01" value={amount} onChange={event=>setAmount(event.target.value)}/></label><label>Component type<select value={type} onChange={event=>setType(event.target.value)}><option value="earning">Earning</option><option value="deduction">Deduction</option></select></label></div>
    <div className="payroll-scope"><span>Applies to</span><ScopePicker value={scope} onChange={setScope} year={year} month={month}/></div>
    <div className="payroll-footer-actions"><span className="payroll-muted">{targetLabel}</span><Button size="sm" variant="colored" icon={Plus} disabled={!canSave} onClick={submit}>{submitLabel}</Button></div>
  </div>;
}
