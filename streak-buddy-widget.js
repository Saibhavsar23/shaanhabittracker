// Streak Buddy home-screen widget for iPhone + iPad (runs in the free "Scriptable" app).
// 1) Install Scriptable from the App Store  2) New script -> paste this file  3) Run it once inside Scriptable (it asks for your login)
// 4) Long-press the Home Screen -> + -> Scriptable -> pick a size -> Edit Widget -> Script: this one.
// Works for the owner and for a parent account (a parent sees the person they follow).

const API_KEY = "AIzaSyDFDTofCYVefEDLfIPq5jLUeRoczpJOWBY";
const PROJECT = "shaanhabittracker";
const APP_URL = "https://YOUR-USERNAME.github.io/YOUR-REPO/";   // tapping the widget opens this
const DAY_START_HOUR = 3;

const FS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/`;
const KC = "streakbuddy_login";

async function login() {
  let cred = Keychain.contains(KC) ? JSON.parse(Keychain.get(KC)) : null;
  if (!cred) {
    if (!config.runsInApp) return null;
    const a = new Alert(); a.title = "Streak Buddy login"; a.message = "Use the email + password you sign in with. (Google-only? Tap 'Forgot password' in the app once to set a password.)";
    a.addTextField("Email"); a.addSecureTextField("Password"); a.addAction("Save"); a.addCancelAction("Cancel");
    if ((await a.present()) < 0) return null;
    cred = { email: a.textFieldValue(0).trim(), password: a.textFieldValue(1) };
    Keychain.set(KC, JSON.stringify(cred));
  }
  const r = new Request(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`);
  r.method = "POST"; r.headers = { "Content-Type": "application/json" };
  r.body = JSON.stringify({ email: cred.email, password: cred.password, returnSecureToken: true });
  const j = await r.loadJSON();
  if (!j.idToken) { Keychain.remove(KC); return null; }
  return { token: j.idToken, uid: j.localId };
}
const val = v => {
  if (v == null) return null;
  if ("stringValue" in v) return v.stringValue; if ("integerValue" in v) return +v.integerValue; if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue; if ("arrayValue" in v) return (v.arrayValue.values || []).map(val);
  if ("mapValue" in v) return obj(v.mapValue.fields || {}); return null;
};
const obj = f => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, val(v)]));
async function get(path, tok, list) {
  const r = new Request(FS + path + (list ? "?pageSize=300" : "")); r.headers = { Authorization: "Bearer " + tok };
  const j = await r.loadJSON();
  if (j.error) return list ? [] : null;
  return list ? (j.documents || []).map(d => Object.assign({ id: d.name.split("/").pop() }, obj(d.fields || {}))) : obj(j.fields || {});
}
const pad = n => String(n).padStart(2, "0");
const keyOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = keyOf(new Date(Date.now() - DAY_START_HOUR * 3600e3));
const wdOf = k => { const [y, m, d] = k.split("-").map(Number); return (new Date(y, m - 1, d).getDay() + 6) % 7; };
const toM = s => { const p = s.split(":").map(Number); return p[0] * 60 + p[1]; };
const dur = t => t.type === "any" ? (+t.mins || 0) : Math.max(0, toM(t.end) - toM(t.start));
const sched = (t, k) => {
  if (t.archived) return false;
  if (t.rep && t.rep.length) return !(t.createdDate && k < t.createdDate) && !(t.endDate && k > t.endDate) && t.rep.includes(wdOf(k));
  return t.date === k;
};

