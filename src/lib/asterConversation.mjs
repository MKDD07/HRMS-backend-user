export const ASTER_TTL = 86400000;
export const conversationKey = user => `aster-chat:${user.company_id}:${user.user_id || user.userid}`;
export const newConversation = (now = Date.now()) => ({ createdAt: now, expiresAt: now + ASTER_TTL, messages: [], input: '', latest: null });
export function restoreConversation(value, now = Date.now()) {
  try {
    const saved = JSON.parse(value);
    if (!saved || saved.expiresAt <= now || saved.createdAt > now || saved.expiresAt - saved.createdAt !== ASTER_TTL || !Array.isArray(saved.messages)) return newConversation(now);
    return { ...saved, messages: saved.messages.slice(-20), input: typeof saved.input === 'string' ? saved.input.slice(0,3000) : '' };
  } catch { return newConversation(now); }
}
