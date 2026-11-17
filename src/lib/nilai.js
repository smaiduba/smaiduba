// ============================================================
// Pure helpers untuk nilai akademik
// Tidak depend ke Vue, Supabase, atau XLSX
// ============================================================

export const SEM_KEYS = ['smt1', 'smt2', 'smt3', 'smt4', 'smt5', 'smt6']

export function potongDuaDesimal(n) {
  if (n === null || n === undefined || n === '') return ''
  const s = String(n)
  const m = s.match(/^(-?\d+)(?:\.(\d+))?/)
  if (!m) return ''
  const dec = (m[2] || '').substring(0, 2).padEnd(2, '0')
  return m[1] + '.' + dec
}

export function fmtNilai(v) {
  if (v === null || v === undefined || v === '') return '-'
  const n = parseFloat(v)
  if (isNaN(n)) return String(v)
  return potongDuaDesimal(n)
}

export function colorNilai(v) {
  if (v === null || v === undefined || v === '') return 'text-slate-500'
  const n = parseFloat(v)
  if (isNaN(n)) return 'text-slate-500'
  if (n >= 85) return 'text-emerald-400'
  if (n >= 70) return 'text-blue-400'
  if (n >= 60) return 'text-amber-400'
  return 'text-red-400'
}

// Rata-rata TEORI satu semester dari array mapel
export function hitungRata(mapelArr) {
  if (!mapelArr || mapelArr.length === 0) return null
  let sum = 0, cnt = 0
  for (const m of mapelArr) {
    const t = parseFloat(m.teori)
    if (!isNaN(t)) { sum += t; cnt++ }
  }
  return cnt > 0 ? sum / cnt : null
}

// DKN = rata-rata dari rata-rata per mapel (Opsi B — sesuai GAS)
// Terima full nilai_data JSONB, hitung dari 6 semester
export function hitungDKN(nilaiData) {
  if (!nilaiData) return null
  const mapelMap = {}
  for (const smt of SEM_KEYS) {
    const sem = nilaiData[smt]
    if (!sem || !sem.mapel) continue
    for (const m of sem.mapel) {
      const t = parseFloat(m.teori)
      if (!isNaN(t)) {
        const nama = (m.mapel || '-').trim()
        if (!mapelMap[nama]) mapelMap[nama] = []
        mapelMap[nama].push(t)
      }
    }
  }
  const perMapel = Object.values(mapelMap).map(arr => arr.reduce((a, b) => a + b, 0) / arr.length)
  if (perMapel.length === 0) return null
  return perMapel.reduce((a, b) => a + b, 0) / perMapel.length
}

// Versi formatted (string), dipakai untuk display
export function dknFormatted(nilaiData) {
  const v = hitungDKN(nilaiData)
  return v === null ? '-' : v.toFixed(2)
}

// Precompute semua yang dibutuhkan tabel (sekali per siswa, saat load)
export function precomputeNilai(nilai_data) {
  const smtRata = SEM_KEYS.map(k => nilai_data?.[k] ? hitungRata(nilai_data[k].mapel) : null)
  const dknNum = hitungDKN(nilai_data)
  return {
    smtRata,
    dkn: dknNum === null ? '-' : dknNum.toFixed(2)
  }
}