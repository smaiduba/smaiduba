<script setup>
import { ref, onMounted, computed } from 'vue'
import { userSesi } from '../stores/auth'
import { supabase } from '../lib/supabase'
import { confirm } from '../lib/confirm'
import { ensureXLSX } from '../lib/xlsx-lazy'
import { getTahunPerTingkatLengkap } from '../lib/tahun'
import { theme, toggleTheme } from '../stores/theme'
import {
  Settings, Info, BookOpen, FileSpreadsheet,
  CheckCircle2, Loader2, Wifi, WifiOff, RefreshCw,
  Trash2, HardDrive, Server, User, CircleDot,
  Zap, Keyboard, ChevronRight, Lightbulb, ShieldCheck,
  Sun, Moon
} from 'lucide-vue-next'

const activeTab = ref('info')
const toast = ref('')

const tabs = [
  { id: 'info',    label: 'Sistem & Perawatan', desc: 'Status, koneksi, export, cache', icon: Info },
  { id: 'panduan', label: 'Panduan',            desc: 'Shortcut & alur kerja',          icon: BookOpen }
]

function showToast(msg) {
  toast.value = msg
  setTimeout(() => { toast.value = '' }, 3200)
}

// ═══════════════ EXPORT EXCEL (logika tidak berubah) ═══════════════
const exportLoading = ref(false)

