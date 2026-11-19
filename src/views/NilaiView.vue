<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { supabase } from '../lib/supabase'
import { userSesi } from '../stores/auth'
import { hitungRata, precomputeNilai, SEM_KEYS } from '../lib/nilai'
import { getTahunUntukTingkat } from '../lib/tahun'
import { ensureXLSX, writeXlsx } from '../lib/xlsx-lazy'
import { useDebounced } from '../lib/debounce'
import { useExportFilter } from '../composables/useExportFilter'
import { confirm } from '../lib/confirm'
import CustomSelect from '../components/CustomSelect.vue'
import {
  FileUp, Download, Search, X, Award, Users, CheckCircle2, TrendingUp,
  Eye, Edit, Trash2, School, Calendar, BookOpen, Database, AlertCircle, Save
} from 'lucide-vue-next'

// ═══════════════════════════════════════════════
// STATE — LIST
// ═══════════════════════════════════════════════
const daftarNilai = ref([])
const isLoading = ref(false)
const pencarian = ref('')
const pencarianDebounced = useDebounced(pencarian, 200)
const filterSmt = ref('all')
const filterKelas = ref('')
const filterAngkatan = ref('')
const pageSize = ref(25)
const currentPage = ref(1)
const kelasOptions = ref([])
const angkatanOptions = ref([])

// ─── DETAIL STATE ───
const detailOpen = ref(false)
const detailItem = ref(null)
const detailTab = ref('smt1')

// ─── EDIT NILAI STATE ───
const editOpen = ref(false)
const editSiswa = ref(null)
const editTab = ref('smt1')
const editForm = ref(null)
const editSaving = ref(false)

// ─── IMPORT STATE ───
const importOpen = ref(false)
const importStep = ref(1)
const importFileName = ref('')
const importHeaders = ref([])
const importRows = ref([])
const importMapping = ref({})
const importPreview = ref([])
const importCounts = ref({})
const importSelected = ref({})
const importLoading = ref(false)
const importSemester = ref('1')
const importTahun = ref('')

const MAPEL_LIST = [
  'Pendidikan Agama Islam dan Budi Pekerti', 'Pendidikan Pancasila', 'Bahasa Indonesia',
  'Matematika', 'Ilmu Pengetahuan Alam', 'Ilmu Pengetahuan Sosial', 'Bahasa Inggris',
  'Pendidikan Jasmani, Olahraga, dan Kesehatan', 'Informatika', 'Sejarah',
  'Seni Budaya dan Prakarya', 'Fisika', 'Kimia', 'Geografi', 'Ekonomi',
  'Bahasa Arab', 'Bahasa Daerah', 'Fiqih'
]

// ─── EXPORT STATE ───
const exportOpen = ref(false)
const exportSemester = ref('all')
const exportLoading = ref(false)

// ═══════════════════════════════════════════════
// OPTIONS UNTUK CUSTOMSELECT
// ═══════════════════════════════════════════════
const filterSmtOptions = [
  { label: 'Semua Semester', value: 'all' },
  { label: 'Smt 1 (X Ganjil)', value: '1' },
  { label: 'Smt 2 (X Genap)', value: '2' },
  { label: 'Smt 3 (XI Ganjil)', value: '3' },
  { label: 'Smt 4 (XI Genap)', value: '4' },
  { label: 'Smt 5 (XII Ganjil)', value: '5' },
  { label: 'Smt 6 (XII Genap)', value: '6' }
]
const filterKelasOptions = computed(() => [
  { label: 'Semua Kelas', value: '' },
  ...kelasOptions.value.map(k => ({ label: k, value: k }))
])
const filterAngkatanOptions = computed(() => [
  { label: 'Semua Angkatan', value: '' },
  ...angkatanOptions.value.map(a => ({ label: a, value: a }))
])
const pageSizeOptions = [
  { label: '10 / hal', value: 10 },
  { label: '25 / hal', value: 25 },
  { label: '50 / hal', value: 50 },
  { label: '100 / hal', value: 100 }
]
const exportSemesterOptions = [
  { label: 'Semua Semester', value: 'all' },
  { label: 'Smt 1 (X Ganjil)', value: '1' },
  { label: 'Smt 2 (X Genap)', value: '2' },
  { label: 'Smt 3 (XI Ganjil)', value: '3' },
  { label: 'Smt 4 (XI Genap)', value: '4' },
  { label: 'Smt 5 (XII Ganjil)', value: '5' },
  { label: 'Smt 6 (XII Genap)', value: '6' }
]

// ═══════════════════════════════════════════════
// EXPORT ITEMS
// ═══════════════════════════════════════════════
const exportItems = computed(() =>
  daftarNilai.value.map(n => ({
    no_induk: n.no_induk,
    nama: n.siswa?.nama || '',
    kelas: n.siswa?.kelas || '',
    angkatan: (String(n.siswa?.detail_data?.masuk || '').match(/\d{4}/) || [])[0] || '',
    status: n.siswa?.status || 'Aktif',
    raw: n
  }))
)

const ef = useExportFilter({
  daftarItems: exportItems,
  kelasOptions,
  angkatanOptions,
  statusOptions: null
})

const {
  filterKelas: exportKelas,
  filterAngkatan: exportAngkatan,
  searchSiswa: exportSearchSiswa,
  selectedNoInduk: exportSelectedSiswa,
  searchKelas: exportSearchKelas,
  searchAngkatan: exportSearchAngkatan,
  kelasFiltered: exportKelasFiltered,
  angkatanFiltered: exportAngkatanFiltered,
  siswaFiltered: exportSiswaFiltered,
  finalItems: exportFinalSiswa,
  toggleKelas: exportToggleKelas,
  toggleAngkatan: exportToggleAngkatan,
  toggleSiswa: exportToggleSiswa,
  pilihSemua: exportPilihSemuaSiswa,
  resetAll: exportResetAll
} = ef

