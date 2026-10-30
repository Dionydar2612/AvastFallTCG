-- AvastFall TCG · โครงสร้างฐานข้อมูล Supabase
-- วิธีใช้: Supabase Dashboard → SQL Editor → วางทั้งไฟล์นี้ → Run (รันซ้ำได้ ไม่ทับข้อมูลเดิม)
--
-- หลักการ: ทุกตารางเปิด RLS และ "ไม่มี policy ให้ client" → เบราว์เซอร์เข้าตารางตรง ๆ ไม่ได้
-- ทุกอย่างผ่านเซิร์ฟเวอร์ (service_role) ซึ่งตรวจสิทธิ์ผู้ใช้/แอดมินก่อนเสมอ
-- ผู้ใช้ (login/สมัคร) ใช้ระบบ Supabase Auth (auth.users) ส่วนข้อมูลเกมของผู้ใช้อยู่ใน profiles ฯลฯ ด้านล่าง
-- รูปการ์ด "ไม่อยู่ในฐานข้อมูล" — ฝังไว้ในโค้ดที่ public/images/<รหัสการ์ด>.jpg

-- ---------- ข้อมูลการ์ด (metadata) ----------
create table if not exists public.card_sets (          -- เด็ค/ซีรีส์ เช่น SD01, BT01
  id          text primary key,
  name        text not null default '',
  data        jsonb not null default '{}'::jsonb,      -- {id,name,total,rotation,element,rarity,artist}
  updated_at  timestamptz not null default now()
);

create table if not exists public.cards (
  id          text primary key,                        -- เช่น SD01-001 หรือ SD01-019SR
  deck        text not null,
  no          text not null,
  name        text not null,
  type        text not null,                           -- Avatar | Unit | Spell | Ultimate
  rarity      text,
  data        jsonb not null,                          -- การ์ดทั้งใบ (ธาตุ ค่าสถานะ เอฟเฟกต์ ฯลฯ) ไม่รวมรูป
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists cards_deck_idx on public.cards (deck);

create table if not exists public.elements (            -- ธาตุ (สี + path ไอคอน)
  name        text primary key,
  data        jsonb not null
);

create table if not exists public.card_backups (        -- สำรองอัตโนมัติก่อนแก้การ์ดทุกครั้ง (เก็บ 30 ล่าสุด)
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  note        text,
  n_cards     int not null default 0,
  n_decks     int not null default 0,
  payload     jsonb not null                           -- {cards:[...], decks:[...]}
);

-- ---------- ผู้ใช้ ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text not null,
  email       text not null default '',
  role        text not null default 'user' check (role in ('user','admin')),
  coins       int  not null default 0 check (coins >= 0),
  last_daily  date,
  created_at  timestamptz not null default now(),
  last_seen_at timestamptz,                                -- เห็นล่าสุดเมื่อไร (ใช้ดูว่าใครออนไลน์)
  last_page   text                                         -- game | cards | admin
);
-- สำหรับฐานข้อมูลที่สร้างไว้แล้ว: เพิ่มคอลัมน์ใหม่ (รันซ้ำได้)
alter table public.profiles add column if not exists last_seen_at timestamptz;
alter table public.profiles add column if not exists last_page text;
create index if not exists profiles_last_seen_idx on public.profiles (last_seen_at desc);
-- แมตช์จับคู่ออนไลน์: แต้มแรงก์ + สถิติแพ้ชนะ (รันซ้ำได้)
alter table public.profiles add column if not exists rank_points int not null default 0 check (rank_points >= 0);
alter table public.profiles add column if not exists wins   int not null default 0;
alter table public.profiles add column if not exists losses int not null default 0;
-- รางวัลเลื่อนแรงค์ที่กดรับไปแล้ว (รายชื่อลีก เช่น ["SILVER","GOLD"]) (รันซ้ำได้)
alter table public.profiles add column if not exists rank_claims jsonb not null default '[]'::jsonb;
create unique index if not exists profiles_username_lower_idx on public.profiles (lower(username));

create table if not exists public.user_decks (          -- เด็คที่ผู้ใช้จัดไว้ (Deckbuilder)
  user_id     uuid not null references auth.users (id) on delete cascade,
  deck_id     text not null,
  name        text not null default '',
  data        jsonb not null,
  updated_at  timestamptz not null default now(),
  primary key (user_id, deck_id)
);