async function exportAllExcel() {
  const ok = await confirm({
    title: 'Export Excel Profesional',
    message: 'Akan membuat 1 file Excel berisi 10 sheet — formatnya PERSIS sama dengan ekspor di menu masing-masing.\n\nLanjutkan?',
    variant: 'info',
    confirmText: 'Ya, Export'
  })
  if (!ok) return

  exportLoading.value = true
  try {
    const XLSX = await ensureXLSX()
    const [
      { data: siswaData,  error: e1 },
      { data: nilaiData,  error: e2 },
      { data: guruData,   error: e3 },
      { data: konfigData, error: e4 },
      { data: mapelData,  error: e5 },
      { data: nilaiMData, error: e6 }
    ] = await Promise.all([
      supabase.from('siswa').select('*').order('nama'),
      supabase.from('nilai').select('*'),
      supabase.from('guru').select('*').order('nama'),
      supabase.from('muadalah_konfig').select('*').order('tahun_ajaran').order('tingkat').order('semester'),
      supabase.from('muadalah_mapel').select('*').eq('is_active', true).order('urutan'),
      supabase.from('nilai_muadalah').select('*')
    ])
    const errs = [e1, e2, e3, e4, e5, e6].filter(Boolean)
    if (errs.length) throw new Error(errs[0].message)

    const now = new Date()
    const waktu = now.toLocaleDateString('id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
    const namaUser = userSesi.value?.user_metadata?.nama
      || userSesi.value?.user_metadata?.full_name
      || userSesi.value?.email
      || 'Administrator'

    const wb = XLSX.utils.book_new()
    buildSheetSiswa(XLSX, wb, siswaData || [], waktu, namaUser)
    buildSheetNilai(XLSX, wb, siswaData || [], nilaiData || [], waktu, namaUser)
    buildSheetMuadalahKonfig(XLSX, wb, konfigData || [], mapelData || [], waktu, namaUser)
    buildSheetMuadalahSemester(XLSX, wb, siswaData || [], konfigData || [], mapelData || [], nilaiMData || [], waktu, namaUser)
    buildSheetGuru(XLSX, wb, guruData || [], waktu, namaUser)

    XLSX.writeFile(wb, `SIMAK_Export_${now.toISOString().slice(0, 10)}.xlsx`)
    showToast('Export Excel berhasil — 10 sheet')
  } catch (e) {
    alert('Gagal export: ' + e.message)
  } finally {
    exportLoading.value = false
  }
}

// ─── Sheet builders (identik dengan versi sebelumnya) ───
function buildSheetSiswa(XLSX, wb, siswaRows, waktu, namaUser) {
  const EXPORT_COLUMNS = [
    { key: 'no_induk', label: 'No Induk', source: 'core' },
    { key: 'nama', label: 'Nama Lengkap', source: 'core' },
    { key: 'nisn', label: 'NISN', source: 'core' },
    { key: 'nik', label: 'NIK', source: 'core' },
    { key: 'no_kk', label: 'No KK', source: 'core' },
    { key: 'kelas', label: 'Kelas', source: 'core' },
    { key: 'status', label: 'Status', source: 'core' },
    { key: 'keterangan', label: 'Keterangan', source: 'core' },
    { key: 'kelamin', label: 'Jenis Kelamin', source: 'core' },
    { key: 'tempat_lahir', label: 'Tempat Lahir', source: 'core' },
    { key: 'tanggal_lahir', label: 'Tanggal Lahir', source: 'core' },
    { key: 'agama', label: 'Agama', source: 'core' },
    { key: 'anak_ke', label: 'Anak Ke-', source: 'core' },
    { key: 'alamat', label: 'Alamat Lengkap', source: 'core' },
    { key: 'no_telp', label: 'No HP/WA', source: 'core' },
    { key: 'nama_ayah', label: 'Nama Ayah', source: 'core' },
    { key: 'nama_ibu', label: 'Nama Ibu', source: 'core' },
    { key: 'ayah_pekerjaan', label: 'Pekerjaan Ayah', source: 'core' },
    { key: 'ibu_pekerjaan', label: 'Pekerjaan Ibu', source: 'core' },
    { key: 'asal_sekolah', label: 'Asal Sekolah', source: 'core' },
    { key: 'tetala', label: 'Tempat, Tgl Lahir', source: 'detail' },
    { key: 'alamat_singkat', label: 'Alamat Singkat', source: 'detail' },
    { key: 'sd', label: 'SD/MI Asal', source: 'detail' },
    { key: 'mts', label: 'SMP/MTs Asal', source: 'detail' },
    { key: 'alamat_mts', label: 'Alamat SMP/MTs', source: 'detail' },
    { key: 'npsn', label: 'NPSN', source: 'detail' },
    { key: 'mutasi', label: 'Asal Mutasi', source: 'detail' },
    { key: 'alamat_mutasi', label: 'Alamat Mutasi', source: 'detail' },
    { key: 'tetala_ayah', label: 'TTL Ayah', source: 'detail' },
    { key: 'sekolah_ayah', label: 'Pendidikan Ayah', source: 'detail' },
    { key: 'tetala_ibu', label: 'TTL Ibu', source: 'detail' },
    { key: 'sekolah_ibu', label: 'Pendidikan Ibu', source: 'detail' },
    { key: 'masuk', label: 'Tahun Masuk', source: 'detail' },
    { key: 'keluar', label: 'Tahun Keluar', source: 'detail' },
    { key: 'lanjut_s1', label: 'Lanjut S1', source: 'detail' },
    { key: 'prodi_s1', label: 'Prodi S1', source: 'detail' },
    { key: 'lanjut_s2', label: 'Lanjut S2', source: 'detail' },
    { key: 'prodi_s2', label: 'Prodi S2', source: 'detail' },
    { key: 'lanjut_s3', label: 'Lanjut S3', source: 'detail' },
    { key: 'prodi_s3', label: 'Prodi S3', source: 'detail' },
    { key: 'profesi1', label: 'Profesi 1', source: 'detail' },
    { key: 'tahun_profesi1', label: 'Tahun Profesi 1', source: 'detail' },
    { key: 'profesi2', label: 'Profesi 2', source: 'detail' },
    { key: 'tahun_profesi2', label: 'Tahun Profesi 2', source: 'detail' },
    { key: 'profesi3', label: 'Profesi 3', source: 'detail' },
    { key: 'tahun_profesi3', label: 'Tahun Profesi 3', source: 'detail' },
    { key: 'profesi4', label: 'Profesi 4', source: 'detail' },
    { key: 'tahun_profesi4', label: 'Tahun Profesi 4', source: 'detail' },
    { key: 'profesi5', label: 'Profesi 5', source: 'detail' },
    { key: 'tahun_profesi5', label: 'Tahun Profesi 5', source: 'detail' },
    { key: 'prestasi_kab', label: 'Prestasi Kabupaten', source: 'detail' },
    { key: 'prestasi_prov', label: 'Prestasi Provinsi', source: 'detail' },
    { key: 'prestasi_nas', label: 'Prestasi Nasional', source: 'detail' },
    { key: 'no_ijazah', label: 'No Ijazah', source: 'detail' },
    { key: 'tgl_kelulusan', label: 'Tanggal Kelulusan', source: 'detail' },
    { key: 'foto', label: 'URL Foto', source: 'detail' }
  ]
  const filtered = siswaRows.filter(s => {
    const st = String(s.status || '').toLowerCase()
    const ni = String(s.no_induk || '').toLowerCase()
    return !st.includes('angkatan') && !ni.includes('angkatan')
  })
  const aoa = [
    ['Waktu Pengunduhan:', waktu],
    ['Nama Pengunduh:', namaUser],
    ['Filter Pengunduhan:', 'Semua Data'],
    ['Total Siswa:', filtered.length],
    [],
    EXPORT_COLUMNS.map(c => c.label)
  ]
  filtered.forEach(it => {
    const detail = it.detail_data || {}
    aoa.push(EXPORT_COLUMNS.map(c => {
      const val = c.source === 'core' ? it[c.key] : detail[c.key]
      return val === null || val === undefined ? '' : String(val)
    }))
  })
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = EXPORT_COLUMNS.map(c => ({ wch: Math.max(12, Math.min(30, c.label.length + 3)) }))
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 5, c: 0 }, e: { r: 5 + filtered.length, c: EXPORT_COLUMNS.length - 1 } }) }
  XLSX.utils.book_append_sheet(wb, ws, 'Data Siswa')
}

