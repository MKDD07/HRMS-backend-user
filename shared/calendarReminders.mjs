export function reminderFields(input, ownerId) {
  const time = String(input.time || '09:00');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Choose a valid reminder time.');
  const lead = Number(input.remind_before || 0);
  if (![0, 15, 30, 60, 1440].includes(lead)) throw new Error('Choose a valid alert interval.');
  return { time, location: String(input.location || '').trim().slice(0, 160), priority: ['Normal','High'].includes(input.priority) ? input.priority : 'Normal', remind_before: lead, description: String(input.description || '').trim().slice(0, 500), reminder: input.reminder !== false, owner_id: ownerId, read_at: null };
}
export function dueCalendarReminders(entries, userId, now = Date.now()) {
  return entries.filter(entry => entry.owner_id === userId && entry.reminder && entry.active !== false && new Date(`${entry.holiday_date}T${entry.time || '09:00'}:00+05:30`).getTime() - Number(entry.remind_before || 0) * 60000 <= now).map(entry => ({ id: `calendar:${entry.id}`, title: entry.name, message: `${entry.type || 'Reminder'} / ${entry.holiday_date} ${entry.time || '09:00'} IST${entry.location ? ' / ' + entry.location : ''}${entry.description ? ' / ' + entry.description : ''}`, timestamp: new Date(new Date(`${entry.holiday_date}T${entry.time || '09:00'}:00+05:30`).getTime() - Number(entry.remind_before || 0) * 60000).toISOString(), unread: !entry.read_at, category: 'System', timeAgo: entry.holiday_date })).sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0,100);
}