// ═══════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════
function norm(s) {
  return String(s || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

function mergeMapelToForm(existingSem) {
  const map = {}
  ;(existingSem?.mapel || []).forEach(m => { map[m.mapel] = m })
  return MAPEL_LIST.map(mp => ({
    mapel: mp,
    teori: String(map[mp]?.teori || ''),
    praktek: String(map[mp]?.praktek || '')
  }))
}

function buildNilaiDataFromForm() {
  const nd = {}
  for (const smt of SEM_KEYS) {
    const sem = editForm.value?.[smt]
    if (!sem) continue
    const filteredMapel = MAPEL_LIST
      .map(mp => sem.mapel.find(m => m.mapel === mp))
      .filter(m => m && (m.teori !== '' || m.praktek !== ''))
      .map(m => ({ mapel: m.mapel, teori: m.teori, praktek: m.praktek }))
    if (filteredMapel.length > 0 || sem.tahun) {
      nd[smt] = { tahun: sem.tahun || '', mapel: filteredMapel }
    }
  }
  return nd
}

function rataEditSemester(smt) {
  const sem = editForm.value?.[smt]
  if (!sem) return '-'
  let sum = 0, cnt = 0
  sem.mapel.forEach(m => {
    const t = parseFloat(m.teori)
    if (!isNaN(t)) { sum += t; cnt++ }
  })
  return cnt > 0 ? (sum / cnt).toFixed(2) : '-'
}

// ═══════════════════════════════════════════════
// COMPUTED LIST
// ═══════════════════════════════════════════════
const nilaiTerfilter = computed(() => {
  const kw = pencarianDebounced.value.toLowerCase().trim()
  return daftarNilai.value.filter(n => {
    if (kw) {
      const matchNama = (n.siswa?.nama || '').toLowerCase().includes(kw)
      const matchNo = (n.no_induk || '').toLowerCase().includes(kw)
      const matchNisn = (n.siswa?.nisn || '').toLowerCase().includes(kw)
      if (!matchNama && !matchNo && !matchNisn) return false
    }
    if (filterKelas.value) {
      const k = n.siswa?.kelas || ''
      if (!k || (k !== filterKelas.value && !k.startsWith(filterKelas.value + '-') && !k.startsWith(filterKelas.value + ' '))) return false
    }
    if (filterAngkatan.value) {
      const masuk = String(n.siswa?.detail_data?.masuk || '').match(/\d{4}/)
      if (!masuk || masuk[0] !== filterAngkatan.value) return false
    }
    if (filterSmt.value !== 'all') {
      if (!n.nilai_data?.['smt' + filterSmt.value]) return false
    }
    return true
  })
})

const totalHalaman = computed(() => Math.max(1, Math.ceil(nilaiTerfilter.value.length / pageSize.value)))
const nilaiTampil = computed(() => {
  const m = (currentPage.value - 1) * pageSize.value
  return nilaiTerfilter.value.slice(m, m + pageSize.value)
})

const stats = computed(() => {
  const total = daftarNilai.value.length
  const dinilai = daftarNilai.value.filter(n => n.nilai_data && Object.keys(n.nilai_data).length > 0).length
  const dknVals = daftarNilai.value.map(n => parseFloat(n.dkn)).filter(v => !isNaN(v))
  const rataDKN = dknVals.length ? (dknVals.reduce((a, b) => a + b, 0) / dknVals.length).toFixed(2) : '-'
  return { total, dinilai, belum: total - dinilai, rataDKN }
})

// ─── DETAIL COMPUTED ───
const detailSemester = computed(() => {
  if (!detailItem.value?.nilai_data) return null
  return detailItem.value.nilai_data[detailTab.value] || null
})

// ─── IMPORT COMPUTED ───
const importHasSemInHeader = computed(() =>
  importHeaders.value.some(h => /(?:smt|sem|semester)\.?\s*[1-6]/i.test(h))
)
const importTotalSelected = computed(() => Object.values(importSelected.value).filter(Boolean).length)

function importParseSemester(text) {
  const m = String(text || '').match(/(?:smt|sem|semester)\.?\s*([1-6])/i)
  return m ? parseInt(m[1], 10) : null
}
function importParseJenis(text) {
  const t = String(text || '').toLowerCase()
  if (/praktek|praktik|prak/.test(t)) return 'praktek'
  if (/teori/.test(t)) return 'teori'
  return null
}

// ═══════════════════════════════════════════════
// WATCHERS
// ═══════════════════════════════════════════════
watch([pencarianDebounced, filterSmt, filterKelas, filterAngkatan, pageSize], () => { currentPage.value = 1 })
watch(totalHalaman, () => { if (currentPage.value > totalHalaman.value) currentPage.value = 1 })
watch(importSemester, () => { if (importRows.value.length) importAutoMap() })

// ═══════════════════════════════════════════════
// LOAD
// ═══════════════════════════════════════════════
async function ambilData() {
  isLoading.value = true
  const [rNilai, rSiswa] = await Promise.all([
    supabase.from('nilai').select('id, no_induk, nilai_data'),
    supabase.from('siswa').select('no_induk, nama, kelas, status, nisn, detail_data')
  ])
  if (rNilai.error || rSiswa.error) {
    alert('Gagal memuat: ' + (rNilai.error?.message || rSiswa.error?.message))
    isLoading.value = false
    return
  }
  const nilaiMap = {}
  ;(rNilai.data || []).forEach(n => { nilaiMap[n.no_induk] = n })

  daftarNilai.value = (rSiswa.data || [])
    .filter(s => {
      const st = String(s.status || '').toLowerCase()
      return !st.includes('angkatan') && !String(s.no_induk || '').toLowerCase().includes('angkatan')
    })
    .map(s => {
      const nRow = nilaiMap[s.no_induk]
      const nd = nRow?.nilai_data || null
      const pre = precomputeNilai(nd)
      return {
        id: nRow?.id || null,
        no_induk: s.no_induk,
        siswa: s,
        nilai_data: nd,
        smtRata: pre.smtRata,
        dkn: pre.dkn
      }
    })
    .sort((a, b) => (a.no_induk || '').localeCompare(b.no_induk || ''))

  const kSet = new Set(), aSet = new Set()
  daftarNilai.value.forEach(n => {
    if (n.siswa?.kelas) kSet.add(n.siswa.kelas)
    const m = String(n.siswa?.detail_data?.masuk || '').match(/\d{4}/)
    if (m) aSet.add(m[0])
  })
  kelasOptions.value = Array.from(kSet).sort()
  angkatanOptions.value = Array.from(aSet).sort().reverse()
  isLoading.value = false
}

// ═══════════════════════════════════════════════
// DETAIL
// ═══════════════════════════════════════════════
function bukaDetail(item) {
  detailItem.value = item
  detailTab.value = 'smt1'
  detailOpen.value = true
}
function tutupDetail() {
  detailOpen.value = false
  detailItem.value = null
}

// ═══════════════════════════════════════════════
// EDIT NILAI
// ═══════════════════════════════════════════════
function bukaEdit(item) {
  editSiswa.value = item
  editTab.value = 'smt1'
  const nd = item.nilai_data || {}
  editForm.value = {}
  SEM_KEYS.forEach(smt => {
    editForm.value[smt] = {
      tahun: nd[smt]?.tahun || '',
      mapel: mergeMapelToForm(nd[smt])
    }
  })
  editOpen.value = true
}
function tutupEdit() {
  editOpen.value = false
  editSiswa.value = null
  editForm.value = null
}

async function simpanEdit() {
  if (!editSiswa.value || !editForm.value) return
  editSaving.value = true
  try {
    const nd = buildNilaiDataFromForm()
    const { error } = await supabase
      .from('nilai')
      .upsert({ no_induk: editSiswa.value.no_induk, nilai_data: nd }, { onConflict: 'no_induk' })
    if (error) throw error

    const pre = precomputeNilai(nd)
    const idx = daftarNilai.value.findIndex(n => n.no_induk === editSiswa.value.no_induk)
    if (idx >= 0) {
      daftarNilai.value[idx] = {
        ...daftarNilai.value[idx],
        nilai_data: Object.keys(nd).length > 0 ? nd : null,
        smtRata: pre.smtRata,
        dkn: pre.dkn
      }
    }
    tutupEdit()
  } catch (err) {
    alert('Gagal simpan: ' + err.message)
  } finally {
    editSaving.value = false
  }
}

async function hapusNilai(item) {
  const ok = await confirm({
    title: 'Hapus Nilai Akademik',
    message: `Hapus semua nilai akademik "${item.siswa?.nama || item.no_induk}"?\n\nData siswa TIDAK terhapus, hanya nilai akademik (6 semester).`,
    variant: 'danger',
    confirmText: 'Ya, Hapus Nilai'
  })
  if (!ok) return

  const { error } = await supabase.from('nilai').delete().eq('no_induk', item.no_induk)
  if (error) { alert('Gagal hapus: ' + error.message); return }

  const idx = daftarNilai.value.findIndex(n => n.no_induk === item.no_induk)
  if (idx >= 0) {
    const pre = precomputeNilai(null)
    daftarNilai.value[idx] = {
      ...daftarNilai.value[idx],
      id: null,
      nilai_data: null,
      smtRata: pre.smtRata,
      dkn: pre.dkn
    }
  }
}

// ═══════════════════════════════════════════════
// IMPORT
// ═══════════════════════════════════════════════
function bukaImport() {
  importOpen.value = true
  importStep.value = 1
  importFileName.value = ''
  importHeaders.value = []
  importRows.value = []
  importMapping.value = {}
  importPreview.value = []
  importCounts.value = {}
  importSelected.value = {}
  importSemester.value = '1'
  importTahun.value = ''
}
function tutupImport() { importOpen.value = false }

async function importHandleFile(e) {
  const file = e.target.files?.[0]
  if (!file) return
  importFileName.value = file.name
  const XLSX = await ensureXLSX()
  const reader = new FileReader()
  reader.onload = ev => {
    try {
      const wb = XLSX.read(new Uint8Array(ev.target.result), { type: 'array', cellDates: true })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false, blankrows: false })
      if (aoa.length < 2) throw new Error('File harus punya header + minimal 1 baris data')
      importHeaders.value = (aoa[0] || []).map((h, i) => String(h).trim() || `Kolom ${i + 1}`)
      importRows.value = aoa.slice(1).filter(r => r.some(c => String(c).trim() !== ''))
      importAutoMap()
      importStep.value = 2
    } catch (err) {
      alert('Gagal baca file: ' + err.message)
    }
  }
  reader.readAsArrayBuffer(file)
}

function importAutoMap() {
  const used = {}
  const m = {}
  const defSmt = parseInt(importSemester.value, 10)
  importHeaders.value.forEach((h, i) => {
    const nh = norm(h)
    const semFromHdr = importParseSemester(h)
    if ((nh.includes('noinduk') || nh === 'nis' || nh === 'ni') && !used.no_induk) {
      m[i] = { type: 'identity', field: 'no_induk' }; used.no_induk = true; return
    }
    if (nh.includes('nama') && !nh.includes('mapel') && !used.nama) {
      m[i] = { type: 'identity', field: 'nama' }; used.nama = true; return
    }
    if (nh.includes('tahun')) {
      const sem = semFromHdr || defSmt
      const key = `tahun_${sem}`
      if (!used[key]) { m[i] = { type: 'tahun', semester: sem }; used[key] = true; return }
    }
    const jenis = importParseJenis(h)
    const mapelHit = MAPEL_LIST.find(mp => nh.includes(norm(mp)))
    if (mapelHit && jenis) {
      const sem = semFromHdr || defSmt
      const key = `${sem}|${mapelHit}|${jenis}`
      if (!used[key]) { m[i] = { type: 'nilai', semester: sem, mapel: mapelHit, jenis }; used[key] = true; return }
    }
    m[i] = { type: 'skip' }
  })
  importMapping.value = m
}