function buildSheetNilai(XLSX, wb, siswaRows, nilaiRows, waktu, namaUser) {
  const MAPEL_LIST = [
    'Pendidikan Agama Islam dan Budi Pekerti', 'Pendidikan Pancasila', 'Bahasa Indonesia',
    'Matematika', 'Ilmu Pengetahuan Alam', 'Ilmu Pengetahuan Sosial', 'Bahasa Inggris',
    'Pendidikan Jasmani, Olahraga, dan Kesehatan', 'Informatika', 'Sejarah',
    'Seni Budaya dan Prakarya', 'Fisika', 'Kimia', 'Geografi', 'Ekonomi',
    'Bahasa Arab', 'Bahasa Daerah', 'Fiqih'
  ]
  const SEM_KEYS_ = ['smt1', 'smt2', 'smt3', 'smt4', 'smt5', 'smt6']
  const filtered = siswaRows.filter(s => {
    const st = String(s.status || '').toLowerCase()
    const ni = String(s.no_induk || '').toLowerCase()
    return !st.includes('angkatan') && !ni.includes('angkatan')
  }).sort((a, b) => (a.no_induk || '').localeCompare(b.no_induk || ''))

  const nilaiMap = {}
  nilaiRows.forEach(n => { nilaiMap[n.no_induk] = n.nilai_data || null })

  const h1 = [], h2 = [], merges = []
  const OFFSET = 5
  h1.push('No Induk', 'Nama'); h2.push('', '')
  merges.push({ s: { r: OFFSET, c: 0 }, e: { r: OFFSET + 1, c: 0 } })
  merges.push({ s: { r: OFFSET, c: 1 }, e: { r: OFFSET + 1, c: 1 } })
  let col = 2
  SEM_KEYS_.forEach((_, i) => {
    const start = col
    h1.push('Smt ' + (i + 1))
    for (let k = 1; k < 39; k++) h1.push('')
    merges.push({ s: { r: OFFSET, c: start }, e: { r: OFFSET, c: start + 38 } })
    h2.push('TAHUN'); MAPEL_LIST.forEach(mp => h2.push(mp))
    h2.push('JUMLAH', 'RATA-RATA'); MAPEL_LIST.forEach(mp => h2.push(mp))
    col += 39
  })
  const ijStart = col
  h1.push('IJAZAH'); for (let k = 1; k < 18; k++) h1.push('')
  MAPEL_LIST.forEach(mp => h2.push(mp))
  merges.push({ s: { r: OFFSET, c: ijStart }, e: { r: OFFSET, c: ijStart + 17 } }); col += 18
  h1.push('Rata-rata Ijazah'); h2.push('')
  merges.push({ s: { r: OFFSET, c: col }, e: { r: OFFSET + 1, c: col } })

  const aoa = [
    ['Waktu Pengunduhan:', waktu],
    ['Nama Pengunduh:', namaUser],
    ['Filter Pengunduhan:', 'Semester: Semua'],
    ['Total Siswa:', filtered.length],
    [],
    h1, h2
  ]

  filtered.forEach(item => {
    const nd = nilaiMap[item.no_induk] || {}
    const row = [item.no_induk || '', item.nama || '']
    SEM_KEYS_.forEach(sk => {
      const sem = nd[sk] || {}
      row.push(sem.tahun || '')
      let sumT = 0, cntT = 0
      for (const mp of MAPEL_LIST) {
        const cell = (sem.mapel || []).find(x => (x.mapel || '').trim() === mp)
        const t = cell?.teori || ''
        row.push(t)
        const p = parseFloat(t)
        if (!isNaN(p)) { sumT += p; cntT++ }
      }
      row.push(cntT > 0 ? sumT : '')
      row.push(cntT > 0 ? Number((sumT / cntT).toFixed(2)) : '')
      for (const mp of MAPEL_LIST) {
        const cell = (sem.mapel || []).find(x => (x.mapel || '').trim() === mp)
        row.push(cell?.praktek || '')
      }
    })
    let dknSum = 0, dknCnt = 0
    for (const mp of MAPEL_LIST) {
      const arr = []
      SEM_KEYS_.forEach(sk => {
        const sem = nd[sk] || {}
        const cell = (sem.mapel || []).find(x => (x.mapel || '').trim() === mp)
        const p = parseFloat(cell?.teori)
        if (!isNaN(p)) arr.push(p)
      })
      const dkn = arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null
      row.push(dkn !== null ? Number(dkn.toFixed(2)) : '')
      if (dkn !== null) { dknSum += dkn; dknCnt++ }
    }
    row.push(dknCnt > 0 ? Number((dknSum / dknCnt).toFixed(2)) : '')
    aoa.push(row)
  })

  const widths = [{ wch: 12 }, { wch: 28 }]
  for (let i = 0; i < 6; i++) {
    widths.push({ wch: 10 })
    for (let m = 0; m < 18; m++) widths.push({ wch: 11 })
    widths.push({ wch: 8 }, { wch: 9 })
    for (let m = 0; m < 18; m++) widths.push({ wch: 10 })
  }
  for (let m = 0; m < 18; m++) widths.push({ wch: 10 })
  widths.push({ wch: 12 })

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!merges'] = merges
  ws['!cols'] = widths
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: OFFSET + 1, c: 0 }, e: { r: OFFSET + 1 + filtered.length, c: h1.length - 1 } }) }
  XLSX.utils.book_append_sheet(wb, ws, 'Nilai Akademik')
}

