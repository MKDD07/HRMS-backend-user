import { addDays, validDay } from './overviewModel.mjs';

// Input people have already been scoped to the tenant, manager and dashboard filters.
export function workforceSummary(people, day) {
  const monthStart = day.slice(0, 7) + '-01';
  const joined = person => person.joining_date || person.date_of_joining;
  const left = person => person.last_working_date;
  const incomplete = people.filter(person => !validDay(joined(person)) || person.status === 'Inactive' && !validDay(left(person))).length;
  const at = date => people.filter(person => validDay(joined(person)) && joined(person) <= date && (!validDay(left(person)) || left(person) > date)).length;
  const exits = people.filter(person => validDay(left(person)) && left(person) >= monthStart && left(person) <= day);
  const opening = at(addDays(monthStart, -1)), closing = at(day), average = (opening + closing) / 2;
  const recent = people.flatMap(person => {
    const base = { id: person.user_id, name: person.name, department: person.department, designation: person.designation };
    return [
      ...(validDay(joined(person)) && joined(person) >= monthStart && joined(person) <= day ? [{ ...base, date: joined(person), status: 'Joined' }] : []),
      ...(validDay(left(person)) && left(person) >= monthStart && left(person) <= day ? [{ ...base, date: left(person), status: 'Exited' }] : []),
    ];
  }).sort((a, b) => b.date.localeCompare(a.date));
  return { month: day.slice(0, 7), opening, closing, exits: exits.length, incomplete,
    attritionRate: incomplete || !average ? null : Math.round(exits.length / average * 10000) / 100, recent };
}