function importCanPreview() {
  const vals = Object.values(importMapping.value)
  return vals.some(v => v.type === 'identity' && v.field === 'no_induk') &&
         vals.some(v => v.type === 'identity' && v.field === 'nama') &&
         vals.some(v => v.type === 'nilai')
}

async function importRunPreview() {
  importLoading.value = true
  try {
    const { data: siswaList } = await supabase.from('siswa').select('no_induk, nama, detail_data')
    const siswaByNo = {}
    ;(siswaList || []).forEach(s => { siswaByNo[s.no_induk] = s })

    const inputCounts = {}
    const items = importRows.value.map((row, rowIdx) => {
      const obj = {
        rowIndex: rowIdx, sourceRow: rowIdx + 2,
        noInduk: '', nama: '',
        data: {}, tahunPerSmt: {}, semesters: [],
        status: '', message: '', siswa: null
      }
      Object.entries(importMapping.value).forEach(([ci, tgt]) => {
        if (!tgt || tgt.type === 'skip') return
        const val = String(row[parseInt(ci)] || '').trim()
        if (tgt.type === 'identity') {
          if (tgt.field === 'no_induk') obj.noInduk = val
          else if (tgt.field === 'nama') obj.nama = val
        } else if (tgt.type === 'tahun' && val) {
          obj.tahunPerSmt[tgt.semester] = val
        } else if (tgt.type === 'nilai' && val !== '') {
          if (!obj.data[tgt.semester]) obj.data[tgt.semester] = {}
          if (!obj.data[tgt.semester][tgt.mapel]) obj.data[tgt.semester][tgt.mapel] = { teori: '', praktek: '' }
          obj.data[tgt.semester][tgt.mapel][tgt.jenis] = val
        }
      })
      obj.semesters = Object.keys(obj.data).map(Number).sort((a, b) => a - b)
      if (obj.noInduk) inputCounts[obj.noInduk] = (inputCounts[obj.noInduk] || 0) + 1
      return obj
    })

    items.forEach(it => {
      if (!it.noInduk || !it.nama) { it.status = 'tidak_lengkap'; it.message = 'No induk & nama wajib'; return }
      if (inputCounts[it.noInduk] > 1) { it.status = 'duplikat_file'; it.message = 'No induk muncul >1× dalam file'; return }
      const s = siswaByNo[it.noInduk]
      if (!s) { it.status = 'tidak_ditemukan'; it.message = 'No induk tidak ada di DB'; return }
      if (norm(s.nama) !== norm(it.nama)) { it.status = 'nama_tidak_cocok'; it.message = `Nama di DB: "${s.nama}"`; return }
      const nc = Object.values(it.data).reduce((a, m) => a + Object.values(m).reduce((b, x) => b + Object.keys(x).filter(k => x[k] !== '').length, 0), 0)
      if (nc === 0) { it.status = 'tidak_ada_nilai'; it.message = 'Tidak ada nilai terpetakan'; return }
      it.status = 'cocok'; it.message = `Siap (${nc} nilai)`; it.siswa = s
    })

    const c = { total: items.length, cocok: 0, tidak_ditemukan: 0, nama_tidak_cocok: 0, duplikat_file: 0, tidak_lengkap: 0, tidak_ada_nilai: 0 }
    items.forEach(i => { c[i.status] = (c[i.status] || 0) + 1 })
    importCounts.value = c
    importPreview.value = items

    const sel = {}
    items.forEach(i => { if (i.status === 'cocok') sel[i.rowIndex] = true })
    importSelected.value = sel
    importStep.value = 3
  } catch (err) {
    alert('Gagal preview: ' + err.message)
  } finally { importLoading.value = false }
}

function importToggle(rowIdx) {
  importSelected.value = { ...importSelected.value, [rowIdx]: !importSelected.value[rowIdx] }
}
function importPilihSemua(v) {
  const next = {}
  importPreview.value.forEach(i => { if (i.status === 'cocok') next[i.rowIndex] = v })
  importSelected.value = next
}

function importDeriveTahun(siswaObj, smt) {
  const tingkat = smt <= 2 ? 'X' : smt <= 4 ? 'XI' : 'XII'
  return getTahunUntukTingkat(siswaObj, tingkat) || ''
}

async function importCommit() {
  const toCommit = importPreview.value.filter(i => importSelected.value[i.rowIndex])
  if (!toCommit.length) return alert('Pilih minimal 1 baris')

  const allSem = new Set()
  toCommit.forEach(it => it.semesters.forEach(s => allSem.add(s)))
  const smtInfo = Array.from(allSem).sort().map(s => `Smt ${s}`).join(', ')
  if (!confirm({
    title: 'Simpan Import Nilai',
    message: `Import ${toCommit.length} siswa ke ${smtInfo}?`,
    variant: 'info',
    confirmText: 'Ya, Simpan'
  })) return

  importLoading.value = true
  try {
    const noIndukList = toCommit.map(i => i.noInduk)
    const { data: existing } = await supabase.from('nilai').select('no_induk, nilai_data').in('no_induk', noIndukList)
    const existingMap = {}
    ;(existing || []).forEach(e => { existingMap[e.no_induk] = e.nilai_data || {} })

    const upsertRows = toCommit.map(item => {
      const nd = JSON.parse(JSON.stringify(existingMap[item.noInduk] || {}))
      Object.entries(item.data).forEach(([smtNum, mapelObj]) => {
        const smtKey = `smt${smtNum}`
        const existingSmt = nd[smtKey] || {}
        const mapelMap = {}
        ;(existingSmt.mapel || []).forEach(m => { mapelMap[m.mapel] = { ...m } })
        Object.entries(mapelObj).forEach(([mapelName, vals]) => {
          if (!mapelMap[mapelName]) mapelMap[mapelName] = { mapel: mapelName, teori: '', praktek: '' }
          if (vals.teori !== undefined) mapelMap[mapelName].teori = vals.teori
          if (vals.praktek !== undefined) mapelMap[mapelName].praktek = vals.praktek
        })
        const finalMapel = MAPEL_LIST.filter(mp => mapelMap[mp]).map(mp => mapelMap[mp])
        Object.keys(mapelMap).forEach(mp => { if (!MAPEL_LIST.includes(mp)) finalMapel.push(mapelMap[mp]) })
        const tahunFor = item.tahunPerSmt[smtNum]
          || existingSmt.tahun
          || importDeriveTahun(item.siswa, parseInt(smtNum, 10))
          || ''
        nd[smtKey] = { tahun: tahunFor, mapel: finalMapel }
      })
      return { no_induk: item.noInduk, nilai_data: nd }
    })

    let ok = 0, fail = 0
    const errs = []
    for (let i = 0; i < upsertRows.length; i += 100) {
      const batch = upsertRows.slice(i, i + 100)
      const { error } = await supabase.from('nilai').upsert(batch, { onConflict: 'no_induk' })
      if (error) { fail += batch.length; errs.push(error.message) } else { ok += batch.length }
    }
    alert(`Import selesai.\n✅ OK: ${ok}\n❌ Gagal: ${fail}${errs.length ? '\n\n' + errs.slice(0, 3).join('\n') : ''}`)
    if (ok > 0) {
      const updateMap = new Map(upsertRows.map(r => [r.no_induk, r.nilai_data]))
      daftarNilai.value = daftarNilai.value.map(n => {
        if (!updateMap.has(n.no_induk)) return n
        const nd = updateMap.get(n.no_induk)
        const pre = precomputeNilai(nd)
        return { ...n, nilai_data: nd, smtRata: pre.smtRata, dkn: pre.dkn }
      })
      tutupImport()
    }
  } catch (err) {
    alert('Gagal commit: ' + err.message)
  } finally { importLoading.value = false }
}

// ═══════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════
function bukaExport() {
  exportResetAll()
  exportSemester.value = 'all'
  exportOpen.value = true
}
function tutupExport() { exportOpen.value = false }

