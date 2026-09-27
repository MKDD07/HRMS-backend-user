import { cachedHolidays } from './holidayCache.mjs';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { payrollAuthorization } from './payrollRoutes.mjs';
import { createPayrollDatabase } from './payrollDatabase.mjs';
import { calendarStorage } from './calendarStorage.mjs';

const text = (value, max = 160) => String(value ?? '').trim().slice(0, max);
const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const date = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : '';


function validateLeaveType(input = {}) {
  const name = text(input.name);
  const code = text(input.code, 20).toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  if (!name || !code) throw new Error('Leave name and code are required.');
  const eligibility_mode = ['all', 'gender', 'groups', 'people'].includes(input.eligibility_mode) ? input.eligibility_mode : 'all';
  const accrual_frequency = ['none', 'monthly', 'quarterly', 'yearly'].includes(input.accrual_frequency) ? input.accrual_frequency : 'none';
  const initial_days = Math.max(0, number(input.initial_days));
  const accrual_amount = accrual_frequency === 'none' ? 0 : Math.max(0, number(input.accrual_amount));
  const max_balance = Math.max(0, number(input.max_balance, initial_days));
  if ([initial_days, accrual_amount, max_balance].some(value => value > 10000)) throw new Error('Leave day values must not exceed 10,000.');
  return {
    name, code, description: text(input.description, 500), color: /^#[0-9a-f]{6}$/i.test(input.color) ? input.color : '#66864f',
    active: input.active !== false, eligibility_mode,
    genders: Array.isArray(input.genders) ? input.genders.map(value => text(value, 30)).filter(Boolean).slice(0, 10) : [],
    groups: Array.isArray(input.groups) ? input.groups.map(value => text(value, 100)).filter(Boolean).slice(0, 100) : [],
    userids: Array.isArray(input.userids) ? input.userids.map(value => text(value, 100)).filter(Boolean).slice(0, 500) : [],
    initial_days, accrual_frequency, accrual_amount, max_balance,
    accrual_start_date: date(input.accrual_start_date), effective_from: date(input.effective_from), effective_to: date(input.effective_to),
    carry_forward: input.carry_forward === true, allow_half_day: input.allow_half_day !== false,
    updated_at: new Date().toISOString()
  };
}

function validateHoliday(input = {}) {
  const name = text(input.name);
  const holiday_date = date(input.holiday_date || input.date);
  if (!name || !holiday_date) throw new Error('Holiday name and date are required.');
  const type = text(input.type, 80) || 'Company Holiday';
  return { name, holiday_date, type, optional_note: type === 'Optional Holiday' ? text(input.optional_note, 500) : '', active: input.active !== false, updated_at: new Date().toISOString() };
}

function validateGroup(input = {}) {
  const name = text(input.name);
  if (!name) throw new Error('Policy group name is required.');
  const leave_type_ids = Array.isArray(input.leave_type_ids) ? [...new Set(input.leave_type_ids.map(value => text(value, 100)).filter(Boolean))].slice(0, 10) : [];
  if (!leave_type_ids.length) throw new Error('Select at least one leave type.');
  const assignment_mode = input.assignment_mode === 'people' ? 'people' : 'teams';
  return { name, description: text(input.description, 300), active: input.active !== false, leave_type_ids, assignment_mode, teams: assignment_mode === 'teams' && Array.isArray(input.teams) ? input.teams.map(value => text(value, 100)).filter(Boolean).slice(0, 100) : [], userids: assignment_mode === 'people' && Array.isArray(input.userids) ? input.userids.map(value => text(value, 100)).filter(Boolean).slice(0, 500) : [], updated_at: new Date().toISOString() };
}

function validateAssignment(input = {}) {
  const userid = text(input.userid, 100);
  if (!userid) throw new Error('Employee is required.');
  const mode = input.mode === 'custom' ? 'custom' : 'group';
  const overrides = mode === 'custom' && input.overrides && typeof input.overrides === 'object' ? Object.fromEntries(Object.entries(input.overrides).slice(0, 100).map(([id, value]) => [text(id, 100), { enabled: value?.enabled !== false, initial_days: Math.max(0, number(value?.initial_days)), accrual_amount: Math.max(0, number(value?.accrual_amount)) }])) : {};
  return { userid, mode, group_id: mode === 'group' ? text(input.group_id, 100) : '', overrides, updated_at: new Date().toISOString() };
}

