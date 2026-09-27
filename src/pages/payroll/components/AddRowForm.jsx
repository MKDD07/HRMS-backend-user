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
  const [amount, setAmount] = useState(2000);
  const [type, setType] = useState('earning');
  const [scope, setScope] = useState({ mode: 'once', year: String(year), month, months: [month] });

  const scopeInvalid = scope.mode === 'selected' && (!scope.months || scope.months.length === 0);
  const canSave = name.trim() && Number(amount) > 0 && !scopeInvalid;

  const applyTemplate = (t) => {
    setName(t.name);
    setAmount(t.amount);
    setType(t.type);
  };

  const submit = () => {
    if (!canSave) return;
    onSubmit({
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
    setName('');
  };

  const field = 'w-full h-8 px-2.5 rounded-lg border border-[#e2e9da] bg-white text-[13px] text-[#3e5432]';

  return (
    <div className="p-3.5 bg-[#f8faf5] rounded-xl border border-[#e2e9da] space-y-3 text-[13px]">
      <div>
        <span className="block text-[#7d8e70] font-semibold mb-1">Templates</span>
        <div className="flex flex-wrap gap-1.5">
          {ROW_TEMPLATES.map((t) => (
            <button
              key={t.name}
              type="button"
              onClick={() => applyTemplate(t)}
              className={`px-2 py-1 rounded-full border text-[11px] font-medium bg-white hover:border-[#587443] ${t.type === 'earning' ? 'text-[#047857] border-[#486537]/30' : 'text-[#B91C1C] border-[#EF4444]/30'
                }`}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-6 gap-3 items-end">
        <div className="sm:col-span-3">
          <label className="block text-[#7d8e70] mb-1 font-semibold">Row name</label>
          <input className={field} placeholder="e.g. Field conveyance" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-[#7d8e70] mb-1 font-semibold">Monthly amount (₹)</label>
          <input type="number" min="0" className={`${field} font-mono`} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <label className="block text-[#7d8e70] mb-1 font-semibold">Type</label>
          <select className={field} value={type} onChange={(e) => setType(e.target.value)}>
            <option value="earning">Earning</option>
            <option value="deduction">Deduction</option>
          </select>
        </div>
      </div>

      <div>
        <span className="block text-[#7d8e70] font-semibold mb-1">Applies to</span>
        <ScopePicker value={scope} onChange={setScope} year={year} month={month} />
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-[#7d8e70]">{targetLabel}</span>
        <Button variant="primary" size="sm" icon={Plus} disabled={!canSave} onClick={submit}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
