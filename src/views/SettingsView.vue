<script setup>
import { ref, onMounted, computed } from 'vue'
import { userSesi } from '../stores/auth'
import { supabase } from '../lib/supabase'
import { confirm } from '../lib/confirm'
import { ensureXLSX } from '../lib/xlsx-lazy'
import { getTahunPerTingkatLengkap } from '../lib/tahun'
import {
  Database, Info, BookOpen, FileSpreadsheet,
  CheckCircle2, Loader2, Wifi, WifiOff, RefreshCw,
  Trash2, HardDrive, Server, User, CircleDot,
  Zap, Keyboard, HelpCircle
} from 'lucide-vue-next'

const activeTab = ref('info')
const toast = ref('')

const tabs = [
  { id: 'info',    label: 'Info & Maintenance', icon: Info },
  { id: 'panduan', label: 'Panduan',            icon: BookOpen }
]

function showToast(msg) {
  toast.value = msg
  setTimeout(() => { toast.value = '' }, 3200)
}

// ═══════════════════════════════════════════
// EXPORT EXCEL GABUNGAN (10 sheet)
// ═══════════════════════════════════════════
const exportLoading = ref(false)

async function exportAllExcel() {
  const ok = await confirm({
    title: 'Export Excel Profesional',
    message: 'Akan membuat 1 file Excel berisi 10 sheet — formatnya PERSIS sama dengan ekspor di menu masing-masing:\n\n1. Data Siswa (57 kolom)\n2. Nilai Akademik (255 kolom, 6 semester + IJAZAH + DKN)\n3. Konfigurasi Muadalah\n4–9. Muadalah X I · X II · XI I · XI II · XII I · XII II\n10. Data Guru (12 kolom)\n\nLanjutkan?',
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

    const date = now.toISOString().slice(0, 10)
    XLSX.writeFile(wb, `SIMAK_Export_${date}.xlsx`)
    showToast('Export Excel berhasil — 10 sheet')
  } catch (e) {
    alert('Gagal export: ' + e.message)
  } finally {
    exportLoading.value = false
  }
}

// ─── Sheet 1: DATA SISWA (persis EXPORT_COLUMNS SiswaView) ───
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

  const aoa = []
  aoa.push(['Waktu Pengunduhan:', waktu])
  aoa.push(['Nama Pengunduh:', namaUser])
  aoa.push(['Filter Pengunduhan:', 'Semua Data'])
  aoa.push(['Total Siswa:', filtered.length])
  aoa.push([])
  aoa.push(EXPORT_COLUMNS.map(c => c.label))

  filtered.forEach(it => {
    const detail = it.detail_data || {}
    const row = EXPORT_COLUMNS.map(c => {
      const val = c.source === 'core' ? it[c.key] : detail[c.key]
      if (val === null || val === undefined) return ''
      return String(val)
    })
    aoa.push(row)
  })

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = EXPORT_COLUMNS.map(c => ({ wch: Math.max(12, Math.min(30, c.label.length + 3)) }))
  ws['!autofilter'] = {
    ref: XLSX.utils.encode_range({ s: { r: 5, c: 0 }, e: { r: 5 + filtered.length, c: EXPORT_COLUMNS.length - 1 } })
  }
  XLSX.utils.book_append_sheet(wb, ws, 'Data Siswa')
}

