// ============================================================
// Helper tahun pelajaran
// ============================================================

// Parse "2021/2022" atau "2021-2022" → [2021, 2022]
export function parseTahunRange(str) {
  const s = String(str || '').trim()
  if (!s) return null
  // Format lengkap: "2024/2025", "2024-2025"
  let m = s.match(/(\d{4})\D+(\d{4})/)
  if (m) return [parseInt(m[1], 10), parseInt(m[2], 10)]
  // Format tahun tunggal: "2024" → anggap "2024/2025"
  m = s.match(/^(\d{4})$/)
  if (m) {
    const y = parseInt(m[1], 10)
    return [y, y + 1]
  }
  return null
}

// Normalisasi ke "YYYY/YYYY"
export function normalizeTahun(str) {
  const p = parseTahunRange(str)
  return p ? `${p[0]}/${p[1]}` : ''
}

// Dari masuk, derive 3 tahun
export function deriveTahunPerTingkat(masuk) {
  const p = parseTahunRange(masuk)
  if (!p) return { X: '', XI: '', XII: '' }
  const y = p[0]
  return {
    X:   `${y}/${y+1}`,
    XI:  `${y+1}/${y+2}`,
    XII: `${y+2}/${y+3}`
  }
}

// Tahun untuk satu tingkat: explicit > derived > kosong
export function getTahunUntukTingkat(siswa, tingkat) {
  const explicit = siswa?.detail_data?.tahun_per_tingkat?.[tingkat]
  if (explicit) {
    const n = normalizeTahun(explicit)
    if (n) return n
  }
  const d = deriveTahunPerTingkat(siswa?.detail_data?.masuk)
  return d[tingkat] || ''
}

// Dari tahun ajaran (2022/2023), cari tingkat mana (X/XI/XII) untuk siswa ini
export function getTingkatUntukTahun(siswa, tahunAjaran) {
  const p = parseTahunRange(tahunAjaran)
  if (!p) return null
  const target = p[0]
  for (const tingkat of ['X', 'XI', 'XII']) {
    const t = getTahunUntukTingkat(siswa, tingkat)
    const tp = parseTahunRange(t)
    if (tp && tp[0] === target) return tingkat
  }
  return null
}

// Ambil 3 tahun sekaligus (untuk prefill form edit)
export function getTahunPerTingkatLengkap(siswa) {
  const derived = deriveTahunPerTingkat(siswa?.detail_data?.masuk)
  const explicit = siswa?.detail_data?.tahun_per_tingkat || {}
  return {
    X:   normalizeTahun(explicit.X)   || derived.X,
    XI:  normalizeTahun(explicit.XI)  || derived.XI,
    XII: normalizeTahun(explicit.XII) || derived.XII
  }
}