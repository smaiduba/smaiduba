<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { supabase } from '../lib/supabase'
import { userSesi } from '../stores/auth'
import { ensureXLSX, writeXlsx } from '../lib/xlsx-lazy'
import { useDebounced } from '../lib/debounce'
import { confirm } from '../lib/confirm'
import CustomSelect from '../components/CustomSelect.vue'
import {
  Plus, Download, FileUp, Search, Edit, Trash2, X, Save, Users,
  CheckCircle2, AlertCircle, Eye, Phone, MapPin, BookOpen, Calendar
} from 'lucide-vue-next'

// ═══════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════
const daftarGuru = ref([])
const isLoading = ref(false)
const pencarian = ref('')
const pencarianDebounced = useDebounced(pencarian, 200)
const filterStatus = ref('')
const pageSize = ref(25)
const currentPage = ref(1)

// SPMB/Edit
const isModalOpen = ref(false)
const isEditMode = ref(false)
const tabAktif = ref('identitas')
const editId = ref(null)

// Detail
const detailOpen = ref(false)
const detailGuru = ref(null)

// Import
const isImportModalOpen = ref(false)
const importStep = ref(1)
const fileName = ref('')
const excelHeaders = ref([])
const excelData = ref([])
const mapping = ref({})
const importProgress = ref({ current: 0, total: 0, sukses: 0, gagal: 0 })

// Export
const exportOpen = ref(false)
const exportSearch = ref('')
const exportStatusFilter = ref('')
const exportLoading = ref(false)

// ═══════════════════════════════════════════════
// OPTIONS
// ═══════════════════════════════════════════════
const filterStatusOptions = [
  { label: 'Semua Guru', value: '' },
  { label: 'Jadwal Lengkap', value: 'lengkap' },
  { label: 'Hanya Smt 1', value: 'smt1' },
  { label: 'Hanya Smt 2', value: 'smt2' },
  { label: 'Belum Ada Jadwal', value: 'kosong' }
]
const pageSizeOptions = [
  { label: '10 / hal', value: 10 },
  { label: '25 / hal', value: 25 },
  { label: '50 / hal', value: 50 },
  { label: '100 / hal', value: 100 }
]

// ═══════════════════════════════════════════════
// TARGET FIELDS (IMPORT)
// ═══════════════════════════════════════════════
const targetFields = [
  { key: 'kg', label: 'KG (Wajib)', aliases: ['kg','kode guru','kodeguru','kode'] },
  { key: 'nama', label: 'Nama Lengkap (Wajib)', aliases: ['nama','nama guru','namaguru','namalengkap','nama lengkap'] },
  { key: 'alamat', label: 'Alamat', aliases: ['alamat'] },
  { key: 'hp', label: 'No HP', aliases: ['hp','no hp','nohp','notelp','no telp','no telepon','wa','whatsapp','notlp'] },
  { key: 'mapel_smt1', label: 'Mapel Smt I', aliases: ['mapel smt i','mapel smt 1','mapelsmt1','mapel1','mapel i'] },
  { key: 'kelas_smt1', label: 'Kelas Smt I', aliases: ['kelas smt i','kelas smt 1','kelassmt1','kelas1'] },
  { key: 'hari_smt1', label: 'Hari Smt I', aliases: ['hari smt i','hari smt 1','harismt1','hari1'] },
  { key: 'jam_smt1', label: 'Jam Smt I', aliases: ['jam smt i','jam smt 1','jamsmt1','jam1'] },
  { key: 'mapel_smt2', label: 'Mapel Smt II', aliases: ['mapel smt ii','mapel smt 2','mapelsmt2','mapel2','mapel ii'] },
  { key: 'kelas_smt2', label: 'Kelas Smt II', aliases: ['kelas smt ii','kelas smt 2','kelassmt2','kelas2'] },
  { key: 'hari_smt2', label: 'Hari Smt II', aliases: ['hari smt ii','hari smt 2','harismt2','hari2'] },
  { key: 'jam_smt2', label: 'Jam Smt II', aliases: ['jam smt ii','jam smt 2','jamsmt2','jam2'] }
]

const emptyForm = () => ({
  kg: '', nama: '', alamat: '', hp: '',
  mapel_smt1: '', kelas_smt1: '', hari_smt1: '', jam_smt1: '',
  mapel_smt2: '', kelas_smt2: '', hari_smt2: '', jam_smt2: ''
})

const form = ref(emptyForm())

// ═══════════════════════════════════════════════
// EXPORT COLUMNS
// ═══════════════════════════════════════════════
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

// ═══════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════
function guruStatus(g) {
  const adaSmt1 = !!(g.mapel_smt1 && String(g.mapel_smt1).trim())
  const adaSmt2 = !!(g.mapel_smt2 && String(g.mapel_smt2).trim())
  if (adaSmt1 && adaSmt2) return 'lengkap'
  if (adaSmt1) return 'smt1'
  if (adaSmt2) return 'smt2'
  return 'kosong'
}

function getStatusBadge(st) {
  const map = {
    lengkap: 'bg-emerald-500/20 text-emerald-300',
    smt1: 'bg-amber-500/20 text-amber-300',
    smt2: 'bg-amber-500/20 text-amber-300',
    kosong: 'bg-red-500/20 text-red-300'
  }
  return map[st] || 'bg-slate-500/20 text-slate-400'
}

function getStatusLabel(st) {
  return { lengkap: 'Lengkap', smt1: 'Hanya Smt 1', smt2: 'Hanya Smt 2', kosong: 'Kosong' }[st] || '—'
}