// ─── Sheet 2: NILAI AKADEMIK (persis exportDo NilaiView, mode semua semester) ───
function buildSheetNilai(XLSX, wb, siswaRows, nilaiRows, waktu, namaUser) {
  const MAPEL_LIST = [
    'Pendidikan Agama Islam dan Budi Pekerti', 'Pendidikan Pancasila', 'Bahasa Indonesia',
    'Matematika', 'Ilmu Pengetahuan Alam', 'Ilmu Pengetahuan Sosial', 'Bahasa Inggris',
    'Pendidikan Jasmani, Olahraga, dan Kesehatan', 'Informatika', 'Sejarah',
    'Seni Budaya dan Prakarya', 'Fisika', 'Kimia', 'Geografi', 'Ekonomi',
    'Bahasa Arab', 'Bahasa Daerah', 'Fiqih'
  ]
  const SEM_KEYS_ = ['smt1', 'smt2', 'smt3', 'smt4', 'smt5', 'smt6']
  const semKeys = SEM_KEYS_

  const filtered = siswaRows.filter(s => {
    const st = String(s.status || '').toLowerCase()
    const ni = String(s.no_induk || '').toLowerCase()
    return !st.includes('angkatan') && !ni.includes('angkatan')
  }).sort((a, b) => (a.no_induk || '').localeCompare(b.no_induk || ''))

  const nilaiMap = {}
  nilaiRows.forEach(n => { nilaiMap[n.no_induk] = n.nilai_data || null })

  const h1 = [], h2 = [], merges = []
  const OFFSET = 5
  h1.push('No Induk', 'Nama')
  h2.push('', '')
  merges.push({ s: { r: OFFSET, c: 0 }, e: { r: OFFSET + 1, c: 0 } })
  merges.push({ s: { r: OFFSET, c: 1 }, e: { r: OFFSET + 1, c: 1 } })
  let col = 2

  semKeys.forEach((sk, i) => {
    const start = col
    h1.push('Smt ' + (i + 1))
    for (let k = 1; k < 39; k++) h1.push('')
    merges.push({ s: { r: OFFSET, c: start }, e: { r: OFFSET, c: start + 38 } })
    h2.push('TAHUN')
    for (const mp of MAPEL_LIST) h2.push(mp)
    h2.push('JUMLAH', 'RATA-RATA')
    for (const mp of MAPEL_LIST) h2.push(mp)
    col += 39
  })

  const ijStart = col
  h1.push('IJAZAH'); for (let k = 1; k < 18; k++) h1.push('')
  for (const mp of MAPEL_LIST) h2.push(mp)
  merges.push({ s: { r: OFFSET, c: ijStart }, e: { r: OFFSET, c: ijStart + 17 } }); col += 18
  h1.push('Rata-rata Ijazah'); h2.push('')
  merges.push({ s: { r: OFFSET, c: col }, e: { r: OFFSET + 1, c: col } })

  const aoa = []
  aoa.push(['Waktu Pengunduhan:', waktu])
  aoa.push(['Nama Pengunduh:', namaUser])
  aoa.push(['Filter Pengunduhan:', 'Semester: Semua'])
  aoa.push(['Total Siswa:', filtered.length])
  aoa.push([])
  aoa.push(h1)
  aoa.push(h2)

  filtered.forEach(item => {
    const nd = nilaiMap[item.no_induk] || {}
    const row = [item.no_induk || '', item.nama || '']
    semKeys.forEach(sk => {
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
  ws['!autofilter'] = {
    ref: XLSX.utils.encode_range({
      s: { r: OFFSET + 1, c: 0 },
      e: { r: OFFSET + 1 + filtered.length, c: h1.length - 1 }
    })
  }
  XLSX.utils.book_append_sheet(wb, ws, 'Nilai Akademik')
}

// ─── Sheet 3: KONFIGURASI MUADALAH (persis doExport MuadalahView) ───
function buildSheetMuadalahKonfig(XLSX, wb, konfigRows, mapelRows, waktu, namaUser) {
  const cfgAoa = []
  cfgAoa.push(['Waktu Pengunduhan:', waktu])
  cfgAoa.push(['Nama Pengunduh:', namaUser])
  cfgAoa.push([])

  const cfgHeader = ['NO', 'TAHUN PELAJARAN', 'KELAS', 'SEMESTER']
  for (let i = 1; i <= 30; i++) cfgHeader.push('MAPEL ' + i)
  cfgAoa.push(cfgHeader)

  const mapelByCfg = {}
  mapelRows.forEach(m => {
    if (!mapelByCfg[m.konfig_id]) mapelByCfg[m.konfig_id] = []
    mapelByCfg[m.konfig_id].push(m)
  })

  konfigRows.forEach((c, idx) => {
    const mapels = mapelByCfg[c.id] || []
    const row = [idx + 1, c.tahun_ajaran, c.tingkat, c.semester]
    for (let i = 0; i < 30; i++) row.push(mapels[i]?.nama || '')
    cfgAoa.push(row)
  })

  const wsCfg = XLSX.utils.aoa_to_sheet(cfgAoa)
  wsCfg['!cols'] = [
    { wch: 5 }, { wch: 14 }, { wch: 8 }, { wch: 10 },
    ...Array(30).fill(null).map(() => ({ wch: 20 }))
  ]
  XLSX.utils.book_append_sheet(wb, wsCfg, 'Konfigurasi')
}

// ─── Sheet 4–9: MUADALAH per TINGKAT/SEMESTER ───
function buildSheetMuadalahSemester(XLSX, wb, siswaRows, konfigRows, mapelRows, nilaiMRows, waktu, namaUser) {
  const mapelByCfg = {}
  mapelRows.forEach(m => {
    if (!mapelByCfg[m.konfig_id]) mapelByCfg[m.konfig_id] = []
    mapelByCfg[m.konfig_id].push(m)
  })

  const nilaiMap = {}
  nilaiMRows.forEach(n => {
    if (n.nilai !== null && n.nilai !== undefined) {
      nilaiMap[`${n.no_induk}|${n.mapel_id}`] = Number(n.nilai)
    }
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
    { tingkat: 'X',   smt: 'I'  }, { tingkat: 'X',   smt: 'II' },
    { tingkat: 'XI',  smt: 'I'  }, { tingkat: 'XI',  smt: 'II' },
    { tingkat: 'XII', smt: 'I'  }, { tingkat: 'XII', smt: 'II' }
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
        no_induk: s.no_induk,
        nama: s.nama,
        kelas: s.kelas || '',
        tahun: tahunDash,
        nilaiArr,
        jumlah: count > 0 ? sum : null,
        rata: count > 0 ? sum / count : null,
        rank: ''
      })
    })
  })

  Object.keys(cfgRows).forEach(cfgId => {
    const rows = cfgRows[cfgId]
    const byKelas = {}
    rows.forEach(r => {
      const k = r.kelas || '(tanpa kelas)'
      if (!byKelas[k]) byKelas[k] = []
      byKelas[k].push(r)
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
    { name: 'X I',   tingkat: 'X',   semester: 'I'  },
    { name: 'X II',  tingkat: 'X',   semester: 'II' },
    { name: 'XI I',  tingkat: 'XI',  semester: 'I'  },
    { name: 'XI II', tingkat: 'XI',  semester: 'II' },
    { name: 'XII I', tingkat: 'XII', semester: 'I'  },
    { name: 'XII II', tingkat: 'XII', semester: 'II' }
  ]

  SEM_SHEETS.forEach(ss => {
    const cfgList = konfigRows.filter(c => c.tingkat === ss.tingkat && c.semester === ss.semester)

    const aoa = []
    aoa.push(['Waktu Pengunduhan:', waktu])
    aoa.push(['Nama Pengunduh:', namaUser])
    aoa.push(['Kelas:', ss.tingkat, '', 'Semester:', ss.semester])
    aoa.push([])

    const header = ['NO INDUK', 'NAMA', 'KELAS', 'TAHUN PELAJARAN']
    for (let i = 1; i <= 30; i++) header.push('N ' + i)
    header.push('JUMLAH', 'RATA-RATA', 'RANKING')
    aoa.push(header)

    const allRows = []
    cfgList.forEach(c => { (cfgRows[c.id] || []).forEach(r => allRows.push(r)) })

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

// ─── Sheet 10: DATA GURU (persis exportDo GuruView) ───
function buildSheetGuru(XLSX, wb, guruRows, waktu, namaUser) {
  const EXPORT_COLUMNS = [
    { key: 'kg', label: 'KG' },
    { key: 'nama', label: 'Nama' },
    { key: 'alamat', label: 'Alamat' },
    { key: 'hp', label: 'No HP' },
    { key: 'mapel_smt1', label: 'Mapel Smt I' },
    { key: 'kelas_smt1', label: 'Kelas Smt I' },
    { key: 'hari_smt1', label: 'Hari Smt I' },
    { key: 'jam_smt1', label: 'Jam Smt I' },
    { key: 'mapel_smt2', label: 'Mapel Smt II' },
    { key: 'kelas_smt2', label: 'Kelas Smt II' },
    { key: 'hari_smt2', label: 'Hari Smt II' },
    { key: 'jam_smt2', label: 'Jam Smt II' }
  ]

  const filtered = guruRows.filter(g => g.kg && String(g.kg).trim())

  const aoa = []
  aoa.push(['Waktu Pengunduhan:', waktu])
  aoa.push(['Nama Pengunduh:', namaUser])
  aoa.push(['Filter Pengunduhan:', 'Semua Data'])
  aoa.push(['Total Guru:', filtered.length])
  aoa.push([])
  aoa.push(EXPORT_COLUMNS.map(c => c.label))

  filtered.forEach(g => {
    aoa.push(EXPORT_COLUMNS.map(c => g[c.key] || ''))
  })

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = EXPORT_COLUMNS.map(c => ({ wch: Math.max(12, Math.min(28, c.label.length + 4)) }))
  ws['!autofilter'] = {
    ref: XLSX.utils.encode_range({ s: { r: 5, c: 0 }, e: { r: 5 + filtered.length, c: EXPORT_COLUMNS.length - 1 } })
  }
  XLSX.utils.book_append_sheet(wb, ws, 'Data Guru')
}

// ═══════════════════════════════════════════
// INFO & MAINTENANCE
// ═══════════════════════════════════════════
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
      const v = localStorage.getItem(k) || ''
      total += (k.length + v.length) * 2
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

onMounted(() => {
  calcStorage()
  testConnection()
})

// ═══════════════════════════════════════════
// PANDUAN
// ═══════════════════════════════════════════
const shortcuts = [
  { keys: ['Esc'], desc: 'Tutup modal / dialog yang terbuka' },
  { keys: ['Enter'], desc: 'Konfirmasi dialog (jika bukan tombol aktif)' },
  { keys: ['↑', '↓'], desc: 'Navigasi dropdown / select option' },
  { keys: ['⌘', 'K'], desc: 'Buka pencarian cepat (header)' }
]

const workflows = [
  { title: 'Tambah Siswa Baru', steps: 'Data Induk Siswa → SPMB → isi biodata → Simpan' },
  { title: 'Input Nilai', steps: 'Nilai Akademik → pilih siswa → isi teori & praktek per mapel → Simpan' },
  { title: 'Kelola Nabil / Sorogan', steps: 'Absensi Nabil / Sorogan → Tambah → pilih grup → centang siswa → Simpan' },
  { title: 'Cetak Dokumen', steps: 'Pusat Cetak → pilih siswa → pilih jenis dokumen → Cetak' }
]
</script>

<template>
  <div class="p-4 md:p-6 lg:p-8 max-w-[1200px] mx-auto space-y-5">

    <!-- HEADER -->
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center shadow-lg shadow-slate-900/40">
          <Database class="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 class="text-2xl md:text-3xl font-bold text-white tracking-tight">Toolkit</h1>
          <p class="text-sm text-slate-500 mt-1">Backup, export, dan utility sistem</p>
        </div>
      </div>
      <Transition name="fade">
        <div v-if="toast"
             class="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
          <CheckCircle2 class="w-3.5 h-3.5" /> {{ toast }}
        </div>
      </Transition>
    </div>

    <!-- TABS -->
    <div class="flex gap-1 overflow-x-auto p-1 bg-slate-900/50 border border-slate-800 rounded-2xl">
      <button v-for="t in tabs" :key="t.id" @click="activeTab = t.id"
              :class="[
                'flex items-center gap-2 px-4 h-10 rounded-xl text-[13px] font-semibold whitespace-nowrap transition border',
                activeTab === t.id
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60 border-transparent'
              ]">
        <component :is="t.icon" class="w-4 h-4" />
        {{ t.label }}
      </button>
    </div>

    <!-- CONTENT -->
    <div class="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 md:p-6">

      <!-- ═══ TAB: INFO & MAINTENANCE ═══ -->
      
      <div v-if="activeTab === 'info'" class="space-y-5">
        <div>
          <h2 class="text-base font-bold text-white mb-1">Info & Maintenance</h2>
          <p class="text-xs text-slate-500">Status sistem, koneksi, dan utilitas pembersihan</p>
        </div>

        <button @click="exportAllExcel" :disabled="exportLoading"
          class="group p-5 rounded-xl bg-gradient-to-br from-blue-500/15 to-blue-600/10 hover:from-blue-500/25 hover:to-blue-600/20 border border-blue-500/30 text-left transition disabled:opacity-50">
          <div class="flex items-center justify-between mb-2">
            <FileSpreadsheet class="w-6 h-6 text-blue-400" />
            <Loader2 v-if="exportLoading" class="w-4 h-4 text-blue-400 animate-spin" />
          </div>
          <div class="text-[14px] font-bold text-white">Export Excel Profesional</div>
          <div class="text-[11.5px] text-blue-200/70 mt-1 leading-relaxed">
            10 sheet — <b class="text-blue-300">format persis</b> dengan ekspor di menu Siswa, Nilai, Muadalah, dan Guru.
          </div>
        </button>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div class="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
            <div class="flex items-center gap-2 mb-2">
              <Server class="w-4 h-4 text-emerald-400" />
              <div class="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">Aplikasi</div>
            </div>
            <div class="text-sm font-bold text-white">SIMAK v2.0.0</div>
            <div class="text-[11px] text-slate-500 mt-0.5">Vue 3 · Vite · Tailwind</div>
          </div>

          <div class="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
            <div class="flex items-center gap-2 mb-2">
              <User class="w-4 h-4 text-blue-400" />
              <div class="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">User Aktif</div>
            </div>
            <div class="flex items-center gap-2">
              <div class="w-7 h-7 rounded-md bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-[11px] font-bold">
                {{ userInitial }}
              </div>
              <div class="text-sm font-semibold text-white truncate">{{ userEmail }}</div>
            </div>
          </div>

          <div class="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
            <div class="flex items-center gap-2 mb-2">
              <HardDrive class="w-4 h-4 text-purple-400" />
              <div class="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">Storage Browser</div>
            </div>
            <div class="text-sm font-bold text-white tabular-nums">{{ storageUsage }}</div>
            <div class="text-[11px] text-slate-500 mt-0.5">{{ browserInfo }} · localStorage</div>
          </div>

          <div class="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
            <div class="flex items-center gap-2 mb-2">
              <Wifi class="w-4 h-4 text-amber-400" />
              <div class="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">Koneksi Supabase</div>
            </div>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <Loader2 v-if="connStatus === 'loading'" class="w-4 h-4 text-slate-400 animate-spin" />
                <CircleDot v-else-if="connStatus === 'ok'" class="w-4 h-4 text-emerald-400" />
                <WifiOff v-else-if="connStatus === 'error'" class="w-4 h-4 text-red-400" />
                <CircleDot v-else class="w-4 h-4 text-slate-500" />
                <div :class="[
                  'text-sm font-bold',
                  connStatus === 'ok' ? 'text-emerald-400' :
                  connStatus === 'error' ? 'text-red-400' : 'text-slate-300'
                ]">
                  {{ connStatus === 'ok' ? 'OK' : connStatus === 'error' ? 'Gagal' : connStatus === 'loading' ? '...' : 'Belum dicek' }}
                </div>
              </div>
              <button @click="testConnection" :disabled="connStatus === 'loading'"
                      class="h-8 w-8 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 flex items-center justify-center transition disabled:opacity-50">
                <RefreshCw :class="['w-3.5 h-3.5', connStatus === 'loading' ? 'animate-spin' : '']" />
              </button>
            </div>
            <div class="text-[11px] text-slate-500 mt-1 truncate">{{ connMessage || 'Klik refresh untuk cek' }}</div>
          </div>
        </div>

        <div class="pt-4 border-t border-slate-800">
          <div class="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Maintenance</div>
          <div class="flex flex-col sm:flex-row gap-2">
            <button @click="clearCache"
                    class="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[12.5px] font-semibold transition">
              <Trash2 class="w-4 h-4" /> Bersihkan Cache Browser
            </button>
            <button @click="testConnection"
                    class="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[12.5px] font-semibold transition">
              <Zap class="w-4 h-4" /> Cek Ulang Koneksi
            </button>
          </div>
          <p class="text-[11px] text-slate-500 mt-2 leading-relaxed">
            <b class="text-slate-300">Bersihkan Cache</b> menghapus localStorage kecuali <b>pengaturan</b> dan <b>tema</b>.
            Data di Supabase aman.
          </p>
        </div>
      </div>

      <!-- ═══ TAB: PANDUAN ═══ -->
      <div v-if="activeTab === 'panduan'" class="space-y-5">
        <div>
          <h2 class="text-base font-bold text-white mb-1">Panduan Singkat</h2>
          <p class="text-xs text-slate-500">Shortcut keyboard & alur kerja umum</p>
        </div>

        <div>
          <div class="flex items-center gap-2 mb-2">
            <Keyboard class="w-4 h-4 text-emerald-400" />
            <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Shortcut</div>
          </div>
          <div class="rounded-xl border border-slate-800 divide-y divide-slate-800 overflow-hidden">
            <div v-for="(s, i) in shortcuts" :key="i"
                 class="flex items-center justify-between px-4 py-2.5 hover:bg-slate-800/30 transition">
              <div class="text-[12.5px] text-slate-300">{{ s.desc }}</div>
              <div class="flex items-center gap-1">
                <template v-for="(k, ki) in s.keys" :key="ki">
                  <kbd class="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-[10.5px] font-mono font-semibold text-slate-200 min-w-[24px] text-center">{{ k }}</kbd>
                  <span v-if="ki < s.keys.length - 1" class="text-slate-600 text-[10px]">+</span>
                </template>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div class="flex items-center gap-2 mb-2">
            <Zap class="w-4 h-4 text-blue-400" />
            <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Alur Kerja</div>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div v-for="(w, i) in workflows" :key="i"
                 class="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <div class="text-[12.5px] font-bold text-white mb-1">{{ w.title }}</div>
              <div class="text-[11.5px] text-slate-400 leading-relaxed">{{ w.steps }}</div>
            </div>
          </div>
        </div>

        <div class="p-4 rounded-xl bg-blue-500/5 border border-blue-500/30">
          <div class="flex items-start gap-3">
            <HelpCircle class="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            <div class="text-[12px] text-blue-200/90 leading-relaxed">
              <b class="text-blue-300">Tips:</b> Backup JSON di awal & akhir semester.
              Excel untuk laporan ke yayasan/dinas. Restore hanya dari file JSON.
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 200ms; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
