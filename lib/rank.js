// ระบบแต้มแรงก์ + รางวัลของแมตช์จับคู่ออนไลน์ (ใช้ร่วมกันระหว่างเซิร์ฟเวอร์ห้อง lib/playtest.js และโปรไฟล์ lib/auth.js)
// ปรับตัวเลขได้ด้วย environment variable โดยไม่ต้องแก้โค้ด
const num = (k, d) => { const n = Number(process.env[k]); return Number.isFinite(n) && process.env[k] !== undefined && process.env[k] !== "" ? n : d; };

const REWARD = {
  win:  { points: num("RANK_WIN", 25),   coins: num("COINS_WIN", 30) },
  loss: { points: -num("RANK_LOSS", 10), coins: num("COINS_LOSS", 5) },
  draw: { points: num("RANK_DRAW", 0),   coins: num("COINS_DRAW", 10) },
};
const MIN_SECS = num("MATCH_MIN_SECS", 60);          // เกมสั้นกว่านี้ไม่ได้รางวัล (กันสองบัญชีนัดกันยอมแพ้ทันที)
const DAILY_COIN_CAP = num("MATCH_DAILY_COIN_CAP", 300);   // เหรียญจากแมตช์จับคู่สูงสุดต่อคนต่อวัน (แต้มยังเปลี่ยนตามปกติ)
const PAIR_DAILY_CAP = num("MATCH_PAIR_DAILY_CAP", 5);     // เจอคู่เดิมแล้วได้รางวัลสูงสุดกี่ครั้งต่อวัน (กันปั๊มกับเพื่อน)

// ลีกตามแต้ม (น้อย → มาก)
const LEAGUES = [["BRONZE", 0], ["SILVER", 100], ["GOLD", 250], ["PLATINUM", 500], ["DIAMOND", 800], ["MASTER", 1200]];
function leagueOf(points) {
  const p = Math.max(0, Number(points) || 0); let cur = LEAGUES[0], next = null;
  for (let i = 0; i < LEAGUES.length; i++) if (p >= LEAGUES[i][1]) { cur = LEAGUES[i]; next = LEAGUES[i + 1] || null; }
  return { name: cur[0], from: cur[1], next: next ? { name: next[0], at: next[1] } : null };
}

// รางวัลเลื่อนแรงค์: ถึงแต้มของลีกไหนก็กดรับเหรียญของลีกนั้นได้ครั้งเดียว (BRONZE = ลีกเริ่มต้น ไม่มีรางวัล)
const LEAGUE_COINS = { BRONZE: 0, SILVER: num("RANK_UP_SILVER", 100), GOLD: num("RANK_UP_GOLD", 200), PLATINUM: num("RANK_UP_PLATINUM", 400), DIAMOND: num("RANK_UP_DIAMOND", 600), MASTER: num("RANK_UP_MASTER", 1000) };
const tiers = (points, claims) => {
  const p = Math.max(0, Number(points) || 0), got = new Set(Array.isArray(claims) ? claims : []);
  return LEAGUES.map(([name, at], i) => ({ name, at, upTo: LEAGUES[i + 1] ? LEAGUES[i + 1][1] : null, coins: LEAGUE_COINS[name] || 0,
    reached: p >= at, claimed: got.has(name), claimable: p >= at && !got.has(name) && (LEAGUE_COINS[name] || 0) > 0 }));
};
module.exports = { REWARD, MIN_SECS, DAILY_COIN_CAP, PAIR_DAILY_CAP, LEAGUES, LEAGUE_COINS, leagueOf, tiers };