// ═══════════════════════════════════════════════
// COMPUTED
// ═══════════════════════════════════════════════
const guruTerfilter = computed(() => {
  const kw = pencarianDebounced.value.toLowerCase().trim()
  return daftarGuru.value.filter(g => {
    if (kw) {
      const m = (g.nama || '').toLowerCase().includes(kw) ||
                (g.kg || '').toLowerCase().includes(kw) ||
                (g.mapel_smt1 || '').toLowerCase().includes(kw) ||
                (g.mapel_smt2 || '').toLowerCase().includes(kw)
      if (!m) return false
    }
    if (filterStatus.value && guruStatus(g) !== filterStatus.value) return false
    return true
  })
})

const totalHalaman = computed(() => Math.max(1, Math.ceil(guruTerfilter.value.length / pageSize.value)))
const guruTampil = computed(() => {
  const m = (currentPage.value - 1) * pageSize.value
  return guruTerfilter.value.slice(m, m + pageSize.value)
})

const stats = computed(() => {
  const total = daftarGuru.value.length
  const lengkap = daftarGuru.value.filter(g => guruStatus(g) === 'lengkap').length
  const sebagian = daftarGuru.value.filter(g => ['smt1','smt2'].includes(guruStatus(g))).length
  const kosong = daftarGuru.value.filter(g => guruStatus(g) === 'kosong').length
  return { total, lengkap, sebagian, kosong }
})

const exportFiltered = computed(() => {
  const kw = exportSearch.value.toLowerCase().trim()
  return daftarGuru.value.filter(g => {
    if (kw) {
      const m = (g.nama || '').toLowerCase().includes(kw) ||
                (g.kg || '').toLowerCase().includes(kw) ||
                (g.mapel_smt1 || '').toLowerCase().includes(kw) ||
                (g.mapel_smt2 || '').toLowerCase().includes(kw)
      if (!m) return false
    }
    if (exportStatusFilter.value && guruStatus(g) !== exportStatusFilter.value) return false
    return true
  })
})

// ═══════════════════════════════════════════════
// WATCHERS
// ═══════════════════════════════════════════════
watch([pencarianDebounced, filterStatus, pageSize], () => { currentPage.value = 1 })
watch(totalHalaman, () => { if (currentPage.value > totalHalaman.value) currentPage.value = 1 })

// ═══════════════════════════════════════════════
// LOAD
// ═══════════════════════════════════════════════
async function ambilData() {
  isLoading.value = true
  const { data, error } = await supabase.from('guru').select('*').order('nama', { ascending: true })
  if (error) {
    alert('Gagal memuat: ' + error.message)
    isLoading.value = false
    return
  }
  daftarGuru.value = (data || []).filter(g => g.kg && String(g.kg).trim())
  isLoading.value = false
}

// ═══════════════════════════════════════════════
// FORM (TAMBAH / EDIT)
// ═══════════════════════════════════════════════
function bukaModal(g = null) {
  if (g) {
    isEditMode.value = true
    editId.value = g.kg
    form.value = {
      kg: g.kg || '', nama: g.nama || '', alamat: g.alamat || '', hp: g.hp || '',
      mapel_smt1: g.mapel_smt1 || '', kelas_smt1: g.kelas_smt1 || '',
      hari_smt1: g.hari_smt1 || '', jam_smt1: g.jam_smt1 || '',
      mapel_smt2: g.mapel_smt2 || '', kelas_smt2: g.kelas_smt2 || '',
      hari_smt2: g.hari_smt2 || '', jam_smt2: g.jam_smt2 || ''
    }
  } else {
    isEditMode.value = false
    editId.value = null
    form.value = emptyForm()
  }
  tabAktif.value = 'identitas'
  isModalOpen.value = true
}

async function simpanGuru() {
  if (!form.value.kg || !form.value.nama) return alert('KG dan Nama wajib diisi!')
  isLoading.value = true

  const payload = {
    kg: form.value.kg.trim(),
    nama: form.value.nama.trim(),
    alamat: form.value.alamat || '',
    hp: form.value.hp || '',
    mapel_smt1: form.value.mapel_smt1 || '',
    kelas_smt1: form.value.kelas_smt1 || '',
    hari_smt1: form.value.hari_smt1 || '',
    jam_smt1: form.value.jam_smt1 || '',
    mapel_smt2: form.value.mapel_smt2 || '',
    kelas_smt2: form.value.kelas_smt2 || '',
    hari_smt2: form.value.hari_smt2 || '',
    jam_smt2: form.value.jam_smt2 || '',
    updated_at: new Date().toISOString()
  }

  let error, savedRow
  if (isEditMode.value) {
    const res = await supabase.from('guru').update(payload).eq('kg', editId.value).select().single()
    error = res.error; savedRow = res.data
    if (!error && savedRow) {
      const idx = daftarGuru.value.findIndex(x => x.kg === editId.value)
      if (idx >= 0) daftarGuru.value[idx] = savedRow
      else daftarGuru.value.push(savedRow)
    }
  } else {
    if (daftarGuru.value.some(x => x.kg === payload.kg)) {
      isLoading.value = false
      return alert('KG "' + payload.kg + '" sudah dipakai guru lain')
    }
    const res = await supabase.from('guru').insert([payload]).select().single()
    error = res.error; savedRow = res.data
    if (!error && savedRow) daftarGuru.value.push(savedRow)
  }

  if (error) alert('Gagal simpan: ' + error.message)
  else {
    daftarGuru.value.sort((a, b) => (a.nama || '').localeCompare(b.nama || ''))
    isModalOpen.value = false
  }
  isLoading.value = false
}

async function hapusGuru(kg, nama) {
  const ok = await confirm({
    title: 'Hapus Data Guru',
    message: `Yakin ingin menghapus "${nama}" (KG: ${kg})?\n\nTindakan ini tidak dapat dibatalkan.`,
    variant: 'danger',
    confirmText: 'Ya, Hapus'
  })
  if (!ok) return
  isLoading.value = true
  const { error } = await supabase.from('guru').delete().eq('kg', kg)
  if (error) alert('Gagal hapus: ' + error.message)
  else daftarGuru.value = daftarGuru.value.filter(x => x.kg !== kg)
  isLoading.value = false
}