export function createCompanyCalendarRouter({ database, filename, authorize = payrollAuthorization } = {}) {
  const router = express.Router();
  const db = database || createPayrollDatabase({ filename });
  const store = calendarStorage(db);
  let ready;
  const prepare = () => ready ||= store.ready().catch(error => { ready = null; throw error; });
  router.use(express.json({ limit: '1mb' }));
  router.use(async (req, res, next) => {
    try {
      const actor = await authorize(req);
      if (actor?.dashboard_access && actor.role !== 'company_admin') {
        if (!actor.dashboard_pages?.includes('company-calendar')) return res.status(403).json({ message: 'Company Calendar page access required.' });
        actor.admin = true;
      }
      if (!actor) return res.status(401).json({ message: 'Company Calendar requires verified authentication.' });
      if (!actor.admin && actor.role !== 'company_admin' && req.method !== 'GET') return res.status(403).json({ message: 'Only a company administrator can change Company Calendar settings.' });
      if (typeof actor.company_id !== 'string' || !actor.company_id.trim() || actor.company_id.length > 100) return res.status(403).json({ message: 'Verified company identity is required.' });
      await prepare(); res.locals.actor = actor; res.set('Cache-Control', 'no-store'); next();
    } catch (error) { res.status(503).json({ message: error.message }); }
  });
  const route = handler => async (req, res) => { try { await handler(req, res); } catch (error) { res.status(400).json({ message: error.message }); } };
  router.post('/holiday-cache', route(async (req, res) => {
    res.json(await cachedHolidays({ db, company: res.locals.actor.company_id, country: req.body.country, year: req.body.year, apiKey: process.env.CALENDARIFIC_API_KEY || process.env.VITE_CALENDARIFIC_API_KEY }));
  }));
  router.get('/configuration', route(async (req, res) => res.json(await store.configuration(res.locals.actor.company_id))));
  router.post('/leave-types', route(async (req, res) => { const id = text(req.body.id, 100) || randomUUID(); const value = { ...validateLeaveType(req.body), id }; await store.change(res.locals.actor.company_id, 'leave_types', id, value); res.json(value); }));
  router.delete('/leave-types/:id', route(async (req, res) => { await store.change(res.locals.actor.company_id, 'leave_types', text(req.params.id, 100)); res.json({ success: true }); }));
  router.post('/holidays', route(async (req, res) => { const id = text(req.body.id, 100) || randomUUID(); const value = { ...validateHoliday(req.body), id }; await store.change(res.locals.actor.company_id, 'holidays', id, value); res.json(value); }));
  router.delete('/holidays/:id', route(async (req, res) => { await store.change(res.locals.actor.company_id, 'holidays', text(req.params.id, 100)); res.json({ success: true }); }));
  router.post('/groups', route(async (req, res) => { const id = text(req.body.id, 100) || randomUUID(); const value = { ...validateGroup(req.body), id }; await store.change(res.locals.actor.company_id, 'policy_groups', id, value); res.json(value); }));
  router.delete('/groups/:id', route(async (req, res) => { await store.change(res.locals.actor.company_id, 'policy_groups', text(req.params.id, 100)); res.json({ success: true }); }));
  router.post('/assignments', route(async (req, res) => { const value = validateAssignment(req.body); await store.assign(res.locals.actor.company_id, value); res.json(value); }));
  router.post('/important-dates', route(async (req, res) => { const id = text(req.body.id, 100) || randomUUID(); const value = { ...validateHoliday(req.body), id }; await store.change(res.locals.actor.company_id, 'important_dates', id, value); res.json(value); }));
  router.delete('/important-dates/:id', route(async (req, res) => { await store.change(res.locals.actor.company_id, 'important_dates', text(req.params.id, 100)); res.json({ success: true }); }));
  return router;
}
