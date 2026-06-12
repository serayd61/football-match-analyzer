// ============================================================================
// BACKTEST SCRIPT — Dixon-Coles motorunu GERÇEK football-data.org verisinde
// walk-forward (data-leakage'sız) test eder.
//
// Kullanım:
//   npm run backtest -- PL          (Premier League)
//   npm run backtest -- PD          (La Liga)
//
// Env: FOOTBALL_DATA_API_KEY zorunlu. Supabase'e yazım için (opsiyonel)
//   NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
// .env.local / .env otomatik yüklenir (sıfır bağımlılık).
// ============================================================================

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import { backtest } from '../src/lib/statistical/statistical-agent';
import { loadTwoSeasons, FD_CODES } from '../src/lib/statistical/data-loader';

// --- Basit .env yükleyici (dotenv yok) ---------------------------------------
function loadEnv(file: string): void {
  const p = resolve(process.cwd(), file);
  if (!existsSync(p)) return;
  const content = readFileSync(p, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnv('.env.local');
loadEnv('.env');

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

async function main() {
  const code = (process.argv[2] || 'PL').toUpperCase();
  if (!FD_CODES.includes(code)) {
    console.error(`❌ Bilinmeyen lig kodu: ${code}. Geçerli: ${FD_CODES.join(', ')}`);
    process.exit(1);
  }

  if (!process.env.FOOTBALL_DATA_API_KEY) {
    console.error('❌ FOOTBALL_DATA_API_KEY tanımlı değil (.env.local).');
    process.exit(1);
  }

  console.log(`\n⚽ Dixon-Coles Backtest — ${code}`);
  console.log('📥 football-data.org\'dan 2 sezon çekiliyor (rate limit: ~7s)...\n');

  const { matches, seasons } = await loadTwoSeasons(code);
  console.log(`✅ ${matches.length} maç yüklendi (sezonlar: ${seasons.join(', ')})`);

  if (matches.length < 80) {
    console.warn(`⚠️ Yetersiz maç (${matches.length}). Walk-forward için en az ~80 önerilir.`);
  }

  console.log('🧮 Walk-forward backtest çalışıyor (her maç için yeniden fit)...\n');
  const t0 = Date.now();
  const result = backtest(matches, { minTrainMatches: 60, xi: 0.0025, iters: 120 });
  const secs = ((Date.now() - t0) / 1000).toFixed(1);

  console.log('┌─────────────────────────────────────────────┐');
  console.log(`│  DIXON-COLES BACKTEST SONUCU — ${code.padEnd(13)}│`);
  console.log('├─────────────────────────────────────────────┤');
  console.log(`│  Test edilen maç : ${String(result.totalMatches).padEnd(25)}│`);
  console.log(`│  1X2 doğruluk    : ${`${result.matchResult.correct}/${result.totalMatches} (${pct(result.matchResult.accuracy)})`.padEnd(25)}│`);
  console.log(`│  Üst/Alt 2.5     : ${`${result.overUnder25.correct}/${result.totalMatches} (${pct(result.overUnder25.accuracy)})`.padEnd(25)}│`);
  console.log(`│  KG Var/Yok      : ${`${result.btts.correct}/${result.totalMatches} (${pct(result.btts.accuracy)})`.padEnd(25)}│`);
  console.log(`│  Log-loss        : ${result.logLoss.toFixed(4).padEnd(25)}│`);
  console.log(`│  Brier score     : ${result.brierScore.toFixed(4).padEnd(25)}│`);
  console.log('└─────────────────────────────────────────────┘');
  console.log(`⏱️  ${secs}s\n`);
  console.log('ℹ️  Referans: gerçek futbol verisinde 1X2 için %50-55 bandı NORMAL ve iyidir (bahisçi marjı ~%53).');

  // --- Supabase'e yaz (opsiyonel, best-effort) -------------------------------
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    try {
      const supabase = createClient(url, key, { auth: { persistSession: false } });
      const { error } = await supabase.from('dc_backtest_results').insert({
        league_code: code,
        tested_matches: result.totalMatches,
        mr_accuracy: result.matchResult.accuracy,
        ou_accuracy: result.overUnder25.accuracy,
        btts_accuracy: result.btts.accuracy,
        log_loss: result.logLoss,
        brier: result.brierScore,
      });
      if (error) console.warn(`⚠️ Supabase yazımı başarısız: ${error.message}`);
      else console.log('💾 Sonuç dc_backtest_results tablosuna yazıldı.');
    } catch (e: any) {
      console.warn(`⚠️ Supabase yazımı atlandı: ${e?.message || e}`);
    }
  } else {
    console.log('ℹ️ Supabase env yok — sonuç DB\'ye yazılmadı (sadece konsol).');
  }
}

main().catch((e) => {
  console.error('❌ Backtest hatası:', e?.message || e);
  process.exit(1);
});