function buildSheetMuadalahKonfig(XLSX, wb, konfigRows, mapelRows, waktu, namaUser) {
  const cfgAoa = [
    ['Waktu Pengunduhan:', waktu],
    ['Nama Pengunduh:', namaUser],
    []
  ]
  const cfgHeader = ['NO', 'TAHUN PELAJARAN', 'KELAS', 'SEMESTER']
  for (let i = 1; i <= 30; i++) cfgHeader.push('MAPEL ' + i)
  cfgAoa.push(cfgHeader)

  const mapelByCfg = {}
  mapelRows.forEach(m => { (mapelByCfg[m.konfig_id] ||= []).push(m) })
  konfigRows.forEach((c, idx) => {
    const mapels = mapelByCfg[c.id] || []
    const row = [idx + 1, c.tahun_ajaran, c.tingkat, c.semester]
    for (let i = 0; i < 30; i++) row.push(mapels[i]?.nama || '')
    cfgAoa.push(row)
  })

  const wsCfg = XLSX.utils.aoa_to_sheet(cfgAoa)
  wsCfg['!cols'] = [{ wch: 5 }, { wch: 14 }, { wch: 8 }, { wch: 10 }, ...Array(30).fill(null).map(() => ({ wch: 20 }))]
  XLSX.utils.book_append_sheet(wb, wsCfg, 'Konfigurasi')
}

function buildSheetMuadalahSemester(XLSX, wb, siswaRows, konfigRows, mapelRows, nilaiMRows, waktu, namaUser) {
  const mapelByCfg = {}
  mapelRows.forEach(m => { (mapelByCfg[m.konfig_id] ||= []).push(m) })

  const nilaiMap = {}
  nilaiMRows.forEach(n => {
    if (n.nilai !== null && n.nilai !== undefined) nilaiMap[`${n.no_induk}|${n.mapel_id}`] = Number(n.nilai)
  })

  const configByKey = {}
  konfigRows.forEach(c => { configByKey[`${c.tahun_ajaran}|${c.tingkat}|${c.semester}`] = c })

  const filtered = siswaRows.filter(s => {
    const st = String(s.status || '').toLowerCase()
    return !st.includes('angkatan') && !String(s.no_induk || '').toLowerCase().includes('angkatan')
  })

  const cfgRows = {}
  konfigRows.forEach(c => { cfgRows[c.id] = [] })

  const TINGKAT_SMT = [
    { tingkat: 'X', smt: 'I' }, { tingkat: 'X', smt: 'II' },
    { tingkat: 'XI', smt: 'I' }, { tingkat: 'XI', smt: 'II' },
    { tingkat: 'XII', smt: 'I' }, { tingkat: 'XII', smt: 'II' }
  ]

  filtered.forEach(s => {
    const tpt = getTahunPerTingkatLengkap(s)
    TINGKAT_SMT.forEach(({ tingkat, smt }) => {
      const tahunSlash = tpt[tingkat]
      if (!tahunSlash) return
      const tahunDash = tahunSlash.replace('/', '-')
      const cfg = configByKey[`${tahunDash}|${tingkat}|${smt}`]
      if (!cfg) return
      const mapels = mapelByCfg[cfg.id] || []
      const nilaiArr = []
      let sum = 0, count = 0
      for (let i = 0; i < 30; i++) {
        const m = mapels[i]
        if (!m) { nilaiArr.push(''); continue }
        const v = nilaiMap[`${s.no_induk}|${m.id}`]
        if (v !== undefined) { nilaiArr.push(v); sum += v; count++ }
        else nilaiArr.push('')
      }
      cfgRows[cfg.id].push({
        no_induk: s.no_induk, nama: s.nama, kelas: s.kelas || '', tahun: tahunDash,
        nilaiArr, jumlah: count > 0 ? sum : null, rata: count > 0 ? sum / count : null, rank: ''
      })
    })
  })

  Object.keys(cfgRows).forEach(cfgId => {
    const byKelas = {}
    cfgRows[cfgId].forEach(r => {
      const k = r.kelas || '(tanpa kelas)'
      ;(byKelas[k] ||= []).push(r)
    })
    Object.values(byKelas).forEach(arr => {
      arr.sort((a, b) => {
        if (a.rata === null && b.rata === null) return 0
        if (a.rata === null) return 1
        if (b.rata === null) return -1
        return b.rata - a.rata
      })
      let prevRata = null, prevRank = 0
      arr.forEach((r, i) => {
        if (r.rata === null) { r.rank = ''; return }
        if (prevRata !== null && Math.abs(r.rata - prevRata) < 0.001) r.rank = prevRank
        else { r.rank = i + 1; prevRank = i + 1; prevRata = r.rata }
      })
    })
  })

  const SEM_SHEETS = [
    { name: 'X I', tingkat: 'X', semester: 'I' },
    { name: 'X II', tingkat: 'X', semester: 'II' },
    { name: 'XI I', tingkat: 'XI', semester: 'I' },
    { name: 'XI II', tingkat: 'XI', semester: 'II' },
    { name: 'XII I', tingkat: 'XII', semester: 'I' },
    { name: 'XII II', tingkat: 'XII', semester: 'II' }
  ]

  SEM_SHEETS.forEach(ss => {
    const cfgList = konfigRows.filter(c => c.tingkat === ss.tingkat && c.semester === ss.semester)
    const aoa = [
      ['Waktu Pengunduhan:', waktu],
      ['Nama Pengunduh:', namaUser],
      ['Kelas:', ss.tingkat, '', 'Semester:', ss.semester],
      []
    ]
    const header = ['NO INDUK', 'NAMA', 'KELAS', 'TAHUN PELAJARAN']
    for (let i = 1; i <= 30; i++) header.push('N ' + i)
    header.push('JUMLAH', 'RATA-RATA', 'RANKING')
    aoa.push(header)

    const allRows = []
    cfgList.forEach(c => (cfgRows[c.id] || []).forEach(r => allRows.push(r)))
    allRows.sort((a, b) => {
      if (a.tahun !== b.tahun) return a.tahun.localeCompare(b.tahun)
      if (a.kelas !== b.kelas) return a.kelas.localeCompare(b.kelas)
      return (a.nama || '').localeCompare(b.nama || '')
    })

    if (allRows.length === 0) {
      aoa.push(['(Belum ada data untuk kelas/semester ini)'])
    } else {
      allRows.forEach(r => {
        const row = [r.no_induk, r.nama, r.kelas, r.tahun]
        for (let i = 0; i < 30; i++) {
          const v = r.nilaiArr[i]
          row.push(v === undefined || v === '' ? '' : Number(v))
        }
        row.push(r.jumlah !== null ? Number(r.jumlah.toFixed(2)) : '')
        row.push(r.rata !== null ? Number(r.rata.toFixed(2)) : '')
        row.push(r.rank !== '' ? r.rank : '')
        aoa.push(row)
      })
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws['!cols'] = [
      { wch: 12 }, { wch: 28 }, { wch: 10 }, { wch: 14 },
      ...Array(30).fill(null).map(() => ({ wch: 8 })),
      { wch: 10 }, { wch: 10 }, { wch: 10 }
    ]
    XLSX.utils.book_append_sheet(wb, ws, ss.name)
  })
}

function buildSheetGuru(XLSX, wb, guruRows, waktu, namaUser) {
  const EXPORT_COLUMNS = [
    { key: 'kg', label: 'KG' }, { key: 'nama', label: 'Nama' }, { key: 'alamat', label: 'Alamat' },
    { key: 'hp', label: 'No HP' }, { key: 'mapel_smt1', label: 'Mapel Smt I' },
    { key: 'kelas_smt1', label: 'Kelas Smt I' }, { key: 'hari_smt1', label: 'Hari Smt I' },
    { key: 'jam_smt1', label: 'Jam Smt I' }, { key: 'mapel_smt2', label: 'Mapel Smt II' },
    { key: 'kelas_smt2', label: 'Kelas Smt II' }, { key: 'hari_smt2', label: 'Hari Smt II' },
    { key: 'jam_smt2', label: 'Jam Smt II' }
  ]
  const filtered = guruRows.filter(g => g.kg && String(g.kg).trim())
  const aoa = [
    ['Waktu Pengunduhan:', waktu],
    ['Nama Pengunduh:', namaUser],
    ['Filter Pengunduhan:', 'Semua Data'],
    ['Total Guru:', filtered.length],
    [],
    EXPORT_COLUMNS.map(c => c.label),
    ...filtered.map(g => EXPORT_COLUMNS.map(c => g[c.key] || ''))
  ]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = EXPORT_COLUMNS.map(c => ({ wch: Math.max(12, Math.min(28, c.label.length + 4)) }))
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 5, c: 0 }, e: { r: 5 + filtered.length, c: EXPORT_COLUMNS.length - 1 } }) }
  XLSX.utils.book_append_sheet(wb, ws, 'Data Guru')
}

