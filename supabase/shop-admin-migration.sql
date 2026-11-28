-- AvastFall TCG: รองรับการลบสินค้าจากหลังบ้านโดยไม่ให้ระบบสร้างสินค้าชุด BT/AT/SD กลับมาเอง
create table if not exists public.shop_item_suppressions (
  id text primary key,
  suppressed_at timestamptz not null default now()
);
