// Sends the hourly Streak Buddy push. Run by .github/workflows/hourly-reminders.yml
import admin from 'firebase-admin';

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore(), fcm = admin.messaging();
const DRY = process.env.DRY_RUN === 'true';
const DAY_START_HOUR = 3; // must match the app

const fmt = (tz, date) => {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' });
  return Object.fromEntries(f.formatToParts(date).map(p => [p.type, p.value]));
};
const wdOf = key => { const [y, m, d] = key.split('-').map(Number); return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; }; // Mon=0
const pick = a => a[Math.floor(Math.random() * a.length)];
const sched = (t, k) => {
  if (t.archived || t.type === 'fixed') return false;
  if (t.rep && t.rep.length) return !(t.createdDate && k < t.createdDate) && !(t.endDate && k > t.endDate) && t.rep.includes(wdOf(k));
  return t.date === k;
};

const snap = await db.collection('users').where('remind.on', '==', true).get();
let sent = 0, skipped = 0;
for (const u of snap.docs) {
  const P = u.data(), r = P.remind || {}, tokens = P.fcmTokens || [];
  if (!tokens.length) { skipped++; continue; }
  const tz = P.tz || 'America/New_York', now = new Date();
  const hour = +fmt(tz, now).hour, p = fmt(tz, new Date(now - DAY_START_HOUR * 3600e3)), key = `${p.year}-${p.month}-${p.day}`;
  if (hour < r.from || hour >= r.to || (hour - r.from) % (r.every || 1)) { skipped++; continue; }

  const [tasks, day, hw] = await Promise.all([
    db.collection(`users/${u.id}/tasks`).get(), db.doc(`users/${u.id}/days/${key}`).get(), db.collection(`users/${u.id}/homework`).get()
  ]);
  const done = (day.exists && day.data().done) || {};
  const left = tasks.docs.filter(d => sched(d.data(), key) && !done[d.id]).length;
  const hwLeft = hw.docs.filter(d => { const h = d.data(); return !h.done && h.due <= key; }).length;
  if (!left && !hwLeft) { skipped++; continue; }

  const name = P.mascotName || 'Bloop', streak = (P.lastCompleteDay === key || P.lastCompleteDay === new Date(Date.UTC(+p.year, +p.month - 1, +p.day - 1)).toISOString().slice(0, 10)) ? (P.streak || 0) : 0;
  const title = pick([`${name} is waiting! 👀`, 'Quick win time ⚡', streak ? `🔥 Protect your ${streak}-day streak` : 'Start a streak today 🔥', 'Tiny step, big XP 💥']);
  const bits = []; if (left) bits.push(`${left} habit${left > 1 ? 's' : ''}`); if (hwLeft) bits.push(`${hwLeft} homework`);
  const body = `${bits.join(' + ')} left today. Knock one out!`;

  for (const token of tokens) {
    if (DRY) { console.log('DRY', u.id, title, '|', body); continue; }
    try {
      await fcm.send({ token, data: { title, body, tag: 'sb-hourly', url: './' }, webpush: { headers: { Urgency: 'high', TTL: '3300' } } });
      sent++;
    } catch (e) {
      if (/registration-token-not-registered|invalid-argument|invalid-registration/.test(e.code || '')) await u.ref.update({ fcmTokens: admin.firestore.FieldValue.arrayRemove(token) });
      else console.error('send failed', u.id, e.code || e.message);
    }
  }
}
console.log(`Done. sent=${sent} skipped=${skipped}`);