// ═══════════════ INFO & MAINTENANCE ═══════════════
const connStatus = ref('idle')
const connMessage = ref('')

async function testConnection() {
  connStatus.value = 'loading'
  connMessage.value = ''
  const start = performance.now()
  try {
    const { error } = await supabase.from('guru').select('kg').limit(1)
    if (error) throw error
    connStatus.value = 'ok'
    connMessage.value = `Terhubung (${Math.round(performance.now() - start)} ms)`
  } catch (e) {
    connStatus.value = 'error'
    connMessage.value = e.message || 'Gagal terhubung'
  }
}

const storageUsage = ref('—')
function calcStorage() {
  try {
    let total = 0
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      total += (k.length + (localStorage.getItem(k) || '').length) * 2
    }
    storageUsage.value = (total / 1024).toFixed(1) + ' KB'
  } catch { storageUsage.value = '—' }
}

async function clearCache() {
  const ok = await confirm({
    title: 'Bersihkan Cache Browser',
    message: 'Hapus SEMUA localStorage KECUALI pengaturan & tema.\n\nData di Supabase TIDAK terhapus.',
    variant: 'warning',
    confirmText: 'Ya, Bersihkan'
  })
  if (!ok) return
  try {
    const keepCfg = localStorage.getItem('app_pengaturan_v1')
    const keepTheme = localStorage.getItem('simak_theme')
    localStorage.clear()
    if (keepCfg) localStorage.setItem('app_pengaturan_v1', keepCfg)
    if (keepTheme) localStorage.setItem('simak_theme', keepTheme)
    calcStorage()
    showToast('Cache dibersihkan')
  } catch (e) {
    alert('Gagal: ' + e.message)
  }
}