async function exportDo() {
  const rows = exportFinalSiswa.value
  if (rows.length === 0) return alert('Tidak ada siswa untuk diexport')
  exportLoading.value = true
  try {
    const isAll = exportSemester.value === 'all'
    const semKeys = isAll ? SEM_KEYS : ['smt' + exportSemester.value]

    const h1 = [], h2 = [], merges = []
    const OFFSET = 5   // 4 metadata + 1 blank
    h1.push('No Induk', 'Nama')
    h2.push('', '')
    merges.push({ s: { r: OFFSET, c: 0 }, e: { r: OFFSET + 1, c: 0 } })
    merges.push({ s: { r: OFFSET, c: 1 }, e: { r: OFFSET + 1, c: 1 } })
    let col = 2

    if (isAll) {
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
    } else {
      h1.push('TAHUN'); h2.push('')
      merges.push({ s: { r: OFFSET, c: col }, e: { r: OFFSET + 1, c: col } }); col += 1
      const tStart = col
      h1.push('TEORI'); for (let k = 1; k < 18; k++) h1.push('')
      for (const mp of MAPEL_LIST) h2.push(mp)
      merges.push({ s: { r: OFFSET, c: tStart }, e: { r: OFFSET, c: tStart + 17 } }); col += 18
      h1.push('JUMLAH'); h2.push('')
      merges.push({ s: { r: OFFSET, c: col }, e: { r: OFFSET + 1, c: col } }); col += 1
      h1.push('RATA-RATA'); h2.push('')
      merges.push({ s: { r: OFFSET, c: col }, e: { r: OFFSET + 1, c: col } }); col += 1
      const pStart = col
      h1.push('PRAKTEK'); for (let k = 1; k < 18; k++) h1.push('')
      for (const mp of MAPEL_LIST) h2.push(mp)
      merges.push({ s: { r: OFFSET, c: pStart }, e: { r: OFFSET, c: pStart + 17 } }); col += 18
    }

    const ijStart = col
    h1.push('IJAZAH'); for (let k = 1; k < 18; k++) h1.push('')
    for (const mp of MAPEL_LIST) h2.push(mp)
    merges.push({ s: { r: OFFSET, c: ijStart }, e: { r: OFFSET, c: ijStart + 17 } }); col += 18
    h1.push('Rata-rata Ijazah'); h2.push('')
    merges.push({ s: { r: OFFSET, c: col }, e: { r: OFFSET + 1, c: col } })

    // ─── METADATA ───
    const now = new Date()
    const waktu = now.toLocaleDateString('id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
    const namaUser = userSesi.value?.user_metadata?.nama ||
                     userSesi.value?.user_metadata?.full_name ||
                     userSesi.value?.email || 'Administrator'

    const filters = []
    if (exportSemester.value !== 'all') filters.push('Semester: Smt ' + exportSemester.value)
    else filters.push('Semester: Semua')
    if (exportKelas.value.length) filters.push('Kelas: ' + exportKelas.value.join(', '))
    if (exportAngkatan.value.length) filters.push('Angkatan: ' + exportAngkatan.value.join(', '))
    if (exportSelectedSiswa.value.length) filters.push('Siswa spesifik (' + exportSelectedSiswa.value.length + ' siswa)')
    const filterDesc = filters.join(' • ')

    const aoa = []
    aoa.push(['Waktu Pengunduhan:', waktu])
    aoa.push(['Nama Pengunduh:', namaUser])
    aoa.push(['Filter Pengunduhan:', filterDesc])
    aoa.push(['Total Siswa:', rows.length])
    aoa.push([])
    aoa.push(h1)
    aoa.push(h2)

    rows.forEach(item => {
      const nd = item.raw?.nilai_data || {}
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
        SEM_KEYS.forEach(sk => {
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
    if (isAll) {
      for (let i = 0; i < 6; i++) {
        widths.push({ wch: 10 })
        for (let m = 0; m < 18; m++) widths.push({ wch: 11 })
        widths.push({ wch: 8 }, { wch: 9 })
        for (let m = 0; m < 18; m++) widths.push({ wch: 10 })
      }
    } else {
      widths.push({ wch: 10 })
      for (let m = 0; m < 18; m++) widths.push({ wch: 11 })
      widths.push({ wch: 8 }, { wch: 9 })
      for (let m = 0; m < 18; m++) widths.push({ wch: 10 })
    }
    for (let m = 0; m < 18; m++) widths.push({ wch: 10 })
    widths.push({ wch: 12 })

    const semLabel = isAll ? 'Semua-Semester' : 'Semester-' + exportSemester.value
    const date = now.toISOString().slice(0, 10)
    await writeXlsx({
      aoa, merges, cols: widths,
      autofilterRange: { s: { r: OFFSET + 1, c: 0 }, e: { r: OFFSET + 1, c: h1.length - 1 } },
      sheetName: semLabel,
      filename: `Nilai_${semLabel}_${date}.xlsx`
    })
    tutupExport()
  } catch (err) {
    alert('Gagal export: ' + err.message)
  } finally {
    exportLoading.value = false
  }
}

onMounted(ambilData)
</script>

<template>
  <div class="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-5">

    <!-- HEADER -->
    <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl md:text-3xl font-bold text-white tracking-tight">Nilai Akademik</h1>
        <p class="text-sm text-slate-500 mt-1">
          Transkrip 6 semester & DKN •
          <span class="text-emerald-400 font-semibold">{{ stats.total }}</span> siswa terdaftar
        </p>
      </div>
      <div class="flex gap-2 shrink-0">
        <button @click="bukaImport"
                class="inline-flex items-center justify-center gap-2 w-10 sm:w-auto sm:px-3.5 h-10 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-[13px] font-semibold transition">
          <FileUp class="w-4 h-4" /><span class="hidden sm:inline">Import</span>
        </button>
        <button @click="bukaExport"
                class="inline-flex items-center justify-center gap-2 flex-1 sm:flex-none px-4 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white text-[13px] font-bold shadow-lg shadow-emerald-900/40 transition">
          <Download class="w-4 h-4" /><span>Export</span>
        </button>
      </div>
    </div>

    <!-- STATS -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
      <div class="rounded-xl md:rounded-2xl border border-slate-800 bg-slate-900/50 p-2.5 md:p-3.5">
        <div class="flex items-center gap-1.5 text-slate-500 text-[9.5px] md:text-[10.5px] font-bold uppercase tracking-wider mb-1">
          <Users class="w-3 h-3 md:w-3.5 md:h-3.5 shrink-0" /> Total
        </div>
        <div class="text-lg md:text-2xl font-bold text-white leading-none">{{ stats.total }}</div>
        <div class="hidden md:block text-[10.5px] text-slate-500 mt-0.5">Siswa terdaftar</div>
      </div>
      <div class="rounded-xl md:rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-2.5 md:p-3.5">
        <div class="flex items-center gap-1.5 text-emerald-400 text-[9.5px] md:text-[10.5px] font-bold uppercase tracking-wider mb-1">
          <CheckCircle2 class="w-3 h-3 md:w-3.5 md:h-3.5 shrink-0" /> Sudah Dinilai
        </div>
        <div class="text-lg md:text-2xl font-bold text-emerald-400 leading-none">{{ stats.dinilai }}</div>
        <div class="hidden md:block text-[10.5px] text-slate-500 mt-0.5">Memiliki data nilai</div>
      </div>
      <div class="rounded-xl md:rounded-2xl border border-amber-500/30 bg-amber-500/5 p-2.5 md:p-3.5">
        <div class="flex items-center gap-1.5 text-amber-400 text-[9.5px] md:text-[10.5px] font-bold uppercase tracking-wider mb-1">
          <AlertCircle class="w-3 h-3 md:w-3.5 md:h-3.5 shrink-0" /> Belum Dinilai
        </div>
        <div class="text-lg md:text-2xl font-bold text-amber-400 leading-none">{{ stats.belum }}</div>
        <div class="hidden md:block text-[10.5px] text-slate-500 mt-0.5">Belum ada nilai</div>
      </div>
      <div class="rounded-xl md:rounded-2xl border border-blue-500/30 bg-blue-500/5 p-2.5 md:p-3.5">
        <div class="flex items-center gap-1.5 text-blue-400 text-[9.5px] md:text-[10.5px] font-bold uppercase tracking-wider mb-1">
          <TrendingUp class="w-3 h-3 md:w-3.5 md:h-3.5 shrink-0" /> Rata DKN
        </div>
        <div class="text-lg md:text-2xl font-bold text-blue-400 leading-none">{{ stats.rataDKN }}</div>
        <div class="hidden md:block text-[10.5px] text-slate-500 mt-0.5">Rata-rata seluruh siswa</div>
      </div>
    </div>

    <!-- FILTER -->
    <div class="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-3">
      <div class="grid grid-cols-3 lg:grid-cols-12 gap-2">
        <div class="col-span-3 lg:col-span-5 relative">
          <Search class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input v-model="pencarian" type="text" placeholder="Cari nama, no induk, atau NISN..."
                class="w-full h-10 pl-10 pr-10 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white placeholder-slate-500 outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/10 transition-all" />
          <button v-if="pencarian" @click="pencarian = ''"
                  class="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition">
            <X class="w-3.5 h-3.5" />
          </button>
        </div>
        <div class="col-span-1 lg:col-span-3">
          <CustomSelect v-model="filterSmt" :options="filterSmtOptions" placeholder="Semester" />
        </div>
        <div class="col-span-1 lg:col-span-2">
          <CustomSelect v-model="filterKelas" :options="filterKelasOptions" placeholder="Kelas" searchable />
        </div>
        <div class="col-span-1 lg:col-span-2">
          <CustomSelect v-model="filterAngkatan" :options="filterAngkatanOptions" placeholder="Angkatan" searchable />
        </div>
      </div>
    </div>

    <!-- TABLE -->
    <div class="rounded-2xl border border-slate-800/80 bg-slate-900/50 overflow-hidden">
      <div class="px-4 py-3 border-b border-slate-800/80 bg-slate-950/40 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div class="text-xs text-slate-400">
          Menampilkan <b class="text-slate-200">{{ nilaiTampil.length }}</b> dari
          <b class="text-emerald-400">{{ nilaiTerfilter.length }}</b> data
        </div>
        <div class="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
          <div class="relative h-8 w-[92px] shrink-0">
            <CustomSelect v-model.number="pageSize" :options="pageSizeOptions" size="sm" />
          </div>
          <div class="flex items-center gap-1.5 ml-auto sm:ml-0">
            <button @click="currentPage = Math.max(1, currentPage - 1)" :disabled="currentPage === 1"
                    class="h-8 px-3 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition">
              Prev
            </button>
            <div class="h-8 px-3 flex items-center rounded-lg bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 whitespace-nowrap">
              {{ currentPage }} / {{ totalHalaman }}
            </div>
            <button @click="currentPage = Math.min(totalHalaman, currentPage + 1)" :disabled="currentPage >= totalHalaman"
                    class="h-8 px-3 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition">
              Next
            </button>
          </div>
        </div>
      </div>

      <div class="overflow-x-auto hidden md:block">
        <table class="w-full min-w-[900px] text-sm" style="table-layout: fixed;">
          <colgroup>
            <col style="width: 44px;">
            <col style="width: 100px;">
            <col>
            <col style="width: 58px;">
            <col style="width: 58px;">
            <col style="width: 58px;">
            <col style="width: 58px;">
            <col style="width: 58px;">
            <col style="width: 58px;">
            <col style="width: 84px;">
            <col style="width: 130px;">
          </colgroup>
          <thead class="bg-slate-950 border-b border-slate-800">
            <tr>
              <th class="px-2 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">No</th>
              <th class="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">No Induk</th>
              <th class="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">Nama Santri</th>
              <th v-for="i in 6" :key="i" class="px-2 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">S{{ i }}</th>
              <th class="px-2 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/30">DKN</th>
              <th class="px-2 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800/60">
            <tr v-if="isLoading">
              <td colspan="11" class="px-4 py-16 text-center text-slate-500">Memuat data...</td>
            </tr>
            <tr v-else-if="nilaiTampil.length === 0">
              <td colspan="11" class="px-4 py-16 text-center">
                <div class="text-slate-500 text-sm">Tidak ada data yang cocok</div>
                <div class="text-slate-600 text-xs mt-1">Coba ubah filter atau kata kunci pencarian</div>
              </td>
            </tr>
            <tr v-for="(item, idx) in nilaiTampil" :key="item.no_induk" class="hover:bg-slate-800/40 transition">
              <td class="px-2 py-3 text-center text-slate-500 text-xs tabular-nums">{{ (currentPage - 1) * pageSize + idx + 1 }}</td>
              <td class="px-3 py-3">
                <span class="font-mono text-[11.5px] font-semibold text-slate-300">{{ item.no_induk }}</span>
              </td>
              <td class="px-3 py-3">
                <div class="font-semibold text-white text-[13px] truncate">{{ item.siswa?.nama || '-' }}</div>
                <div class="text-[10.5px] text-slate-500 mt-0.5 truncate">{{ item.siswa?.kelas || 'Tanpa kelas' }}</div>
              </td>
              <td v-for="i in 6" :key="i" class="px-2 py-3 text-center">
                <span class="font-mono text-[12px] text-slate-200 tabular-nums">
                  {{ item.smtRata[i-1] !== null ? item.smtRata[i-1].toFixed(2) : '-' }}
                </span>
              </td>
              <td class="px-2 py-3 text-center bg-emerald-950/20">
                <span class="font-mono text-[13px] font-bold text-emerald-400 tabular-nums">{{ item.dkn }}</span>
              </td>
              <td class="px-2 py-3 text-center">
                <div class="flex items-center justify-center gap-1">
                  <button @click="bukaDetail(item)"
                          class="p-1.5 rounded-md text-slate-400 hover:bg-blue-500/15 hover:text-blue-400 transition" title="Detail">
                    <Eye class="w-3.5 h-3.5" />
                  </button>
                  <button @click="bukaEdit(item)"
                          class="p-1.5 rounded-md text-slate-400 hover:bg-amber-500/15 hover:text-amber-400 transition" title="Edit">
                    <Edit class="w-3.5 h-3.5" />
                  </button>
                  <button @click="hapusNilai(item)"
                          class="p-1.5 rounded-md text-slate-400 hover:bg-red-500/15 hover:text-red-400 transition" title="Hapus Nilai">
                    <Trash2 class="w-3.5 h-3.5" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- KARTU NILAI (KHUSUS HP) -->
      <div class="md:hidden divide-y divide-slate-800/60">
        <div v-if="isLoading" class="p-8 text-center text-slate-500 text-sm">Memuat data...</div>
        <div v-else-if="nilaiTampil.length === 0" class="p-8 text-center">
          <div class="text-slate-500 text-sm">Tidak ada data yang cocok</div>
          <div class="text-slate-600 text-xs mt-1">Coba ubah filter atau kata kunci</div>
        </div>
        <div v-for="item in nilaiTampil" :key="item.no_induk" class="p-3.5 active:bg-slate-800/30 transition">
          <div class="flex items-start gap-2.5">
            <div class="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {{ (item.siswa?.nama || '?').charAt(0).toUpperCase() }}
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="text-[13.5px] font-bold text-white truncate">{{ item.siswa?.nama || '-' }}</h3>
              <div class="flex items-center gap-1.5 mt-1 text-[11px] text-slate-500 font-mono flex-wrap">
                <span>{{ item.no_induk }}</span>
                <span v-if="item.siswa?.kelas" class="text-slate-600">•</span>
                <span v-if="item.siswa?.kelas" class="inline-flex px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">{{ item.siswa.kelas }}</span>
              </div>
            </div>
            <div class="text-right shrink-0">
              <div class="text-[9px] uppercase tracking-wider text-emerald-400 font-bold">DKN</div>
              <div class="text-lg font-bold text-emerald-400 font-mono leading-tight">{{ item.dkn }}</div>
            </div>
          </div>

          <!-- 6 Semester mini-grid -->
          <div class="grid grid-cols-6 gap-1 mt-2.5">
            <div v-for="i in 6" :key="i" class="text-center rounded-md bg-slate-950/60 border border-slate-800 py-1">
              <div class="text-[8.5px] uppercase tracking-wider text-slate-500 font-bold">S{{ i }}</div>
              <div class="text-[11px] font-mono font-semibold text-slate-200 tabular-nums">
                {{ item.smtRata[i-1] !== null ? item.smtRata[i-1].toFixed(2) : '—' }}
              </div>
            </div>
          </div>

          <div class="flex items-center gap-1.5 mt-2.5">
            <button @click="bukaDetail(item)" class="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-300 text-[11.5px] font-semibold active:scale-95 transition">
              <Eye class="w-3.5 h-3.5 text-blue-400" /> Detail
            </button>
            <button @click="bukaEdit(item)" class="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-300 text-[11.5px] font-semibold active:scale-95 transition">
              <Edit class="w-3.5 h-3.5 text-amber-400" /> Edit
            </button>
            <button @click="hapusNilai(item)" class="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-lg bg-slate-800/60 hover:bg-red-500/15 text-slate-300 hover:text-red-400 text-[11.5px] font-semibold active:scale-95 transition">
              <Trash2 class="w-3.5 h-3.5" /> Hapus
            </button>
          </div>
        </div>
      </div>

      <div class="px-4 py-2 border-t border-slate-800/80 bg-slate-950/40 text-center text-[11px] text-slate-500">
        Total <b class="text-emerald-400">{{ nilaiTerfilter.length }}</b> data
      </div>
    </div>

    <!-- ═══════ DETAIL MODAL ═══════ -->
    <div v-if="detailOpen && detailItem" class="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div class="modal-standard bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh]">
        <div class="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/50 rounded-t-2xl shrink-0">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0 shadow-lg">
              <Award class="w-5 h-5 text-white" />
            </div>
            <div class="min-w-0">
              <h2 class="text-base font-bold text-white truncate">{{ detailItem.siswa?.nama || '-' }}</h2>
              <p class="text-[11px] text-slate-400 font-mono">No Induk: {{ detailItem.no_induk }} • {{ detailItem.siswa?.kelas || '-' }}</p>
            </div>
          </div>
          <button @click="tutupDetail" class="w-9 h-9 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition">
            <X class="w-4 h-4" />
          </button>
        </div>

        <div class="flex overflow-x-auto border-b border-slate-800 bg-slate-950/30 px-3 shrink-0">
          <button v-for="i in 6" :key="i" @click="detailTab = 'smt' + i"
                  class="px-4 py-3 text-xs font-semibold border-b-2 transition whitespace-nowrap"
                  :class="detailTab === 'smt' + i ? 'text-emerald-400 border-emerald-500' : 'text-slate-400 border-transparent hover:text-white'">
            Smt {{ i }}
          </button>
        </div>

        <div class="p-5 overflow-y-auto flex-1">
          <div class="flex flex-wrap items-center justify-between gap-3 mb-3 pb-3 border-b border-slate-800">
            <div>
              <h3 class="text-sm font-bold text-emerald-400 uppercase tracking-wide">Semester {{ detailTab.replace('smt','') }}</h3>
              <p class="text-[11px] text-slate-400 mt-0.5">Tahun Pelajaran: <b class="text-white">{{ detailSemester?.tahun || '-' }}</b></p>
            </div>
            <div class="text-right">
              <div class="text-[10.5px] text-slate-500 uppercase tracking-wide">Rata-rata Semester</div>
              <div class="text-lg font-bold text-emerald-400 font-mono">{{ hitungRata(detailSemester?.mapel) !== null ? hitungRata(detailSemester?.mapel).toFixed(2) : '-' }}</div>
            </div>
          </div>

          <table class="w-full text-sm">
            <thead class="bg-slate-950 text-slate-400 text-[10.5px] uppercase">
              <tr>
                <th class="px-2 py-2 w-10 text-center font-bold">No</th>
                <th class="px-3 py-2 text-left font-bold">Mata Pelajaran</th>
                <th class="px-2 py-2 w-20 text-center font-bold">Teori</th>
                <th class="px-2 py-2 w-20 text-center font-bold">Praktek</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800">
              <tr v-for="(m, idx) in (detailSemester?.mapel || [])" :key="idx" class="hover:bg-slate-800/40">
                <td class="px-2 py-2 text-center text-slate-500 text-xs">{{ idx + 1 }}</td>
                <td class="px-3 py-2 font-medium text-white text-[13px]">{{ m.mapel }}</td>
                <td class="px-2 py-2 text-center font-mono font-semibold text-emerald-400 text-[13px]">{{ m.teori || '-' }}</td>
                <td class="px-2 py-2 text-center font-mono font-semibold text-blue-400 text-[13px]">{{ m.praktek || '-' }}</td>
              </tr>
              <tr v-if="!detailSemester?.mapel || detailSemester.mapel.length === 0">
                <td colspan="4" class="px-3 py-10 text-center text-slate-500 italic text-xs">Belum ada nilai di semester ini.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="p-4 border-t border-slate-800 bg-slate-950/50 flex justify-end gap-2 shrink-0">
          <button @click="tutupDetail"
                  class="h-10 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[13px] font-semibold transition">
            Tutup
          </button>
          <button @click="tutupDetail(); bukaEdit(detailItem)"
                  class="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white text-[13px] font-bold shadow-lg shadow-amber-900/40 transition">
            <Edit class="w-4 h-4" /> Edit Nilai
          </button>
        </div>
      </div>
    </div>

    <!-- ═══════ EDIT NILAI MODAL ═══════ -->
    <div v-if="editOpen && editSiswa && editForm" class="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 md:p-4">
      <div class="modal-standard bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col w-full max-w-4xl max-h-[94vh]">
        <div class="px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shrink-0">
              <Edit class="w-5 h-5 text-white" />
            </div>
            <div class="min-w-0">
              <h2 class="text-base font-bold text-white truncate">Edit Nilai: {{ editSiswa.siswa?.nama }}</h2>
              <p class="text-[11px] text-slate-400 font-mono truncate">{{ editSiswa.no_induk }} • {{ editSiswa.siswa?.kelas || '-' }}</p>
            </div>
          </div>
          <button @click="tutupEdit" class="w-9 h-9 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition">
            <X class="w-4 h-4" />
          </button>
        </div>

        <div class="flex overflow-x-auto border-b border-slate-800 bg-slate-950/30 px-3 shrink-0">
          <button v-for="i in 6" :key="i" @click="editTab = 'smt' + i"
                  class="px-4 py-3 text-xs font-semibold border-b-2 transition whitespace-nowrap"
                  :class="editTab === 'smt' + i ? 'text-amber-400 border-amber-500' : 'text-slate-400 border-transparent hover:text-white'">
            Smt {{ i }}
          </button>
        </div>

        <div class="p-5 overflow-y-auto flex-1">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-4 border-b border-slate-800">
            <div class="flex-1">
              <label class="block text-[11px] font-semibold text-slate-400 mb-1">Tahun Pelajaran Smt {{ editTab.replace('smt','') }}</label>
              <input v-model="editForm[editTab].tahun" type="text" placeholder="Contoh: 2024/2025"
                     class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white placeholder-slate-500 outline-none focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/10 transition-all" />
            </div>
            <div class="text-right">
              <div class="text-[10.5px] text-slate-500 uppercase tracking-wide">Rata-rata Smt Ini</div>
              <div class="text-2xl font-bold text-amber-400 font-mono">{{ rataEditSemester(editTab) }}</div>
            </div>
          </div>

          <div class="border border-slate-800 rounded-xl overflow-hidden">
            <table class="w-full text-sm">
              <thead class="bg-slate-950 text-slate-400 text-[10.5px] uppercase sticky top-0 z-10">
                <tr>
                  <th class="px-2 py-2.5 w-10 text-center font-bold">No</th>
                  <th class="px-3 py-2.5 text-left font-bold">Mata Pelajaran</th>
                  <th class="px-2 py-2.5 w-24 text-center font-bold">Teori</th>
                  <th class="px-2 py-2.5 w-24 text-center font-bold">Praktek</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800">
                <tr v-for="(m, idx) in editForm[editTab].mapel" :key="idx" class="hover:bg-slate-800/30">
                  <td class="px-2 py-1.5 text-center text-slate-500 text-xs">{{ idx + 1 }}</td>
                  <td class="px-3 py-1.5 font-medium text-white text-[12.5px]">{{ m.mapel }}</td>
                  <td class="px-2 py-1.5">
                    <input v-model="m.teori" type="text" inputmode="decimal" placeholder="—"
                           class="w-full h-8 px-2 bg-slate-950 border border-slate-800 rounded-md text-[12px] text-white text-center font-mono outline-none focus:border-emerald-500/60 transition" />
                  </td>
                  <td class="px-2 py-1.5">
                    <input v-model="m.praktek" type="text" inputmode="decimal" placeholder="—"
                           class="w-full h-8 px-2 bg-slate-950 border border-slate-800 rounded-md text-[12px] text-white text-center font-mono outline-none focus:border-blue-500/60 transition" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between shrink-0">
          <span class="text-[11px] text-slate-500">Nilai kosong = tidak disimpan</span>
          <div class="flex gap-2">
            <button @click="tutupEdit"
                    class="h-10 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[13px] font-semibold transition">
              Batal
            </button>
            <button @click="simpanEdit" :disabled="editSaving"
                    class="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white text-[13px] font-bold shadow-lg shadow-amber-900/40 transition disabled:opacity-50">
              <Save class="w-4 h-4" />
              {{ editSaving ? 'Menyimpan...' : 'Simpan Perubahan' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════ IMPORT MODAL ═══════ -->
    <div v-if="importOpen" class="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div class="modal-standard bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-6xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden">
        <div class="px-5 sm:px-6 py-4 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <FileUp class="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 class="text-base font-bold text-white">Import Nilai</h3>
              <p class="text-[11px] text-slate-400 mt-0.5">Langkah {{ importStep }} dari 3
                <span v-if="importHasSemInHeader" class="ml-2 inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">MULTI-SEMESTER</span>
                <span v-else-if="importStep >= 2" class="ml-2 inline-flex items-center px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 text-[10px] font-bold">SINGLE-SEMESTER</span>
              </p>
            </div>
          </div>
          <button @click="tutupImport" class="w-9 h-9 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition">
            <X class="w-4 h-4" />
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          <div v-if="importStep === 1" class="space-y-4">
            <div class="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 space-y-2">
              <div class="font-bold text-blue-300">Langkah 1: Pilih file</div>
              <p class="text-slate-300">Header baris pertama. Minimal ada kolom No Induk, Nama, dan minimal 1 kolom mapel.</p>
              <div class="pt-2 border-t border-blue-500/20">
                <div class="font-semibold text-slate-300 mb-1">💡 Import SEMUA semester sekaligus:</div>
                <div class="text-slate-400">Header kolom menyertakan info semester. Contoh:</div>
                <code class="block mt-1 px-2 py-1 rounded bg-slate-950 text-emerald-300 text-[10px] font-mono">Smt 1 Teori Matematika | Smt 1 Praktek Matematika | Smt 2 Teori...</code>
              </div>
            </div>
            <div class="p-12 flex flex-col items-center text-center space-y-4 border-2 border-dashed border-slate-700 rounded-2xl">
              <div class="w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-dashed border-emerald-500/30 flex items-center justify-center">
                <FileUp class="w-8 h-8 text-emerald-400" />
              </div>
              <label class="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold text-[13px] cursor-pointer shadow-lg transition">
                <FileUp class="w-4 h-4" /> Pilih File
                <input type="file" accept=".xlsx,.xls,.csv" @change="importHandleFile" class="hidden" />
              </label>
            </div>
          </div>

          <div v-if="importStep === 2" class="space-y-3">
            <div class="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <div class="font-bold text-emerald-300 mb-1">Langkah 2: Petakan kolom</div>
              <p class="text-slate-300">File: <b>{{ importFileName }}</b> • {{ importRows.length }} baris • {{ importHeaders.length }} kolom</p>
            </div>

            <div v-if="!importHasSemInHeader" class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-slate-300 font-semibold mb-1">Semester Default <span class="text-red-400">*</span></label>
                <CustomSelect v-model="importSemester" :options="[
                  {label:'Smt 1 (X Ganjil)',value:'1'},{label:'Smt 2 (X Genap)',value:'2'},
                  {label:'Smt 3 (XI Ganjil)',value:'3'},{label:'Smt 4 (XI Genap)',value:'4'},
                  {label:'Smt 5 (XII Ganjil)',value:'5'},{label:'Smt 6 (XII Genap)',value:'6'}
                ]" />
                <p class="text-[10px] text-slate-500 mt-1">Dipakai untuk kolom tanpa info semester.</p>
              </div>
              <div class="flex items-end">
                <div class="text-[11px] text-slate-400 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 w-full">
                  Tahun pelajaran otomatis dari <code class="text-emerald-300">siswa.masuk</code> + offset semester.
                </div>
              </div>
            </div>

            <div class="border border-slate-700 rounded-xl overflow-hidden max-h-[400px] overflow-y-auto">
              <table class="w-full text-xs">
                <thead class="bg-slate-800 text-slate-300 sticky top-0 z-10">
                  <tr>
                    <th class="px-3 py-2 text-left w-16">Kolom</th>
                    <th class="px-3 py-2 text-left">Header</th>
                    <th class="px-3 py-2 text-left">Target</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-800">
                  <tr v-for="(h, i) in importHeaders" :key="i">
                    <td class="px-3 py-2 font-mono text-emerald-300">{{ String.fromCharCode(65 + (i % 26)) }}</td>
                    <td class="px-3 py-2 text-slate-200">{{ h }}</td>
                    <td class="px-3 py-2">
                      <select :value="importMapping[i]?.type === 'identity' ? 'id:' + importMapping[i].field : (importMapping[i]?.type === 'tahun' ? `thn:${importMapping[i].semester}` : (importMapping[i]?.type === 'nilai' ? `n:${importMapping[i].semester}|${importMapping[i].mapel}|${importMapping[i].jenis}` : ''))"
                              @change="e => { const v = e.target.value; if (!v) importMapping[i] = { type: 'skip' }; else if (v.startsWith('id:')) importMapping[i] = { type: 'identity', field: v.slice(3) }; else if (v.startsWith('thn:')) importMapping[i] = { type: 'tahun', semester: parseInt(v.slice(4), 10) }; else if (v.startsWith('n:')) { const [sem, mp, j] = v.slice(2).split('|'); importMapping[i] = { type: 'nilai', semester: parseInt(sem, 10), mapel: mp, jenis: j } } }"
                              class="w-full bg-slate-950 border border-slate-700 rounded-md px-2 py-1.5 text-xs text-white outline-none focus:border-emerald-500 cursor-pointer">
                        <option value="">— Abaikan —</option>
                        <option value="id:no_induk">IDENTITAS · No Induk</option>
                        <option value="id:nama">IDENTITAS · Nama</option>
                        <optgroup v-for="s in 6" :key="'thn' + s" :label="'Tahun Pelajaran Smt ' + s">
                          <option :value="`thn:${s}`">Tahun Smt {{ s }}</option>
                        </optgroup>
                        <optgroup v-for="s in 6" :key="'s' + s" :label="'Semester ' + s">
                          <template v-for="mp in MAPEL_LIST" :key="s + mp">
                            <option :value="`n:${s}|${mp}|teori`">{{ mp }} — Teori</option>
                            <option :value="`n:${s}|${mp}|praktek`">{{ mp }} — Praktek</option>
                          </template>
                        </optgroup>
                      </select>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="flex justify-between gap-2">
              <button @click="importStep = 1"
                      class="h-10 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[13px] font-semibold transition">
                ← Pilih Ulang
              </button>
              <button @click="importRunPreview" :disabled="!importCanPreview() || importLoading"
                      class="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white text-[13px] font-bold shadow-lg shadow-emerald-900/40 transition disabled:opacity-50">
                {{ importLoading ? 'Memeriksa...' : 'Preview & Periksa' }}
              </button>
            </div>
          </div>

          <div v-if="importStep === 3" class="space-y-3">
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div class="p-3 rounded-xl bg-slate-950/60 border border-slate-700 text-center">
                <div class="text-[10px] text-slate-400">Total</div>
                <div class="text-lg font-bold text-white">{{ importCounts.total }}</div>
              </div>
              <div class="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center">
                <div class="text-[10px] text-emerald-300">Cocok</div>
                <div class="text-lg font-bold text-emerald-400">{{ importCounts.cocok }}</div>
              </div>
              <div class="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-center">
                <div class="text-[10px] text-red-300">Tidak Ditemukan</div>
                <div class="text-lg font-bold text-red-400">{{ importCounts.tidak_ditemukan }}</div>
              </div>
              <div class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-center">
                <div class="text-[10px] text-amber-300">Nama Beda</div>
                <div class="text-lg font-bold text-amber-400">{{ importCounts.nama_tidak_cocok }}</div>
              </div>
            </div>
            <div class="flex items-center justify-between">
              <div class="text-slate-400"><span class="text-emerald-400 font-bold">{{ importTotalSelected }}</span> baris dipilih</div>
              <div class="flex gap-2">
                <button @click="importPilihSemua(true)" class="text-[11px] text-emerald-400 hover:text-emerald-300 underline">Pilih Semua</button>
                <button @click="importPilihSemua(false)" class="text-[11px] text-slate-400 hover:text-white underline">Kosongkan</button>
              </div>
            </div>
            <div class="max-h-[400px] overflow-auto border border-slate-700 rounded-xl">
              <table class="w-full text-xs min-w-[750px]">
                <thead class="bg-slate-800 text-slate-300 sticky top-0 z-10">
                  <tr>
                    <th class="px-3 py-2 w-10">✓</th>
                    <th class="px-3 py-2">Baris</th>
                    <th class="px-3 py-2">No Induk</th>
                    <th class="px-3 py-2">Nama</th>
                    <th class="px-3 py-2">Semester</th>
                    <th class="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-800">
                  <tr v-for="it in importPreview" :key="it.rowIndex">
                    <td class="px-3 py-2 text-center">
                      <input type="checkbox" :checked="!!importSelected[it.rowIndex]" :disabled="it.status !== 'cocok'"
                             @change="importToggle(it.rowIndex)" class="w-4 h-4 accent-emerald-500" />
                    </td>
                    <td class="px-3 py-2 text-slate-400">{{ it.sourceRow }}</td>
                    <td class="px-3 py-2 font-mono">{{ it.noInduk }}</td>
                    <td class="px-3 py-2 text-white">{{ it.nama }}</td>
                    <td class="px-3 py-2 text-emerald-300 font-mono text-[11px]">{{ it.semesters.length ? it.semesters.map(s => 'S' + s).join(', ') : '—' }}</td>
                    <td class="px-3 py-2">
                      <span class="px-2 py-0.5 rounded-full text-[10px] font-bold"
                            :class="{
                              'bg-emerald-500/20 text-emerald-300': it.status === 'cocok',
                              'bg-red-500/20 text-red-300': it.status === 'tidak_ditemukan' || it.status === 'duplikat_file',
                              'bg-amber-500/20 text-amber-300': it.status === 'nama_tidak_cocok',
                              'bg-slate-700 text-slate-300': it.status === 'tidak_lengkap' || it.status === 'tidak_ada_nilai'
                            }">{{ it.status }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="flex justify-between gap-2 pt-3 border-t border-slate-800">
              <button @click="importStep = 2"
                      class="h-10 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[13px] font-semibold transition">
                ← Kembali
              </button>
              <button @click="importCommit" :disabled="!importTotalSelected || importLoading"
                      class="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white text-[13px] font-bold shadow-lg shadow-emerald-900/40 transition disabled:opacity-50">
                <Database class="w-4 h-4" />
                {{ importLoading ? 'Menyimpan...' : `Simpan ${importTotalSelected} Baris` }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════ EXPORT MODAL ═══════ -->
    <div v-if="exportOpen" class="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div class="modal-standard bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-4xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden">
        <div class="px-5 sm:px-6 py-4 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center shrink-0">
              <Download class="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 class="text-base font-bold text-white">Export Nilai Akademik</h3>
              <p class="text-[11px] text-slate-400 mt-0.5">Pilih siswa, atur filter, lalu unduh Excel</p>
            </div>
          </div>
          <button @click="tutupExport" class="w-9 h-9 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition">
            <X class="w-4 h-4" />
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div class="rounded-xl border border-slate-800 bg-slate-950/40 overflow-hidden">
              <div class="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
                <div class="flex items-center gap-2"><School class="w-3.5 h-3.5 text-blue-400" /><span class="text-xs font-bold text-white">Filter Kelas</span></div>
                <button @click="exportKelas = []; exportSelectedSiswa = []" class="text-[10px] text-red-400 hover:text-red-300 underline font-semibold">Reset</button>
              </div>
              <div class="p-2">
                <div class="relative mb-2">
                  <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
                  <input v-model="exportSearchKelas" type="text" placeholder="Cari kelas..."
                         class="w-full pl-7 pr-2 py-1.5 bg-slate-950 border border-slate-800 rounded-md text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500" />
                </div>
                <div class="max-h-32 overflow-y-auto space-y-0.5">
                  <label v-for="k in exportKelasFiltered" :key="k" class="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-800/60 cursor-pointer transition">
                    <input type="checkbox" :checked="exportKelas.includes(k)" @change="exportToggleKelas(k)" class="accent-emerald-500 w-3.5 h-3.5" />
                    <span class="text-xs text-slate-200">{{ k }}</span>
                  </label>
                  <div v-if="exportKelasFiltered.length === 0" class="text-center text-[10px] text-slate-500 py-2">Tidak ada kelas</div>
                </div>
              </div>
              <div class="px-3 py-1.5 border-t border-slate-800 text-[10px] text-slate-500">
                <span class="text-emerald-400 font-bold">{{ exportKelas.length }}</span> dipilih • {{ kelasOptions.length }} tersedia
              </div>
            </div>

            <div class="rounded-xl border border-slate-800 bg-slate-950/40 overflow-hidden">
              <div class="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
                <div class="flex items-center gap-2"><Calendar class="w-3.5 h-3.5 text-purple-400" /><span class="text-xs font-bold text-white">Filter Angkatan</span></div>
                <button @click="exportAngkatan = []; exportSelectedSiswa = []" class="text-[10px] text-red-400 hover:text-red-300 underline font-semibold">Reset</button>
              </div>
              <div class="p-2">
                <div class="relative mb-2">
                  <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
                  <input v-model="exportSearchAngkatan" type="text" placeholder="Cari angkatan..."
                         class="w-full pl-7 pr-2 py-1.5 bg-slate-950 border border-slate-800 rounded-md text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500" />
                </div>
                <div class="max-h-32 overflow-y-auto space-y-0.5">
                  <label v-for="a in exportAngkatanFiltered" :key="a" class="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-800/60 cursor-pointer transition">
                    <input type="checkbox" :checked="exportAngkatan.includes(a)" @change="exportToggleAngkatan(a)" class="accent-emerald-500 w-3.5 h-3.5" />
                    <span class="text-xs text-slate-200">{{ a }}</span>
                  </label>
                  <div v-if="exportAngkatanFiltered.length === 0" class="text-center text-[10px] text-slate-500 py-2">Tidak ada angkatan</div>
                </div>
              </div>
              <div class="px-3 py-1.5 border-t border-slate-800 text-[10px] text-slate-500">
                <span class="text-emerald-400 font-bold">{{ exportAngkatan.length }}</span> dipilih • {{ angkatanOptions.length }} tersedia
              </div>
            </div>
          </div>

          <div class="rounded-xl border border-slate-800 bg-slate-950/40 overflow-hidden">
            <div class="px-3 py-2 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2">
              <div class="flex items-center gap-2"><Users class="w-3.5 h-3.5 text-emerald-400" /><span class="text-xs font-bold text-white">Pilih Siswa Spesifik</span><span class="text-[10px] text-slate-500">(opsional)</span></div>
              <div class="flex items-center gap-2">
                <button @click="exportPilihSemuaSiswa(true)" class="text-[10px] text-emerald-400 hover:text-emerald-300 underline font-semibold">Semua</button>
                <button @click="exportPilihSemuaSiswa(false)" class="text-[10px] text-slate-400 hover:text-white underline font-semibold">Kosong</button>
              </div>
            </div>
            <div class="p-2.5">
              <div class="relative mb-2">
                <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input v-model="exportSearchSiswa" type="text" placeholder="Cari nama, no induk, atau NISN..."
                       class="w-full pl-8 pr-8 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500" />
                <button v-if="exportSearchSiswa" @click="exportSearchSiswa = ''"
                        class="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 flex items-center justify-center">
                  <X class="w-3 h-3" />
                </button>
              </div>
              <div class="max-h-40 overflow-y-auto space-y-0.5 border border-slate-800 rounded-lg p-1">
                <label v-for="s in exportSiswaFiltered" :key="s.no_induk" class="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-800/60 cursor-pointer transition">
                  <input type="checkbox" :checked="exportSelectedSiswa.includes(s.no_induk)" @change="exportToggleSiswa(s.no_induk)" class="accent-emerald-500 w-3.5 h-3.5 shrink-0" />
                  <span class="text-xs text-white font-semibold truncate flex-1">{{ s.nama || '-' }}</span>
                  <span class="text-[10px] text-slate-500 font-mono shrink-0">{{ s.no_induk }}</span>
                </label>
                <div v-if="exportSiswaFiltered.length === 0" class="text-center text-[10px] text-slate-500 py-4">Tidak ada siswa yang cocok</div>
              </div>
            </div>
            <div class="px-3 py-1.5 border-t border-slate-800 text-[10px] text-slate-500">
              <span class="text-emerald-400 font-bold">{{ exportSelectedSiswa.length }}</span> siswa dipilih spesifik
              <span v-if="exportSelectedSiswa.length > 0" class="ml-1 text-slate-400">• filter kelas/angkatan diabaikan</span>
            </div>
          </div>

          <div class="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
            <label class="flex items-center gap-2 text-xs font-bold text-white mb-2">
              <BookOpen class="w-3.5 h-3.5 text-emerald-400" /> Semester yang Diexport
            </label>
            <CustomSelect v-model="exportSemester" :options="exportSemesterOptions" />
            <p class="text-[10px] text-slate-500 mt-2 leading-relaxed">
              File Excel: <b class="text-slate-300">1 baris per siswa</b>. Header 2 level:
              <b class="text-emerald-300">TEORI</b>, <b class="text-blue-300">PRAKTEK</b>, <b class="text-purple-300">IJAZAH</b>.
              <span class="block mt-1 text-slate-400">IJAZAH selalu dari 6 semester, terlepas dari filter.</span>
            </p>
          </div>

          <div class="rounded-xl border border-slate-800 bg-slate-950/40 p-3 space-y-1.5">
            <div class="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider mb-1">Metadata Export</div>
            <div class="flex items-center justify-between text-[11px]"><span class="text-slate-500">Nama Pengunduh</span><span class="text-emerald-400 font-semibold">{{ userSesi?.user_metadata?.nama || userSesi?.email || 'Administrator' }}</span></div>
            <div class="flex items-center justify-between text-[11px]"><span class="text-slate-500">Waktu Unduh</span><span class="text-slate-300">Otomatis saat download</span></div>
          </div>

          <div class="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 flex items-center justify-between">
            <div class="text-xs text-slate-300"><b class="text-emerald-400 text-base">{{ exportFinalSiswa.length }}</b> siswa akan diexport</div>
            <button @click="exportResetAll" class="text-[11px] text-slate-400 hover:text-white underline">Reset semua</button>
          </div>
        </div>

        <div class="px-5 sm:px-6 py-3 border-t border-slate-800 bg-slate-950 flex justify-end gap-2 shrink-0">
          <button @click="tutupExport" class="h-10 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[13px] font-semibold transition">Batal</button>
          <button @click="exportDo" :disabled="exportLoading || exportFinalSiswa.length === 0"
                  class="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white text-[13px] font-bold shadow-lg shadow-emerald-900/40 transition disabled:opacity-50 disabled:cursor-not-allowed">
            <Download class="w-4 h-4" />
            <span>{{ exportLoading ? 'Menyiapkan...' : `Download ${exportFinalSiswa.length} Siswa` }}</span>
          </button>
        </div>
      </div>
    </div>

  </div>
</template>
