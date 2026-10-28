// สแตนด์อินของ @supabase/supabase-js สำหรับทดสอบในเครื่อง (ตารางในหน่วยความจำ) — ใช้: node -r ./test/fake-supabase.js server.js
const Module = require("module"), crypto = require("crypto");
const PK = { cards: ["id"], card_sets: ["id"], elements: ["name"], card_backups: ["id"], profiles: ["id"], user_decks: ["user_id", "deck_id"], user_cards: ["user_id", "card_id"], shop_items: ["id"], purchases: ["id"] };
const T = {}; const tbl = (n) => (T[n] = T[n] || []); let ident = 1;
const users = new Map(), tokens = new Map();   // email -> {id,email,password,meta} · token -> user
const mkSession = (u) => { const at = "at_" + crypto.randomUUID(), rt = "rt_" + crypto.randomUUID(); tokens.set(at, u); tokens.set(rt, u); return { access_token: at, refresh_token: rt, expires_in: 3600, user: pub(u) }; };
const pub = (u) => ({ id: u.id, email: u.email, user_metadata: u.meta });

class Q {
  constructor(t) { this.t = t; this.op = "select"; this.f = []; this.ord = null; this.rng = null; this.lim = null; this.one = false; this.sel = false; }
  select(cols, o) { if (this.op === "select") this.op = "select"; else this.sel = true; return this; }
  insert(r) { this.op = "insert"; this.body = r; return this; }
  upsert(r) { this.op = "upsert"; this.body = r; return this; }
  update(r) { this.op = "update"; this.body = r; return this; }
  delete() { this.op = "delete"; return this; }
  eq(c, v) { this.f.push((r) => r[c] === v); return this; }
  in(c, a) { this.f.push((r) => a.includes(r[c])); return this; }
  ilike(c, v) { this.f.push((r) => String(r[c] || "").toLowerCase() === String(v).toLowerCase()); return this; }
  order(c, o = {}) { this.ord = [c, o.ascending === false ? -1 : 1]; return this; }
  range(a, b) { this.rng = [a, b]; return this; }
  limit(n) { this.lim = n; return this; }
  maybeSingle() { this.one = true; return this; }
  single() { this.one = true; return this; }
  then(res, rej) { return Promise.resolve(this.run()).then(res, rej); }
  run() {
    const rows = tbl(this.t), pk = PK[this.t], match = (r) => this.f.every((f) => f(r));
    const clone = (x) => JSON.parse(JSON.stringify(x));
    const fin = (arr) => { let a = arr.map(clone); if (this.ord) a.sort((x, y) => (x[this.ord[0]] > y[this.ord[0]] ? 1 : x[this.ord[0]] < y[this.ord[0]] ? -1 : 0) * this.ord[1]); if (this.rng) a = a.slice(this.rng[0], this.rng[1] + 1); if (this.lim) a = a.slice(0, this.lim); return this.one ? { data: a[0] || null, error: null } : { data: a, error: null }; };
    const defaults = (r) => { if (this.t === "profiles") r = { role: "user", coins: 0, last_daily: null, created_at: new Date().toISOString(), ...r }; if (this.t === "shop_items") r = { active: true, config: {}, description: "", sort: 0, ...r }; if (pk[0] === "id" && PK[this.t].length === 1 && ["card_backups", "purchases"].includes(this.t) && r.id == null) { r.id = ident++; r.at = new Date().toISOString(); } return r; };
    if (this.op === "select") return fin(rows.filter(match));
    if (this.op === "insert" || this.op === "upsert") {
      const out = [];
      for (let r of [].concat(this.body)) {
        r = defaults({ ...r }); const ex = rows.find((x) => pk.every((k) => x[k] === r[k]));
        if (ex) { if (this.op === "insert") return { data: null, error: { message: "duplicate key value violates unique constraint" } }; Object.assign(ex, r); out.push(ex); }
        else {
          if (this.t === "profiles" && rows.some((x) => x.username.toLowerCase() === r.username.toLowerCase())) return { data: null, error: { message: "duplicate key value violates unique constraint" } };
          rows.push(r); out.push(r);
        }
      }
      return fin(out);
    }
    if (this.op === "update") { const hit = rows.filter(match); hit.forEach((r) => Object.assign(r, this.body)); return fin(hit); }
    if (this.op === "delete") { const keep = rows.filter((r) => !match(r)); T[this.t] = keep; return { data: null, error: null }; }
  }
}
const client = () => ({
  from: (t) => new Q(t),
  auth: {
    getUser: async (at) => { const u = tokens.get(at); return u ? { data: { user: pub(u) }, error: null } : { data: { user: null }, error: { message: "invalid jwt" } }; },
    signUp: async ({ email, password, options }) => { if (users.has(email)) return { data: {}, error: { message: "User already registered" } }; const u = { id: crypto.randomUUID(), email, password, meta: (options && options.data) || {} }; users.set(email, u); return { data: { user: pub(u), session: process.env.FAKE_CONFIRM ? null : mkSession(u) }, error: null }; },
    signInWithPassword: async ({ email, password }) => { const u = users.get(email); if (!u || u.password !== password) return { data: {}, error: { message: "Invalid login credentials" } }; return { data: { user: pub(u), session: mkSession(u) }, error: null }; },
    refreshSession: async ({ refresh_token }) => { const u = tokens.get(refresh_token); if (!u) return { data: {}, error: { message: "bad refresh" } }; return { data: { session: mkSession(u) }, error: null }; },
  },
});
const orig = Module._load;
Module._load = function (req, ...a) { return req === "@supabase/supabase-js" ? { createClient: client } : orig.call(this, req, ...a); };