const userEmail = computed(() => userSesi.value?.email || 'Tidak login')
const userInitial = computed(() => (userSesi.value?.email || 'A').charAt(0).toUpperCase())
const browserInfo = computed(() => {
  const ua = navigator.userAgent
  if (ua.includes('Edg/')) return 'Microsoft Edge'
  if (ua.includes('Chrome/')) return 'Chrome'
  if (ua.includes('Firefox/')) return 'Firefox'
  if (ua.includes('Safari/')) return 'Safari'
  return 'Browser'
})
const connLabel = computed(() =>
  connStatus.value === 'ok' ? 'Terhubung' :
  connStatus.value === 'error' ? 'Gagal' :
  connStatus.value === 'loading' ? 'Mengecek...' : 'Belum dicek'
)

onMounted(() => { calcStorage(); testConnection() })

// ═══════════════ PANDUAN ═══════════════
const shortcuts = [
  { keys: ['Esc'], desc: 'Tutup modal / dialog yang terbuka' },
  { keys: ['Enter'], desc: 'Konfirmasi dialog (jika bukan tombol aktif)' },
  { keys: ['↑', '↓'], desc: 'Navigasi dropdown / select option' },
  { keys: ['⌘', 'K'], desc: 'Buka pencarian cepat (header)' }
]
const workflows = [
  { no: '01', title: 'Tambah Siswa Baru', steps: 'Data Induk Siswa → SPMB → isi biodata → Simpan' },
  { no: '02', title: 'Input Nilai', steps: 'Nilai Akademik → pilih siswa → isi teori & praktek per mapel → Simpan' },
  { no: '03', title: 'Kelola Nabil / Sorogan', steps: 'Absensi Nabil / Sorogan → Tambah → pilih grup → centang siswa → Simpan' },
  { no: '04', title: 'Cetak Dokumen', steps: 'Pusat Cetak → pilih siswa → pilih jenis dokumen → Cetak' }
]
</script>