async function load() {
  const me = await login(); if (!me) return null;
  const link = await get("viewerLinks/" + me.uid, me.token);
  const owner = link && link.ownerUid ? link.ownerUid : me.uid;
  const [P, tasks, day, hw] = await Promise.all([get("users/" + owner, me.token), get(`users/${owner}/tasks`, me.token, true), get(`users/${owner}/days/${today}`, me.token), get(`users/${owner}/homework`, me.token, true)]);
  if (!P) return null;
  const done = (day && day.done) || {}, ts = tasks.filter(t => sched(t, today)), tot = ts.reduce((a, t) => a + dur(t), 0);
  const dn = ts.filter(t => done[t.id]), all = ts.length && dn.length === ts.length;
  const pct = all ? 100 : tot ? Math.min(99, Math.floor(dn.reduce((a, t) => a + dur(t), 0) / tot * 100)) : 0;
  const yest = keyOf(new Date(Date.now() - DAY_START_HOUR * 3600e3 - 864e5));
  const streak = (P.lastCompleteDay === today || P.lastCompleteDay === yest) ? (P.streak || 0) : 0;
  const hwDue = hw.filter(h => !h.done && h.due <= today);
  return { P, pct, streak, left: ts.filter(t => !done[t.id]), count: ts.length, dn: dn.length, hwDue, name: P.displayName || "Champ" };
}

const lvl = xp => { let l = 1, need = 200; while (xp >= need) { xp -= need; l++; need += 100; } return l; };
function bar(pct, w, h, col) {
  const dc = new DrawContext(); dc.size = new Size(w, h); dc.opaque = false; dc.respectScreenScale = true;
  dc.setFillColor(new Color("#000000", 0.18)); dc.fillRect(new Rect(0, 0, w, h));
  dc.setFillColor(new Color(col)); dc.fillRect(new Rect(0, 0, Math.max(h, w * pct / 100), h));
  return dc.getImage();
}

async function build() {
  const w = new ListWidget(), d = await load().catch(() => null);
  const g = new LinearGradient(); g.colors = [new Color("#58cc02"), new Color("#1cb0f6")]; g.locations = [0, 1]; w.backgroundGradient = g;
  w.url = APP_URL; w.refreshAfterDate = new Date(Date.now() + 15 * 60e3); w.setPadding(14, 14, 12, 14);
  const white = Color.white();
  const txt = (stack, s, size, bold, op) => { const t = stack.addText(s); t.font = bold ? Font.heavySystemFont(size) : Font.semiboldSystemFont(size); t.textColor = white; if (op) t.textOpacity = op; return t; };
  if (!d) { txt(w, "🙂 Streak Buddy", 16, true); w.addSpacer(4); txt(w, "Open Scriptable and run this script once to sign in.", 12, false, .9); return w; }
  const fam = config.widgetFamily || "medium";
  const top = w.addStack(); top.centerAlignContent();
  txt(top, "🔥 " + d.streak, fam === "small" ? 22 : 26, true); top.addSpacer();
  txt(top, "⭐ " + (d.P.xp || 0), 14, true, .95);
  w.addSpacer(6);
  txt(w, d.pct + "% of today", fam === "small" ? 13 : 15, true);
  w.addSpacer(4);
  const b = w.addImage(bar(d.pct, 300, 16, d.pct >= 100 ? "#ffc800" : "#ffffff")); b.imageSize = new Size(fam === "small" ? 120 : 300, fam === "small" ? 9 : 12); b.cornerRadius = 6;
  w.addSpacer(8);
  if (d.pct >= 100 && !d.hwDue.length) { txt(w, "All done! " + (d.P.mascotName || "Your buddy") + " is proud 🎉", fam === "small" ? 12 : 14, true); return w; }
  const lines = [];
  d.left.slice(0, fam === "large" ? 6 : fam === "small" ? 0 : 3).forEach(t => lines.push((t.icon || "⭐") + " " + t.title));
  if (d.hwDue.length) lines.push("📚 " + d.hwDue.length + " homework due");
  if (fam === "small") { txt(w, d.left.length + " habits left" + (d.hwDue.length ? " · 📚 " + d.hwDue.length : ""), 12, true); return w; }
  lines.forEach(l => { const t = txt(w, l, 13, false); t.lineLimit = 1; w.addSpacer(2); });
  if (fam === "large") { w.addSpacer(); txt(w, d.name + " · level " + (lvl(d.P.xp || 0)), 11, false, .8); }
  return w;
}

const widget = await build();
if (config.runsInWidget) Script.setWidget(widget); else await widget.presentMedium();
Script.complete();