// ═══════════════════════════════════════════════
// DETAIL
// ═══════════════════════════════════════════════
function bukaDetail(g) {
  detailGuru.value = g
  detailOpen.value = true
}
function tutupDetail() {
  detailOpen.value = false
  detailGuru.value = null
}

// ═══════════════════════════════════════════════
// IMPORT
// ═══════════════════════════════════════════════
async function handleFileUpload(e) {
  const file = e.target.files[0]
  if (!file) return
  const XLSX = await ensureXLSX()
  const reader = new FileReader()
  reader.onload = (evt) => {
    try {
      const dataBuffer = new Uint8Array(evt.target.result)
      const wb = XLSX.read(dataBuffer, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rawData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
      if (rawData.length < 2) throw new Error('File kosong atau tidak ada data.')

      const headers = rawData[0].map(h => String(h).trim()).filter(Boolean)
      const rows = rawData.slice(1).filter(row => row.some(cell => String(cell).trim() !== ''))
      excelHeaders.value = headers
      excelData.value = rows.map(row => {
        const obj = {}
        headers.forEach((h, i) => { obj[h] = row[i] !== undefined ? String(row[i]).trim() : '' })
        return obj
      })
      fileName.value = file.name

      const autoMap = {}
      headers.forEach(h => {
        const cleanH = h.toLowerCase().replace(/[^a-z0-9]/g, '')
        const found = targetFields.find(t =>
          t.aliases.some(a => a.replace(/[^a-z0-9]/g, '') === cleanH) ||
          t.label.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanH
        )
        autoMap[h] = found ? found.key : ''
      })
      mapping.value = autoMap
      importStep.value = 2
    } catch (err) {
      alert('Gagal membaca file: ' + err.message)
      e.target.value = ''
    }
  }
  reader.readAsArrayBuffer(file)
}

async function prosesImport() {
  const mappedValues = Object.values(mapping.value)
  if (!mappedValues.includes('kg') || !mappedValues.includes('nama')) {
    return alert("Kolom 'KG' dan 'Nama' wajib dipetakan!")
  }

  isLoading.value = true
  importProgress.value = { current: 0, total: excelData.value.length, sukses: 0, gagal: 0 }

  const payload = []
  let tidakLengkap = 0

  for (const row of excelData.value) {
    const getVal = (key) => {
      const h = Object.keys(mapping.value).find(k => mapping.value[k] === key)
      return h ? String(row[h] || '').trim() : ''
    }

    const kg = getVal('kg')
    const nama = getVal('nama')
    if (!kg || !nama) { tidakLengkap++; continue }

    payload.push({
      kg, nama,
      alamat: getVal('alamat'),
      hp: getVal('hp'),
      mapel_smt1: getVal('mapel_smt1'),
      kelas_smt1: getVal('kelas_smt1'),
      hari_smt1: getVal('hari_smt1'),
      jam_smt1: getVal('jam_smt1'),
      mapel_smt2: getVal('mapel_smt2'),
      kelas_smt2: getVal('kelas_smt2'),
      hari_smt2: getVal('hari_smt2'),
      jam_smt2: getVal('jam_smt2'),
      updated_at: new Date().toISOString()
    })
  }

  const uniqueMap = new Map()
  payload.forEach(p => uniqueMap.set(p.kg, p))
  const uniquePayload = Array.from(uniqueMap.values())
  const dup = payload.length - uniquePayload.length

  const BATCH = 200
  let sukses = 0, gagal = tidakLengkap + dup
  const errorLogs = []

  for (let i = 0; i < uniquePayload.length; i += BATCH) {
    const batch = uniquePayload.slice(i, i + BATCH)
    try {
      const { error } = await supabase.from('guru').upsert(batch, { onConflict: 'kg' })
      if (error) {
        for (const item of batch) {
          const { error: e2 } = await supabase.from('guru').upsert(item, { onConflict: 'kg' })
          if (e2) { gagal++; if (errorLogs.length < 3) errorLogs.push(item.kg + ': ' + e2.message) }
          else sukses++
        }
      } else sukses += batch.length
    } catch (err) {
      gagal += batch.length
      if (errorLogs.length < 3) errorLogs.push(err.message)
    }
    importProgress.value = { current: Math.min(i + BATCH, uniquePayload.length), total: uniquePayload.length, sukses, gagal }
  }

  let msg = `Import Selesai!\n\n✅ Berhasil: ${sukses}\n❌ Gagal: ${gagal}`
  if (dup > 0) msg += `\n(${dup} duplikat dibuang)`
  if (errorLogs.length) msg += `\n\n⚠ ${errorLogs.join('\n')}`
  alert(msg)

  isImportModalOpen.value = false
  importStep.value = 1
  importProgress.value = { current: 0, total: 0, sukses: 0, gagal: 0 }
  await ambilData()
  isLoading.value = false
}

function batalImport() {
  isImportModalOpen.value = false
  importStep.value = 1
  fileName.value = ''
  excelHeaders.value = []
  excelData.value = []
}

// ═══════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════
function bukaExport() {
  exportSearch.value = ''
  exportStatusFilter.value = ''
  exportOpen.value = true
}
function tutupExport() { exportOpen.value = false }

async function exportDo() {
  const rows = exportFiltered.value
  if (rows.length === 0) return alert('Tidak ada guru untuk diexport')

  exportLoading.value = true
  try {
    const now = new Date()
    const waktu = now.toLocaleDateString('id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
    const namaUser = userSesi.value?.user_metadata?.nama ||
                     userSesi.value?.user_metadata?.full_name ||
                     userSesi.value?.email ||
                     'Administrator'

    const filters = []
    if (exportStatusFilter.value) {
      const label = filterStatusOptions.find(o => o.value === exportStatusFilter.value)?.label
      if (label) filters.push('Status: ' + label)
    }
    if (exportSearch.value.trim()) filters.push('Pencarian: "' + exportSearch.value.trim() + '"')
    const filterDesc = filters.length ? filters.join(' • ') : 'Semua Data'

    const aoa = []
    aoa.push(['Waktu Pengunduhan:', waktu])
    aoa.push(['Nama Pengunduh:', namaUser])
    aoa.push(['Filter Pengunduhan:', filterDesc])
    aoa.push(['Total Guru:', rows.length])
    aoa.push([])
    aoa.push(EXPORT_COLUMNS.map(c => c.label))

    rows.forEach(g => {
      aoa.push(EXPORT_COLUMNS.map(c => g[c.key] || ''))
    })

    const date = now.toISOString().slice(0, 10)
    await writeXlsx({
      aoa,
      cols: EXPORT_COLUMNS.map(c => ({ wch: Math.max(12, Math.min(28, c.label.length + 4)) })),
      autofilterRange: {
        s: { r: 5, c: 0 },
        e: { r: 5 + rows.length, c: EXPORT_COLUMNS.length - 1 }
      },
      sheetName: 'Data Guru',
      filename: `Database_Guru_${rows.length}_${date}.xlsx`
    })
    tutupExport()
  } catch (err) {
    alert('Gagal export: ' + err.message)
  } finally {
    exportLoading.value = false
  }
}

// ═══════════════════════════════════════════════
// MOUNT
// ═══════════════════════════════════════════════
onMounted(ambilData)
</script>

<template>
  <div class="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-5">

    <!-- HEADER -->
    <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl md:text-3xl font-bold text-white tracking-tight">Data Dewan Guru</h1>
        <p class="text-sm text-slate-500 mt-1">
          Kelola data guru & jadwal mengajar •
          <span class="text-emerald-400 font-semibold">{{ stats.total }}</span> guru terdaftar
        </p>
      </div>
      <div class="flex flex-wrap gap-2 shrink-0">
        <button @click="isImportModalOpen = true; importStep = 1"
                class="inline-flex items-center gap-2 px-3.5 h-10 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-[13px] font-semibold transition">
          <FileUp class="w-4 h-4" /><span class="hidden sm:inline">Import</span>
        </button>
        <button @click="bukaExport"
                class="inline-flex items-center gap-2 px-3.5 h-10 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-[13px] font-semibold transition">
          <Download class="w-4 h-4" /><span class="hidden sm:inline">Export</span>
        </button>
        <button @click="bukaModal()"
                class="inline-flex items-center gap-2 px-4 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white text-[13px] font-bold shadow-lg shadow-emerald-900/40 transition">
          <Plus class="w-4 h-4" /><span>Tambah Guru</span>
        </button>
      </div>
    </div>

    <!-- STATS -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div class="rounded-2xl border border-slate-800 bg-slate-900/50 p-3.5">
        <div class="flex items-center gap-2 text-slate-500 text-[10.5px] font-bold uppercase tracking-wider mb-1.5">
          <Users class="w-3.5 h-3.5" /> Total
        </div>
        <div class="text-2xl font-bold text-white">{{ stats.total }}</div>
        <div class="text-[10.5px] text-slate-500 mt-0.5">Guru terdaftar</div>
      </div>
      <div class="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3.5">
        <div class="flex items-center gap-2 text-emerald-400 text-[10.5px] font-bold uppercase tracking-wider mb-1.5">
          <CheckCircle2 class="w-3.5 h-3.5" /> Lengkap
        </div>
        <div class="text-2xl font-bold text-emerald-400">{{ stats.lengkap }}</div>
        <div class="text-[10.5px] text-slate-500 mt-0.5">Smt 1 & Smt 2</div>
      </div>
      <div class="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3.5">
        <div class="flex items-center gap-2 text-amber-400 text-[10.5px] font-bold uppercase tracking-wider mb-1.5">
          <Calendar class="w-3.5 h-3.5" /> Sebagian
        </div>
        <div class="text-2xl font-bold text-amber-400">{{ stats.sebagian }}</div>
        <div class="text-[10.5px] text-slate-500 mt-0.5">Hanya 1 semester</div>
      </div>
      <div class="rounded-2xl border border-red-500/30 bg-red-500/5 p-3.5">
        <div class="flex items-center gap-2 text-red-400 text-[10.5px] font-bold uppercase tracking-wider mb-1.5">
          <AlertCircle class="w-3.5 h-3.5" /> Kosong
        </div>
        <div class="text-2xl font-bold text-red-400">{{ stats.kosong }}</div>
        <div class="text-[10.5px] text-slate-500 mt-0.5">Belum ada jadwal</div>
      </div>
    </div>

    <!-- FILTER -->
    <div class="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-3">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5">
        <div class="lg:col-span-7 relative">
          <Search class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input v-model="pencarian" type="text" placeholder="Cari nama guru, KG, atau mata pelajaran..."
                 class="w-full h-10 pl-10 pr-10 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white placeholder-slate-500 outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/10 transition-all" />
          <button v-if="pencarian" @click="pencarian = ''"
                  class="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition">
            <X class="w-3.5 h-3.5" />
          </button>
        </div>
        <div class="lg:col-span-5">
          <CustomSelect v-model="filterStatus" :options="filterStatusOptions" placeholder="Semua Guru" />
        </div>
      </div>
    </div>

    <!-- TABLE -->
    <div class="rounded-2xl border border-slate-800/80 bg-slate-900/50 overflow-hidden">
      <div class="px-4 py-3 border-b border-slate-800/80 bg-slate-950/40 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div class="text-xs text-slate-400">
          Menampilkan <b class="text-slate-200">{{ guruTampil.length }}</b> dari
          <b class="text-emerald-400">{{ guruTerfilter.length }}</b> guru
        </div>
        <div class="flex items-center gap-1.5">
          <button @click="currentPage = Math.max(1, currentPage - 1)" :disabled="currentPage === 1"
                  class="h-8 px-3 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition">
            Prev
          </button>
          <div class="h-8 px-3 flex items-center rounded-lg bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300">
            {{ currentPage }} / {{ totalHalaman }}
          </div>
          <button @click="currentPage = Math.min(totalHalaman, currentPage + 1)" :disabled="currentPage >= totalHalaman"
                  class="h-8 px-3 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition">
            Next
          </button>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-sm" style="table-layout: fixed;">
          <colgroup>
            <col style="width: 44px;">
            <col style="width: 70px;">
            <col>
            <col style="width: 220px;">
            <col style="width: 220px;">
            <col style="width: 120px;">
            <col style="width: 110px;">
          </colgroup>
          <thead class="bg-slate-950 border-b border-slate-800">
            <tr>
              <th class="px-2 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">No</th>
              <th class="px-2 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">KG</th>
              <th class="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">Nama & Alamat</th>
              <th class="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">Jadwal Smt 1</th>
              <th class="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">Jadwal Smt 2</th>
              <th class="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">Status</th>
              <th class="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800/60">
            <tr v-if="isLoading">
              <td colspan="7" class="px-4 py-16 text-center text-slate-500">Memuat data...</td>
            </tr>
            <tr v-else-if="guruTampil.length === 0">
              <td colspan="7" class="px-4 py-16 text-center">
                <div class="text-slate-500 text-sm">Tidak ada guru yang cocok</div>
                <div class="text-slate-600 text-xs mt-1">Coba ubah filter atau kata kunci pencarian</div>
              </td>
            </tr>
            <tr v-for="(g, idx) in guruTampil" :key="g.kg" class="hover:bg-slate-800/40 transition">
              <td class="px-2 py-3 text-center text-slate-500 text-xs tabular-nums">{{ (currentPage - 1) * pageSize + idx + 1 }}</td>
              <td class="px-2 py-3">
                <span class="font-mono text-[11.5px] font-bold text-emerald-400">{{ g.kg }}</span>
              </td>
              <td class="px-3 py-3">
                <div class="font-semibold text-white text-[13px] truncate">{{ g.nama || '-' }}</div>
                <div class="text-[10.5px] text-slate-500 truncate">{{ g.alamat || '—' }}</div>
              </td>
              <td class="px-3 py-3">
                <template v-if="g.mapel_smt1">
                  <div class="font-semibold text-emerald-300 text-[12px] truncate">{{ g.mapel_smt1 }}</div>
                  <div class="text-[10.5px] text-slate-500 truncate">
                    {{ [g.kelas_smt1, g.hari_smt1, g.jam_smt1].filter(Boolean).join(' · ') || '—' }}
                  </div>
                </template>
                <span v-else class="text-slate-600 italic text-[11px]">—</span>
              </td>
              <td class="px-3 py-3">
                <template v-if="g.mapel_smt2">
                  <div class="font-semibold text-blue-300 text-[12px] truncate">{{ g.mapel_smt2 }}</div>
                  <div class="text-[10.5px] text-slate-500 truncate">
                    {{ [g.kelas_smt2, g.hari_smt2, g.jam_smt2].filter(Boolean).join(' · ') || '—' }}
                  </div>
                </template>
                <span v-else class="text-slate-600 italic text-[11px]">—</span>
              </td>
              <td class="px-3 py-3 text-center">
                <span class="inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold"
                      :class="getStatusBadge(guruStatus(g))">
                  {{ getStatusLabel(guruStatus(g)) }}
                </span>
              </td>
              <td class="px-3 py-3 text-center">
                <div class="flex items-center justify-center gap-1">
                  <button @click="bukaDetail(g)"
                          class="p-1.5 rounded-md text-slate-400 hover:bg-blue-500/15 hover:text-blue-400 transition"
                          title="Lihat Detail">
                    <Eye class="w-3.5 h-3.5" />
                  </button>
                  <button @click="bukaModal(g)"
                          class="p-1.5 rounded-md text-slate-400 hover:bg-amber-500/15 hover:text-amber-400 transition"
                          title="Edit">
                    <Edit class="w-3.5 h-3.5" />
                  </button>
                  <button @click="hapusGuru(g.kg, g.nama)"
                          class="p-1.5 rounded-md text-slate-400 hover:bg-red-500/15 hover:text-red-400 transition"
                          title="Hapus">
                    <Trash2 class="w-3.5 h-3.5" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="px-4 py-3 border-t border-slate-800/80 bg-slate-950/40 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div class="text-xs text-slate-400">Total: <b class="text-emerald-400">{{ guruTerfilter.length }}</b> guru</div>
        <div class="w-24">
          <CustomSelect v-model.number="pageSize" :options="pageSizeOptions" size="sm" />
        </div>
      </div>
    </div>

    <!-- ═══════ DETAIL MODAL ═══════ -->
    <div v-if="detailOpen && detailGuru" class="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 md:p-4">
      <div class="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col w-full max-w-3xl max-h-[94vh]">
        <div class="px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shrink-0">
              <Users class="w-5 h-5 text-white" />
            </div>
            <div class="min-w-0">
              <h2 class="text-base font-bold text-white truncate">{{ detailGuru.nama }}</h2>
              <p class="text-[11px] text-slate-400 font-mono truncate">KG: {{ detailGuru.kg }}</p>
            </div>
          </div>
          <button @click="tutupDetail" class="w-9 h-9 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition">
            <X class="w-4 h-4" />
          </button>
        </div>

        <div class="p-5 overflow-y-auto flex-1 space-y-5">
          <section>
            <h3 class="text-[11px] font-bold uppercase tracking-wider text-emerald-400 mb-2 pb-1 border-b border-slate-800">Identitas</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-[12.5px]">
              <div><div class="text-slate-500 text-[10.5px] uppercase">KG</div><div class="text-white font-mono font-semibold">{{ detailGuru.kg || '—' }}</div></div>
              <div><div class="text-slate-500 text-[10.5px] uppercase">Nama Lengkap</div><div class="text-white font-semibold">{{ detailGuru.nama || '—' }}</div></div>
              <div><div class="text-slate-500 text-[10.5px] uppercase">No HP</div><div class="text-white font-mono">{{ detailGuru.hp || '—' }}</div></div>
              <div class="md:col-span-2"><div class="text-slate-500 text-[10.5px] uppercase">Alamat</div><div class="text-white">{{ detailGuru.alamat || '—' }}</div></div>
            </div>
          </section>

          <section>
            <h3 class="text-[11px] font-bold uppercase tracking-wider text-emerald-400 mb-2 pb-1 border-b border-slate-800">Jadwal Semester 1</h3>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-[12.5px]">
              <div><div class="text-slate-500 text-[10.5px] uppercase">Mata Pelajaran</div><div class="text-white font-semibold">{{ detailGuru.mapel_smt1 || '—' }}</div></div>
              <div><div class="text-slate-500 text-[10.5px] uppercase">Kelas</div><div class="text-white">{{ detailGuru.kelas_smt1 || '—' }}</div></div>
              <div><div class="text-slate-500 text-[10.5px] uppercase">Hari</div><div class="text-white">{{ detailGuru.hari_smt1 || '—' }}</div></div>
              <div><div class="text-slate-500 text-[10.5px] uppercase">Jam</div><div class="text-white font-mono">{{ detailGuru.jam_smt1 || '—' }}</div></div>
            </div>
          </section>

          <section>
            <h3 class="text-[11px] font-bold uppercase tracking-wider text-blue-400 mb-2 pb-1 border-b border-slate-800">Jadwal Semester 2</h3>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-[12.5px]">
              <div><div class="text-slate-500 text-[10.5px] uppercase">Mata Pelajaran</div><div class="text-white font-semibold">{{ detailGuru.mapel_smt2 || '—' }}</div></div>
              <div><div class="text-slate-500 text-[10.5px] uppercase">Kelas</div><div class="text-white">{{ detailGuru.kelas_smt2 || '—' }}</div></div>
              <div><div class="text-slate-500 text-[10.5px] uppercase">Hari</div><div class="text-white">{{ detailGuru.hari_smt2 || '—' }}</div></div>
              <div><div class="text-slate-500 text-[10.5px] uppercase">Jam</div><div class="text-white font-mono">{{ detailGuru.jam_smt2 || '—' }}</div></div>
            </div>
          </section>
        </div>

        <div class="px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex justify-end gap-2 shrink-0">
          <button @click="tutupDetail"
                  class="h-10 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[13px] font-semibold transition">
            Tutup
          </button>
          <button @click="tutupDetail(); bukaModal(detailGuru)"
                  class="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white text-[13px] font-bold shadow-lg shadow-amber-900/40 transition">
            <Edit class="w-4 h-4" /> Edit Data
          </button>
        </div>
      </div>
    </div>

    <!-- ═══════ FORM MODAL ═══════ -->
    <div v-if="isModalOpen" class="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 md:p-4">
      <div class="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col w-full max-w-3xl max-h-[94vh]">
        <div class="px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-900/40">
              <Plus class="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 class="text-[15px] font-bold text-white">{{ isEditMode ? 'Edit Data Guru' : 'Tambah Guru Baru' }}</h2>
              <p class="text-[11px] text-slate-500">{{ isEditMode ? 'KG: ' + editId : 'Data dewan guru baru' }}</p>
            </div>
          </div>
          <button @click="isModalOpen = false" class="w-9 h-9 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition">
            <X class="w-4 h-4" />
          </button>
        </div>

        <div class="flex border-b border-slate-800 bg-slate-950/30 px-3 shrink-0">
          <button v-for="t in [
            {id:'identitas', l:'Identitas', icon: Users},
            {id:'smt1', l:'Jadwal Smt 1', icon: Calendar},
            {id:'smt2', l:'Jadwal Smt 2', icon: Calendar}
          ]" :key="t.id" @click="tabAktif = t.id"
            class="relative px-4 py-3 text-[12.5px] font-semibold whitespace-nowrap transition-colors flex items-center gap-2"
            :class="tabAktif === t.id ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'">
            <component :is="t.icon" class="w-3.5 h-3.5" />{{ t.l }}
            <span v-if="tabAktif === t.id" class="absolute bottom-0 left-2 right-2 h-0.5 rounded-t bg-emerald-500"></span>
          </button>
        </div>

        <div class="p-5 md:p-6 overflow-y-auto flex-1 space-y-4">
          <!-- IDENTITAS -->
          <div v-if="tabAktif === 'identitas'" class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label class="block text-[11.5px] font-semibold text-slate-400 mb-1">KG (Kode Guru) <span class="text-red-400">*</span></label>
              <input v-model="form.kg" type="text" :disabled="isEditMode" placeholder="Contoh: A, B, KG-01"
                     class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white placeholder-slate-500 focus:border-emerald-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed font-mono" />
              <p class="text-[10px] text-slate-500 mt-1">{{ isEditMode ? 'KG tidak dapat diubah' : 'Kode unik guru, tidak dapat diubah setelah disimpan' }}</p>
            </div>
            <div>
              <label class="block text-[11.5px] font-semibold text-slate-400 mb-1">Nama Lengkap & Gelar <span class="text-red-400">*</span></label>
              <input v-model="form.nama" type="text" placeholder="Contoh: Ahmad Fauzi, S.Pd."
                     class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white placeholder-slate-500 focus:border-emerald-500 outline-none" />
            </div>
            <div>
              <label class="block text-[11.5px] font-semibold text-slate-400 mb-1">No HP / WhatsApp</label>
              <input v-model="form.hp" type="text" placeholder="08xxxxxxxxxx"
                     class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white placeholder-slate-500 focus:border-emerald-500 outline-none font-mono" />
            </div>
            <div class="md:col-span-2">
              <label class="block text-[11.5px] font-semibold text-slate-400 mb-1">Alamat</label>
              <textarea v-model="form.alamat" rows="2" placeholder="Alamat lengkap"
                        class="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white placeholder-slate-500 focus:border-emerald-500 outline-none resize-none"></textarea>
            </div>
          </div>

          <!-- SMT 1 -->
          <div v-if="tabAktif === 'smt1'" class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div class="md:col-span-2">
              <label class="block text-[11.5px] font-semibold text-slate-400 mb-1">Mata Pelajaran</label>
              <input v-model="form.mapel_smt1" type="text" placeholder="Contoh: Fiqih, Akidah Akhlak"
                     class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white placeholder-slate-500 focus:border-emerald-500 outline-none" />
              <p class="text-[10px] text-slate-500 mt-1">Boleh lebih dari satu, pisahkan dengan koma</p>
            </div>
            <div>
              <label class="block text-[11.5px] font-semibold text-slate-400 mb-1">Kelas</label>
              <input v-model="form.kelas_smt1" type="text" placeholder="Contoh: X A, XI B"
                     class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white placeholder-slate-500 focus:border-emerald-500 outline-none" />
            </div>
            <div>
              <label class="block text-[11.5px] font-semibold text-slate-400 mb-1">Hari</label>
              <input v-model="form.hari_smt1" type="text" placeholder="Contoh: Senin, Rabu"
                     class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white placeholder-slate-500 focus:border-emerald-500 outline-none" />
            </div>
            <div class="md:col-span-2">
              <label class="block text-[11.5px] font-semibold text-slate-400 mb-1">Jam</label>
              <input v-model="form.jam_smt1" type="text" placeholder="Contoh: 07:30 - 08:40"
                     class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white placeholder-slate-500 focus:border-emerald-500 outline-none font-mono" />
            </div>
          </div>

          <!-- SMT 2 -->
          <div v-if="tabAktif === 'smt2'" class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div class="md:col-span-2">
              <label class="block text-[11.5px] font-semibold text-slate-400 mb-1">Mata Pelajaran</label>
              <input v-model="form.mapel_smt2" type="text" placeholder="Contoh: Fiqih, Akidah Akhlak"
                     class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white placeholder-slate-500 focus:border-emerald-500 outline-none" />
              <p class="text-[10px] text-slate-500 mt-1">Boleh lebih dari satu, pisahkan dengan koma</p>
            </div>
            <div>
              <label class="block text-[11.5px] font-semibold text-slate-400 mb-1">Kelas</label>
              <input v-model="form.kelas_smt2" type="text" placeholder="Contoh: X A, XI B"
                     class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white placeholder-slate-500 focus:border-emerald-500 outline-none" />
            </div>
            <div>
              <label class="block text-[11.5px] font-semibold text-slate-400 mb-1">Hari</label>
              <input v-model="form.hari_smt2" type="text" placeholder="Contoh: Senin, Rabu"
                     class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white placeholder-slate-500 focus:border-emerald-500 outline-none" />
            </div>
            <div class="md:col-span-2">
              <label class="block text-[11.5px] font-semibold text-slate-400 mb-1">Jam</label>
              <input v-model="form.jam_smt2" type="text" placeholder="Contoh: 07:30 - 08:40"
                     class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white placeholder-slate-500 focus:border-emerald-500 outline-none font-mono" />
            </div>
          </div>
        </div>

        <div class="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between shrink-0">
          <span class="text-[11px] text-slate-500"><span class="text-red-400 font-bold">*</span> wajib diisi</span>
          <div class="flex gap-2">
            <button @click="isModalOpen = false"
                    class="h-10 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[13px] font-semibold transition">
              Batal
            </button>
            <button @click="simpanGuru" :disabled="isLoading"
                    class="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white text-[13px] font-bold shadow-lg shadow-emerald-900/40 transition disabled:opacity-50">
              <Save class="w-4 h-4" />
              {{ isLoading ? 'Menyimpan...' : 'Simpan' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════ IMPORT MODAL ═══════ -->
    <div v-if="isImportModalOpen" class="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div class="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-4xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden">
        <div class="px-5 sm:px-6 py-4 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center">
              <FileUp class="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 class="text-base font-bold text-white">Import Data Guru</h3>
              <p class="text-[11px] text-slate-400 mt-0.5">Langkah {{ importStep }} dari 2</p>
            </div>
          </div>
          <button @click="batalImport" class="w-9 h-9 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition">
            <X class="w-4 h-4" />
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          <div v-if="importStep === 1" class="space-y-4">
            <div class="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4">
              <div class="font-bold text-blue-300 mb-1">Pilih file Excel</div>
              <p class="text-slate-300">Format .xlsx atau .xls. Baris pertama berisi judul kolom (KG, Nama, Alamat, dst).</p>
            </div>
            <div class="p-12 flex flex-col items-center text-center space-y-4 border-2 border-dashed border-slate-700 rounded-2xl">
              <div class="w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-dashed border-emerald-500/30 flex items-center justify-center">
                <FileUp class="w-8 h-8 text-emerald-400" />
              </div>
              <label class="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold text-[13px] cursor-pointer shadow-lg transition">
                <FileUp class="w-4 h-4" /> Pilih File
                <input type="file" accept=".xlsx,.xls" class="hidden" @change="handleFileUpload">
              </label>
            </div>
          </div>

          <div v-if="importStep === 2" class="space-y-3">
            <div class="px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-[11.5px] text-blue-300 flex items-start gap-2">
              <AlertCircle class="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <div><b>{{ fileName }}</b> — Cocokkan kolom Excel dengan kolom database. KG dan Nama wajib dipetakan.</div>
            </div>
            <div class="space-y-2 max-h-[44vh] overflow-y-auto">
              <div v-for="header in excelHeaders" :key="header"
                   class="grid grid-cols-1 md:grid-cols-2 gap-2 items-center p-2.5 bg-slate-950/60 border border-slate-800 rounded-lg">
                <div class="text-[12.5px] font-semibold text-emerald-400 truncate flex items-center gap-2">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>{{ header }}
                </div>
                <select v-model="mapping[header]"
                        class="h-9 w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 text-[12px] text-white focus:border-emerald-500/60 outline-none transition">
                  <option value="">— Abaikan —</option>
                  <option v-for="f in targetFields" :key="f.key" :value="f.key">{{ f.label }}</option>
                </select>
              </div>
            </div>
            <div v-if="isLoading && importProgress.total > 0" class="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
              <div class="flex items-center justify-between text-[11px] text-emerald-300 font-semibold mb-2">
                <span>Memproses...</span>
                <span class="font-mono">{{ importProgress.current }} / {{ importProgress.total }}</span>
              </div>
              <div class="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div class="bg-gradient-to-r from-emerald-500 to-teal-500 h-full transition-all"
                     :style="{ width: (importProgress.current / importProgress.total * 100) + '%' }"></div>
              </div>
            </div>
          </div>
        </div>

        <div class="px-5 sm:px-6 py-3 border-t border-slate-800 bg-slate-950 flex justify-between gap-2 shrink-0">
          <button v-if="importStep === 2" @click="importStep = 1"
                  class="h-10 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[13px] font-semibold transition">
            ← Kembali
          </button>
          <div class="flex gap-2 ml-auto">
            <button @click="batalImport"
                    class="h-10 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[13px] font-semibold transition">
              Batal
            </button>
            <button v-if="importStep === 2" @click="prosesImport" :disabled="isLoading"
                    class="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white text-[13px] font-bold shadow-lg shadow-emerald-900/40 transition disabled:opacity-50">
              <CheckCircle2 class="w-4 h-4" />
              {{ isLoading ? 'Memproses...' : 'Proses Import' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════ EXPORT MODAL ═══════ -->
    <div v-if="exportOpen" class="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div class="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden">
        <div class="px-5 sm:px-6 py-4 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center shrink-0">
              <Download class="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 class="text-base font-bold text-white">Export Data Guru</h3>
              <p class="text-[11px] text-slate-400 mt-0.5">Filter & unduh data guru sebagai Excel</p>
            </div>
          </div>
          <button @click="tutupExport" class="w-9 h-9 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition">
            <X class="w-4 h-4" />
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          <div class="rounded-xl border border-slate-800 bg-slate-950/40 p-3 space-y-3">
            <div>
              <label class="block text-xs font-bold text-white mb-1.5">Cari Guru (opsional)</label>
              <div class="relative">
                <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input v-model="exportSearch" type="text" placeholder="Nama, KG, atau mata pelajaran..."
                       class="w-full h-10 pl-10 pr-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white placeholder-slate-500 outline-none focus:border-emerald-500" />
              </div>
            </div>
            <div>
              <label class="block text-xs font-bold text-white mb-1.5">Filter Status</label>
              <CustomSelect v-model="exportStatusFilter" :options="filterStatusOptions" placeholder="Semua Guru" />
            </div>
          </div>

          <div class="rounded-xl border border-slate-800 bg-slate-950/40 p-3 space-y-1.5">
            <div class="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider mb-1">Metadata Export</div>
            <div class="flex items-center justify-between text-[11px]">
              <span class="text-slate-500">Nama Pengunduh</span>
              <span class="text-emerald-400 font-semibold">{{ userSesi?.user_metadata?.nama || userSesi?.email || 'Administrator' }}</span>
            </div>
            <div class="flex items-center justify-between text-[11px]">
              <span class="text-slate-500">Waktu Unduh</span>
              <span class="text-slate-300">Otomatis saat download</span>
            </div>
            <div class="flex items-center justify-between text-[11px]">
              <span class="text-slate-500">Kolom Diexport</span>
              <span class="text-slate-300">{{ EXPORT_COLUMNS.length }} kolom</span>
            </div>
          </div>

          <div class="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 flex items-center justify-between">
            <div class="text-xs text-slate-300">
              <b class="text-emerald-400 text-base">{{ exportFiltered.length }}</b> guru akan diexport
            </div>
            <button @click="exportSearch = ''; exportStatusFilter = ''"
                    class="text-[11px] text-slate-400 hover:text-white underline">
              Reset filter
            </button>
          </div>
        </div>

        <div class="px-5 sm:px-6 py-3 border-t border-slate-800 bg-slate-950 flex justify-end gap-2 shrink-0">
          <button @click="tutupExport"
                  class="h-10 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[13px] font-semibold transition">
            Batal
          </button>
          <button @click="exportDo" :disabled="exportLoading || exportFiltered.length === 0"
                  class="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white text-[13px] font-bold shadow-lg shadow-emerald-900/40 transition disabled:opacity-50 disabled:cursor-not-allowed">
            <Download class="w-4 h-4" />
            <span>{{ exportLoading ? 'Menyiapkan...' : `Download ${exportFiltered.length} Guru` }}</span>
          </button>
        </div>
      </div>
    </div>

  </div>
</template>