<template>
  <div class="p-3 sm:p-4 md:p-6 lg:p-8 max-w-[1200px] mx-auto space-y-4 md:space-y-5">

    <!-- HEADER -->
    <div class="relative overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-white via-white to-slate-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 p-5 sm:p-6 shadow-sm dark:shadow-none">
      <div class="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none"></div>
      <div class="relative flex items-center justify-between gap-3 flex-wrap">
        <div class="flex items-center gap-3.5 min-w-0">
          <div class="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
            <Settings class="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div class="min-w-0">
            <div class="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400/80">Pengaturan</div>
            <h1 class="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Toolkit Sistem</h1>
            <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">Backup, export, dan perawatan aplikasi</p>
          </div>
        </div>
        <Transition name="fade">
          <div v-if="toast"
               class="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
            <CheckCircle2 class="w-3.5 h-3.5" /> {{ toast }}
          </div>
        </Transition>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4 md:gap-5">

      <!-- SIDEBAR -->
      <aside class="lg:sticky lg:top-4 lg:self-start">
        <nav class="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0">
          <button v-for="t in tabs" :key="t.id" @click="activeTab = t.id"
                  :class="[
                    'group flex items-center gap-3 px-3.5 py-3 rounded-2xl border text-left transition min-w-[210px] lg:min-w-0',
                    activeTab === t.id
                      ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/40 shadow-sm dark:shadow-lg dark:shadow-emerald-900/20'
                      : 'bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900'
                  ]">
            <div :class="[
                  'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition',
                  activeTab === t.id
                    ? 'bg-emerald-500 text-white dark:text-slate-950'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200'
                ]">
              <component :is="t.icon" class="w-4 h-4" />
            </div>
            <div class="min-w-0 flex-1">
              <div :class="['text-[13px] font-bold truncate',
                activeTab === t.id ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-800 dark:text-slate-200']">{{ t.label }}</div>
              <div class="text-[10.5px] text-slate-500 truncate">{{ t.desc }}</div>
            </div>
            <ChevronRight :class="['w-4 h-4 hidden lg:block shrink-0',
              activeTab === t.id ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-300 dark:text-slate-700']" />
          </button>
        </nav>

        <!-- Ringkasan -->
        <div class="hidden lg:block mt-4 p-4 rounded-2xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 space-y-3">
          <div class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Ringkasan</div>
          <div class="flex items-center justify-between text-xs">
            <span class="text-slate-500 dark:text-slate-400">Versi</span>
            <span class="font-mono text-slate-800 dark:text-slate-200">v2.0.0</span>
          </div>
          <div class="flex items-center justify-between text-xs">
            <span class="text-slate-500 dark:text-slate-400">Koneksi</span>
            <span :class="['font-semibold',
              connStatus === 'ok' ? 'text-emerald-600 dark:text-emerald-400' :
              connStatus === 'error' ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400']">{{ connLabel }}</span>
          </div>
          <div class="flex items-center justify-between text-xs">
            <span class="text-slate-500 dark:text-slate-400">Storage</span>
            <span class="font-mono text-slate-800 dark:text-slate-200 tabular-nums">{{ storageUsage }}</span>
          </div>
        </div>
      </aside>

      <!-- KONTEN -->
      <main class="min-w-0">

        <!-- ═══ SISTEM & PERAWATAN ═══ -->
        <div v-if="activeTab === 'info'" class="space-y-4">

          <!-- Tema -->
          <section class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4 sm:p-5 shadow-sm dark:shadow-none">
            <div class="flex items-center justify-between gap-4 flex-wrap">
              <div class="flex items-center gap-3 min-w-0">
                <div class="w-11 h-11 rounded-xl bg-amber-100 dark:bg-indigo-500/15 border border-amber-200 dark:border-indigo-500/30 flex items-center justify-center shrink-0">
                  <Sun v-if="theme === 'light'" class="w-5 h-5 text-amber-500" />
                  <Moon v-else class="w-5 h-5 text-indigo-400" />
                </div>
                <div class="min-w-0">
                  <h2 class="text-sm font-bold text-slate-900 dark:text-white">Tampilan</h2>
                  <p class="text-[11.5px] text-slate-500 dark:text-slate-400">Mode saat ini: <b class="text-slate-800 dark:text-slate-200">{{ theme === 'dark' ? 'Gelap' : 'Terang' }}</b></p>
                </div>
              </div>
              <!-- Segmented toggle -->
              <div class="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <button @click="theme !== 'light' && toggleTheme()"
                        :class="['h-8 px-3.5 rounded-lg text-[12px] font-semibold inline-flex items-center gap-1.5 transition',
                          theme === 'light' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200']">
                  <Sun class="w-3.5 h-3.5" /> Terang
                </button>
                <button @click="theme !== 'dark' && toggleTheme()"
                        :class="['h-8 px-3.5 rounded-lg text-[12px] font-semibold inline-flex items-center gap-1.5 transition',
                          theme === 'dark' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200']">
                  <Moon class="w-3.5 h-3.5" /> Gelap
                </button>
              </div>
            </div>
          </section>

          <!-- Export -->
          <section class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4 sm:p-5 shadow-sm dark:shadow-none">
            <div class="flex items-start gap-4">
              <div class="w-11 h-11 rounded-xl bg-blue-100 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/30 flex items-center justify-center shrink-0">
                <FileSpreadsheet class="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div class="flex-1 min-w-0">
                <h2 class="text-sm font-bold text-slate-900 dark:text-white">Export Excel Gabungan</h2>
                <p class="text-[11.5px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                  Satu file berisi <b class="text-blue-700 dark:text-blue-300">10 sheet</b> dengan format identik seperti ekspor di menu Siswa, Nilai, Muadalah, dan Guru.
                </p>
                <div class="flex flex-wrap gap-1.5 mt-2.5">
                  <span v-for="s in ['Data Siswa','Nilai','Konfigurasi','Muadalah ×6','Data Guru']" :key="s"
                        class="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-600 dark:text-slate-300">{{ s }}</span>
                </div>
              </div>
            </div>
            <button @click="exportAllExcel" :disabled="exportLoading"
                    class="mt-4 w-full sm:w-auto inline-flex items-center justify-center gap-2 h-10 px-5 rounded-xl bg-blue-600 hover:bg-blue-500 dark:bg-blue-500 dark:hover:bg-blue-400 text-white dark:text-slate-950 text-[13px] font-bold transition disabled:opacity-50 disabled:cursor-not-allowed">
              <Loader2 v-if="exportLoading" class="w-4 h-4 animate-spin" />
              <FileSpreadsheet v-else class="w-4 h-4" />
              {{ exportLoading ? 'Menyiapkan file...' : 'Export Sekarang' }}
            </button>
          </section>

          <!-- Status -->
          <section class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 overflow-hidden shadow-sm dark:shadow-none">
            <div class="px-4 sm:px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 flex items-center gap-2">
              <ShieldCheck class="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h2 class="text-[12px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Status Sistem</h2>
            </div>
            <div class="divide-y divide-slate-200 dark:divide-slate-800/70">

              <div class="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5">
                <div class="flex items-center gap-3 min-w-0">
                  <Server class="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div class="min-w-0">
                    <div class="text-[13px] text-slate-800 dark:text-slate-200 font-semibold">Aplikasi</div>
                    <div class="text-[11px] text-slate-500 truncate">Vue 3 · Vite · Tailwind</div>
                  </div>
                </div>
                <span class="font-mono text-xs text-slate-700 dark:text-slate-300 shrink-0">SIMAK v2.0.0</span>
              </div>

              <div class="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5">
                <div class="flex items-center gap-3 min-w-0">
                  <User class="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <div class="min-w-0">
                    <div class="text-[13px] text-slate-800 dark:text-slate-200 font-semibold">User Aktif</div>
                    <div class="text-[11px] text-slate-500 truncate">{{ userEmail }}</div>
                  </div>
                </div>
                <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {{ userInitial }}
                </div>
              </div>

              <div class="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5">
                <div class="flex items-center gap-3 min-w-0">
                  <HardDrive class="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                  <div class="min-w-0">
                    <div class="text-[13px] text-slate-800 dark:text-slate-200 font-semibold">Storage Browser</div>
                    <div class="text-[11px] text-slate-500 truncate">{{ browserInfo }} · localStorage</div>
                  </div>
                </div>
                <span class="font-mono text-xs text-slate-700 dark:text-slate-300 tabular-nums shrink-0">{{ storageUsage }}</span>
              </div>

              <div class="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5">
                <div class="flex items-center gap-3 min-w-0">
                  <Loader2 v-if="connStatus === 'loading'" class="w-4 h-4 text-slate-500 animate-spin shrink-0" />
                  <Wifi v-else-if="connStatus === 'ok'" class="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <WifiOff v-else-if="connStatus === 'error'" class="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                  <CircleDot v-else class="w-4 h-4 text-slate-400 shrink-0" />
                  <div class="min-w-0">
                    <div class="text-[13px] text-slate-800 dark:text-slate-200 font-semibold">Koneksi Supabase</div>
                    <div class="text-[11px] text-slate-500 truncate">{{ connMessage || 'Klik refresh untuk cek' }}</div>
                  </div>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <span :class="['px-2 py-0.5 rounded-md text-[10.5px] font-bold',
                    connStatus === 'ok' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' :
                    connStatus === 'error' ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400' :
                    'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300']">{{ connLabel }}</span>
                  <button @click="testConnection" :disabled="connStatus === 'loading'" title="Cek ulang"
                          class="h-8 w-8 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition disabled:opacity-50">
                    <RefreshCw :class="['w-3.5 h-3.5', connStatus === 'loading' ? 'animate-spin' : '']" />
                  </button>
                </div>
              </div>
            </div>
          </section>

          <!-- Perawatan -->
          <section class="rounded-2xl border border-amber-300 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/5 p-4 sm:p-5">
            <div class="flex items-center gap-2 mb-1">
              <Trash2 class="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <h2 class="text-[12px] font-bold text-amber-800 dark:text-amber-200 uppercase tracking-wider">Perawatan</h2>
            </div>
            <p class="text-[11.5px] text-slate-600 dark:text-slate-400 leading-relaxed">
              Bersihkan cache menghapus localStorage kecuali <b class="text-slate-800 dark:text-slate-200">pengaturan</b> dan <b class="text-slate-800 dark:text-slate-200">tema</b>.
              Data di Supabase tidak terpengaruh.
            </p>
            <div class="flex flex-col sm:flex-row gap-2 mt-3">
              <button @click="clearCache"
                      class="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-amber-100 hover:bg-amber-200 dark:bg-amber-500/15 dark:hover:bg-amber-500/25 border border-amber-300 dark:border-amber-500/30 text-amber-800 dark:text-amber-300 text-[12.5px] font-semibold transition">
                <Trash2 class="w-4 h-4" /> Bersihkan Cache Browser
              </button>
              <button @click="testConnection"
                      class="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-[12.5px] font-semibold transition">
                <Zap class="w-4 h-4" /> Cek Ulang Koneksi
              </button>
            </div>
          </section>
        </div>

        <!-- ═══ PANDUAN ═══ -->
        <div v-if="activeTab === 'panduan'" class="space-y-4">

          <section class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 overflow-hidden shadow-sm dark:shadow-none">
            <div class="px-4 sm:px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 flex items-center gap-2">
              <Keyboard class="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h2 class="text-[12px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Shortcut Keyboard</h2>
            </div>
            <div class="divide-y divide-slate-200 dark:divide-slate-800/70">
              <div v-for="(s, i) in shortcuts" :key="i"
                   class="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                <div class="text-[12.5px] text-slate-700 dark:text-slate-300">{{ s.desc }}</div>
                <div class="flex items-center gap-1 shrink-0">
                  <template v-for="(k, ki) in s.keys" :key="ki">
                    <kbd class="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 border-b-2 text-[10.5px] font-mono font-semibold text-slate-700 dark:text-slate-200 min-w-[24px] text-center">{{ k }}</kbd>
                    <span v-if="ki < s.keys.length - 1" class="text-slate-400 dark:text-slate-600 text-[10px]">+</span>
                  </template>
                </div>
              </div>
            </div>
          </section>

          <section>
            <div class="flex items-center gap-2 mb-2 px-1">
              <Zap class="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h2 class="text-[12px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Alur Kerja Umum</h2>
            </div>
            <ol class="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              <li v-for="w in workflows" :key="w.no"
                  class="p-4 rounded-2xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm dark:shadow-none transition">
                <div class="flex items-start gap-3">
                  <div class="text-[22px] font-black text-slate-200 dark:text-slate-700 leading-none tabular-nums">{{ w.no }}</div>
                  <div class="min-w-0">
                    <div class="text-[13px] font-bold text-slate-900 dark:text-white mb-1">{{ w.title }}</div>
                    <div class="text-[11.5px] text-slate-500 dark:text-slate-400 leading-relaxed">{{ w.steps }}</div>
                  </div>
                </div>
              </li>
            </ol>
          </section>

          <section class="rounded-2xl border border-blue-200 dark:border-blue-500/25 bg-blue-50 dark:bg-blue-500/5 p-4 sm:p-5">
            <div class="flex items-start gap-3">
              <Lightbulb class="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div class="text-[12px] text-slate-700 dark:text-blue-100/90 leading-relaxed">
                <div class="font-bold text-blue-700 dark:text-blue-300 mb-1">Tips</div>
                <ul class="space-y-1 list-disc list-inside marker:text-blue-500">
                  <li>Backup JSON di awal & akhir semester.</li>
                  <li>Gunakan Excel untuk laporan ke yayasan/dinas.</li>
                  <li>Restore hanya dari file JSON.</li>
                </ul>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 200ms; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