create table if not exists public.user_cards (          -- คอลเลกชันการ์ดของผู้ใช้
  user_id     uuid not null references auth.users (id) on delete cascade,
  card_id     text not null,
  qty         int  not null default 0 check (qty >= 0),
  primary key (user_id, card_id)
);

-- ---------- ร้านค้า ----------
create table if not exists public.shop_items (
  id          text primary key,                        -- เช่น pack-BT01, starter-SD01
  kind        text not null check (kind in ('pack','starter')),
  set_id      text not null,                           -- ผูกกับ card_sets.id
  name        text not null,
  description text not null default '',
  price       int  not null check (price >= 0),
  config      jsonb not null default '{}'::jsonb,      -- pack: {size,commonSlots,rareSlot{}} · starter: {copies}
  active      boolean not null default true,
  sort        int not null default 0
);

create table if not exists public.purchases (           -- ประวัติการซื้อ
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  item_id     text not null,
  qty         int not null default 1,
  price       int not null,
  at          timestamptz not null default now()
);
create index if not exists purchases_user_idx on public.purchases (user_id, at desc);

-- ---------- Update Note (ข่าวอัปเดตที่แอดมินเขียนใน /admin) + ค่าระบบเล็ก ๆ ----------
create table if not exists public.update_notes (
  id          text primary key,
  note_date   text not null,                           -- YYYY-MM-DD (วันที่ที่แสดง)
  title       text not null,
  items       jsonb not null default '[]'::jsonb,      -- รายการข้อความ ["…","…"]
  at          timestamptz not null default now()       -- เวลาที่สร้าง (ใช้เรียงลำดับ)
);

create table if not exists public.app_meta (            -- ค่าระบบเล็ก ๆ เช่น เครื่องหมาย "ใส่ข่าวเริ่มต้นแล้ว" (กันข่าวที่ลบไปแล้วกลับมาเอง)
  key         text primary key,
  value       jsonb not null default '{}'::jsonb
);

-- ---------- บันทึกกิจกรรม (ล็อกอิน / ซื้อของ / แอดมินแก้ข้อมูล) — ดูที่ /admin แท็บ "บันทึกกิจกรรม" ----------
create table if not exists public.audit_logs (
  id        bigint generated always as identity primary key,
  at        timestamptz not null default now(),
  user_id   uuid,
  username  text,
  action    text not null,
  status    int,
  ip        text,
  detail    jsonb
);
create index if not exists audit_logs_at_idx on public.audit_logs (at desc);

-- ---------- ประวัติแมตช์จับคู่ออนไลน์ (เก็บผล + รางวัลที่แจก) ----------
create table if not exists public.match_results (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  room        text,
  p0          uuid,
  p1          uuid,
  winner      int,                                     -- 0 | 1 | null = เสมอ
  secs        int,                                     -- ความยาวเกม (วินาที)
  reason      text,                                    -- finish | forfeit | timeout
  detail      jsonb                                    -- รางวัลของแต่ละฝั่ง
);
create index if not exists match_results_at_idx on public.match_results (at desc);

-- ---------- RLS: เปิดทุกตาราง ไม่มี policy = เฉพาะ service_role (เซิร์ฟเวอร์) เข้าถึงได้ ----------
alter table public.card_sets    enable row level security;
alter table public.cards        enable row level security;
alter table public.elements     enable row level security;
alter table public.card_backups enable row level security;
alter table public.profiles     enable row level security;
alter table public.user_decks   enable row level security;
alter table public.user_cards   enable row level security;
alter table public.shop_items   enable row level security;
alter table public.purchases    enable row level security;
alter table public.update_notes enable row level security;
alter table public.app_meta     enable row level security;
alter table public.audit_logs   enable row level security;
alter table public.match_results enable row level security;

-- ---------- สิทธิ์ให้เซิร์ฟเวอร์ (service_role) เข้าตารางผ่าน Data API ----------
-- โปรเจกต์ Supabase ใหม่ ๆ บางตัวไม่ให้สิทธิ์ตารางใหม่อัตโนมัติ → ไม่ใส่ = "Could not find the table ... in the schema cache"
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
notify pgrst, 'reload schema';
