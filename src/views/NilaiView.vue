<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { supabase } from '../lib/supabase'
import { userSesi } from '../stores/auth'
import { ensureXLSX, writeXlsx } from '../lib/xlsx-lazy'
import { confirm } from '../lib/confirm'
import CustomSelect from '../components/CustomSelect.vue'
import {
  Plus, X, Save, Edit, Trash2, BookMarked, Users, Award, TrendingUp,
  Search, Download, AlertCircle, CheckCircle2, Settings, ChevronRight, FileUp, Database
} from 'lucide-vue-next'
import { getTingkatUntukTahun, getTahunPerTingkatLengkap } from '../lib/tahun'

// ═══════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════
const activeTab = ref('konfig')   // 'konfig' | 'nilai'

// Konfig
const daftarKonfig = ref([])
const isLoadingKonfig = ref(false)
const konfigModalOpen = ref(false)
const isEditKonfig = ref(false)
const editKonfigId = ref(null)
const konfigForm = ref({ tahun_ajaran: '', tingkat: '', semester: '', mapel: [] })
const konfigSaving = ref(false)

// Input Nilai
const selectedKonfigId = ref('')
const konfigAktif = ref(null)
const mapelAktif = ref([])
const siswaAktif = ref([])
const nilaiMap = ref({})        // `${no_induk}|${mapel_id}` → value
const originalMap = ref({})     // snapshot untuk deteksi dirty
const isLoadingNilai = ref(false)
const isSaving = ref(false)
const searchSiswa = ref('')

// Export
const exportModalOpen = ref(false)
const exportSearchSiswa = ref('')
const exportAllConfigs = ref(true)
const exportSelectedConfigs = ref([])
const exportLoading = ref(false)

// Import
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
const importUnmapped = ref([])

// ── Pagination: Konfigurasi ──
const konfigPageSize = ref(25)
const konfigCurrentPage = ref(1)
const konfigPageSizeOptions = [
  { label: '10 / hal', value: 10 },
  { label: '25 / hal', value: 25 },
  { label: '50 / hal', value: 50 },
  { label: '100 / hal', value: 100 }
]

// ── Pagination: Siswa (tab Nilai) ──
const siswaPageSize = ref(25)
const siswaCurrentPage = ref(1)
const siswaPageSizeOptions = konfigPageSizeOptions

// ─── OPTIONS ───
const tahunOptions = computed(() => {
  const set = new Set()
  const now = new Date().getFullYear()
  for (let y = now - 5; y <= now + 3; y++) {
    set.add(`${y}-${y + 1}`)   // strip, konsisten dengan migrasi
  }
  daftarKonfig.value.forEach(k => set.add(k.tahun_ajaran))
  return Array.from(set).sort().reverse().map(t => ({ label: t, value: t }))
})

const tingkatOptions = [
  { label: 'Kelas X', value: 'X' },
  { label: 'Kelas XI', value: 'XI' },
  { label: 'Kelas XII', value: 'XII' }
]

const semesterOptions = [
  { label: 'Semester I (Ganjil)', value: 'I' },
  { label: 'Semester II (Genap)', value: 'II' }
]

const konfigOptions = computed(() =>
  daftarKonfig.value.map(k => ({
    label: `${k.tahun_ajaran} • ${k.tingkat} • Smt ${k.semester} (${k.mapel_count || 0} mapel)`,
    value: k.id
  }))
)

const konfigTahunValid = computed(() =>
  /^\d{4}-\d{4}$/.test(konfigForm.value.tahun_ajaran || '')
)

// ═══════════════════════════════════════════════
// COMPUTED
// ═══════════════════════════════════════════════
const stats = computed(() => {
  const total = daftarKonfig.value.length
  const mapel = daftarKonfig.value.reduce((a, k) => a + (k.mapel_count || 0), 0)
  return { total, mapel }
})

const dirtyCount = computed(() => {
  let n = 0
  for (const key in nilaiMap.value) {
    if (nilaiMap.value[key] !== originalMap.value[key]) n++
  }
  return n
})

const siswaTerfilter = computed(() => {
  const kw = searchSiswa.value.toLowerCase().trim()
  if (!kw) return siswaAktif.value
  return siswaAktif.value.filter(s =>
    (s.nama || '').toLowerCase().includes(kw) || (s.no_induk || '').toLowerCase().includes(kw)
  )
})

// Ranking per kelas
const siswaDenganRanking = computed(() => {
  const result = siswaTerfilter.value.map(s => {
    let sum = 0, count = 0
    mapelAktif.value.forEach(m => {
      const key = `${s.no_induk}|${m.id}`
      const v = parseFloat(nilaiMap.value[key])
      if (!isNaN(v)) { sum += v; count++ }
    })
    return {
      ...s,
      _jumlah: count > 0 ? sum : null,
      _rata: count > 0 ? sum / count : null,
      _count: count
    }
  })

  // Ranking per kelas
  const byKelas = {}
  result.forEach(s => {
    const k = s.kelas || '(tanpa kelas)'
    if (!byKelas[k]) byKelas[k] = []
    byKelas[k].push(s)
  })
  Object.values(byKelas).forEach(arr => {
    arr.sort((a, b) => {
      if (a._rata === null && b._rata === null) return 0
      if (a._rata === null) return 1
      if (b._rata === null) return -1
      return b._rata - a._rata
    })
    let prevRata = null, prevRank = 0
    arr.forEach((s, i) => {
      if (s._rata === null) s._rank = null
      else if (prevRata !== null && Math.abs(s._rata - prevRata) < 0.001) s._rank = prevRank
      else { s._rank = i + 1; prevRank = s._rank; prevRata = s._rata }
    })
  })

  return result.sort((a, b) => (a.nama || '').localeCompare(b.nama || ''))
})

const konfigPaged = computed(() => {
  const start = (konfigCurrentPage.value - 1) * konfigPageSize.value
  return daftarKonfig.value.slice(start, start + konfigPageSize.value)
})
const konfigTotalPages = computed(() => Math.max(1, Math.ceil(daftarKonfig.value.length / konfigPageSize.value)))

const siswaPaged = computed(() => {
  const start = (siswaCurrentPage.value - 1) * siswaPageSize.value
  return siswaDenganRanking.value.slice(start, start + siswaPageSize.value)
})
const siswaTotalPages = computed(() => Math.max(1, Math.ceil(siswaDenganRanking.value.length / siswaPageSize.value)))

const importTotalSelected = computed(() => Object.values(importSelected.value).filter(Boolean).length)

const isConfigPlaceholder = computed(() => {
  if (!mapelAktif.value.length) return false
  if (mapelAktif.value.length > 3) return false
  return mapelAktif.value.every(m => /^mapel\s+(default|\d+)$/i.test(m.nama))
})

// ═══════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════
function tingkatSiswa(s, tahunAjaran) {
  const t = getTingkatUntukTahun(s, tahunAjaran)
  if (t) return t
  // Fallback: hanya untuk siswa tanpa tahun masuk (alumni lama)
  // Pakai kelas saat ini — tidak akurat untuk multi-tahun, tapi mencegah hilang
  if (!s.detail_data?.masuk) {
    const k = String(s.kelas || '').toUpperCase().trim()
    if (/^XII/.test(k)) return 'XII'
    if (/^XI/.test(k)) return 'XI'
    if (/^X/.test(k)) return 'X'
  }
  return null
}

function getNilai(noInduk, mapelId) {
  const v = nilaiMap.value[`${noInduk}|${mapelId}`]
  return v !== undefined && v !== null && v !== '' ? v : ''
}

function isDirty(noInduk, mapelId) {
  const key = `${noInduk}|${mapelId}`
  return (nilaiMap.value[key] || '') !== (originalMap.value[key] || '')
}

// ═══════════════════════════════════════════════
// LOAD KONFIG
// ═══════════════════════════════════════════════
async function loadKonfig() {
  isLoadingKonfig.value = true
  try {
    const { data: konfigs, error } = await supabase
      .from('muadalah_konfig')
      .select('*')
      .order('tahun_ajaran', { ascending: false })
      .order('tingkat')
      .order('semester')
    if (error) throw error

    const { data: mapels } = await supabase.from('muadalah_mapel').select('konfig_id').eq('is_active', true)
    const mapelCount = {}
    ;(mapels || []).forEach(m => { mapelCount[m.konfig_id] = (mapelCount[m.konfig_id] || 0) + 1 })

    daftarKonfig.value = (konfigs || []).map(k => ({ ...k, mapel_count: mapelCount[k.id] || 0 }))
  } catch (err) {
    alert('Gagal memuat konfigurasi: ' + err.message)
  } finally {
    isLoadingKonfig.value = false
  }
}

// ═══════════════════════════════════════════════
// LOAD NILAI
// ═══════════════════════════════════════════════
async function loadNilai() {
  if (!selectedKonfigId.value) {
    konfigAktif.value = null
    mapelAktif.value = []
    siswaAktif.value = []
    nilaiMap.value = {}
    originalMap.value = {}
    return
  }
  isLoadingNilai.value = true
  try {
    const [rKonfig, rMapel, rSiswa] = await Promise.all([
      supabase.from('muadalah_konfig').select('*').eq('id', selectedKonfigId.value).single(),
      supabase.from('muadalah_mapel').select('*').eq('konfig_id', selectedKonfigId.value).eq('is_active', true).order('urutan').order('nama'),
      supabase.from('siswa').select('no_induk, nama, kelas, status, detail_data')
    ])
    if (rKonfig.error) throw rKonfig.error
    if (rMapel.error) throw rMapel.error
    if (rSiswa.error) throw rSiswa.error

    konfigAktif.value = rKonfig.data
    mapelAktif.value = rMapel.data || []

    const tingkat = konfigAktif.value.tingkat
    const ta = konfigAktif.value.tahun_ajaran
    siswaAktif.value = (rSiswa.data || [])
      .filter(s => {
        const st = String(s.status || '').toLowerCase()
        return !st.includes('angkatan') && !String(s.no_induk || '').toLowerCase().includes('angkatan')
      })
      .filter(s => tingkatSiswa(s, ta) === tingkat)
      .sort((a, b) => (a.nama || '').localeCompare(b.nama || ''))

    const mapelIds = mapelAktif.value.map(m => m.id)
    if (mapelIds.length > 0) {
      const { data: nilaiData, error: e2 } = await supabase
        .from('nilai_muadalah')
        .select('no_induk, mapel_id, nilai')
        .in('mapel_id', mapelIds)
      if (e2) throw e2

      const nm = {}
      ;(nilaiData || []).forEach(row => {
        if (row.nilai !== null) nm[`${row.no_induk}|${row.mapel_id}`] = String(row.nilai)
      })
      nilaiMap.value = nm
      originalMap.value = { ...nm }
    } else {
      nilaiMap.value = {}
      originalMap.value = {}
    }
    searchSiswa.value = ''
  } catch (err) {
    alert('Gagal memuat nilai: ' + err.message)
  } finally {
    isLoadingNilai.value = false
  }
}

watch(selectedKonfigId, () => { if (activeTab.value === 'nilai') loadNilai() })
watch([konfigPageSize], () => { konfigCurrentPage.value = 1 })
watch(konfigTotalPages, () => { if (konfigCurrentPage.value > konfigTotalPages.value) konfigCurrentPage.value = 1 })

watch([siswaPageSize, searchSiswa, selectedKonfigId], () => { siswaCurrentPage.value = 1 })
watch(siswaTotalPages, () => { if (siswaCurrentPage.value > siswaTotalPages.value) siswaCurrentPage.value = 1 })
watch(activeTab, (v) => { if (v === 'nilai' && selectedKonfigId.value) loadNilai() })

// ═══════════════════════════════════════════════
// KONFIG CRUD
// ═══════════════════════════════════════════════
function bukaModalKonfig(k = null) {
  if (k) {
    isEditKonfig.value = true
    editKonfigId.value = k.id
    loadKonfigForEdit(k.id)
  } else {
    isEditKonfig.value = false
    editKonfigId.value = null
    konfigForm.value = { tahun_ajaran: '', tingkat: '', semester: '', mapel: [] }
    konfigModalOpen.value = true
  }
}

async function loadKonfigForEdit(id) {
  const { data: k } = await supabase.from('muadalah_konfig').select('*').eq('id', id).single()
  const { data: mapels } = await supabase.from('muadalah_mapel')
    .select('nama, urutan').eq('konfig_id', id).eq('is_active', true).order('urutan').order('nama')
  konfigForm.value = {
    tahun_ajaran: k.tahun_ajaran,
    tingkat: k.tingkat,
    semester: k.semester,
    mapel: (mapels || []).map(m => m.nama)
  }
  konfigModalOpen.value = true
}

function tambahMapel() { konfigForm.value.mapel.push('') }
function hapusMapel(i) { konfigForm.value.mapel.splice(i, 1) }

async function simpanKonfig() {
  const f = konfigForm.value
  if (!f.tahun_ajaran || !f.tingkat || !f.semester) return alert('Tahun, tingkat, semester wajib diisi!')
    if (!/^\d{4}-\d{4}$/.test(f.tahun_ajaran)) return alert('Format tahun ajaran harus YYYY-YYYY (contoh: 2026-2027)')
  const mapelClean = f.mapel.map(m => String(m).trim()).filter(Boolean)
  if (mapelClean.length === 0) return alert('Minimal 1 mapel!')
  if (new Set(mapelClean).size !== mapelClean.length) return alert('Ada nama mapel yang duplikat!')

  konfigSaving.value = true
  try {
    if (isEditKonfig.value) {
      const { error: e1 } = await supabase.from('muadalah_konfig')
        .update({ tahun_ajaran: f.tahun_ajaran, tingkat: f.tingkat, semester: f.semester, updated_at: new Date().toISOString() })
        .eq('id', editKonfigId.value)
      if (e1) throw e1

      const { data: existing } = await supabase.from('muadalah_mapel')
        .select('id, nama').eq('konfig_id', editKonfigId.value)
      const existingMap = {}
      ;(existing || []).forEach(m => { existingMap[m.nama] = m.id })

      const toDelete = (existing || []).filter(m => !mapelClean.includes(m.nama)).map(m => m.id)
      if (toDelete.length) await supabase.from('muadalah_mapel').delete().in('id', toDelete)

      const toInsert = mapelClean.filter(n => !existingMap[n]).map(n => ({
        konfig_id: editKonfigId.value, nama: n, urutan: mapelClean.indexOf(n) + 1
      }))
      if (toInsert.length) {
        const { error: e2 } = await supabase.from('muadalah_mapel').insert(toInsert)
        if (e2) throw e2
      }

      for (let i = 0; i < mapelClean.length; i++) {
        if (existingMap[mapelClean[i]]) {
          await supabase.from('muadalah_mapel').update({ urutan: i + 1 }).eq('id', existingMap[mapelClean[i]])
        }
      }
    } else {
      const { data: newK, error: e1 } = await supabase.from('muadalah_konfig')
        .insert({ tahun_ajaran: f.tahun_ajaran, tingkat: f.tingkat, semester: f.semester })
        .select().single()
      if (e1) throw e1

      const mapelPayload = mapelClean.map((nama, i) => ({ konfig_id: newK.id, nama, urutan: i + 1 }))
      const { error: e2 } = await supabase.from('muadalah_mapel').insert(mapelPayload)
      if (e2) throw e2
    }

    konfigModalOpen.value = false
    await loadKonfig()
  } catch (err) {
    alert('Gagal simpan: ' + err.message)
  } finally {
    konfigSaving.value = false
  }
}

async function hapusKonfig(k) {
  const ok = await confirm({
    title: 'Hapus Konfigurasi',
    message: `Hapus konfigurasi ${k.tahun_ajaran} • ${k.tingkat} • Smt ${k.semester}?\n\nSemua nilai muadalah terkait konfig ini juga akan terhapus permanen.`,
    variant: 'danger',
    confirmText: 'Ya, Hapus'
  })
  if (!ok) return
  const { error } = await supabase.from('muadalah_konfig').delete().eq('id', k.id)
  if (error) return alert('Gagal hapus: ' + error.message)
  await loadKonfig()
  if (selectedKonfigId.value === k.id) {
    selectedKonfigId.value = ''
    konfigAktif.value = null
    mapelAktif.value = []
    siswaAktif.value = []
    nilaiMap.value = {}
    originalMap.value = {}
  }
}

// ═══════════════════════════════════════════════
// INPUT NILAI
// ═══════════════════════════════════════════════
function onNilaiChange(noInduk, mapelId, rawVal) {
  const key = `${noInduk}|${mapelId}`
  const v = String(rawVal || '').trim().replace(',', '.')
  const next = { ...nilaiMap.value }
  if (v === '') {
    delete next[key]
  } else {
    const num = parseFloat(v)
    if (isNaN(num)) return
    next[key] = String(num)
  }
  nilaiMap.value = next
}

function moveDown(e, noInduk, mapelId) {
  e.preventDefault()
  const idx = siswaPaged.value.findIndex(s => s.no_induk === noInduk)
  if (idx < 0 || idx >= siswaPaged.value.length - 1) return
  const next = siswaPaged.value[idx + 1]
  const view = window.matchMedia('(max-width: 767px)').matches ? 'mobile' : 'desktop'
  const el = document.querySelector(`input[data-view="${view}"][data-ni="${next.no_induk}"][data-mid="${mapelId}"]`)
  if (el) { el.focus(); el.select() }
}

async function simpanSemua() {
  if (dirtyCount.value === 0) return alert('Tidak ada perubahan')
  if (!konfigAktif.value) return alert('Pilih konfigurasi dulu')
  isSaving.value = true
  try {
    const updates = []
    const deletes = []

    Object.keys(nilaiMap.value).forEach(key => {
      const [ni, mid] = key.split('|')
      const v = nilaiMap.value[key]
      if (v && v !== originalMap.value[key]) {
        updates.push({ no_induk: ni, mapel_id: mid, nilai: parseFloat(v) })
      }
    })
    Object.keys(originalMap.value).forEach(key => {
      if (!(key in nilaiMap.value)) {
        const [ni, mid] = key.split('|')
        deletes.push({ no_induk: ni, mapel_id: mid })
      }
    })

    // ─── Fetch existing untuk preserve snapshot kelas lama ───
    if (updates.length > 0) {
      const noIndukList = [...new Set(updates.map(u => u.no_induk))]
      const mapelIds = [...new Set(updates.map(u => u.mapel_id))]
      const { data: existing } = await supabase
        .from('nilai_muadalah')
        .select('no_induk, mapel_id, tahun_ajaran, kelas, tingkat, semester')
        .in('no_induk', noIndukList)
        .in('mapel_id', mapelIds)
      const existMap = {}
      ;(existing || []).forEach(e => { existMap[`${e.no_induk}|${e.mapel_id}`] = e })

      const siswaMap = {}
      siswaAktif.value.forEach(s => { siswaMap[s.no_induk] = s })

      updates.forEach(u => {
        const key = `${u.no_induk}|${u.mapel_id}`
        const ex = existMap[key]
        const s = siswaMap[u.no_induk]
        // Preserve existing kelas (kalau sudah ada snapshot), fallback ke siswa.kelas
        u.tahun_ajaran = ex?.tahun_ajaran || konfigAktif.value.tahun_ajaran
        u.tingkat      = konfigAktif.value.tingkat
        u.semester     = konfigAktif.value.semester
        u.kelas        = ex?.kelas || s?.kelas || ''
      })
    }

    // ─── Delete yang dikosongkan ───
    for (const d of deletes) {
      await supabase.from('nilai_muadalah').delete()
        .eq('no_induk', d.no_induk).eq('mapel_id', d.mapel_id)
    }

    // ─── Batch upsert dengan snapshot ───
    const BATCH = 500
    for (let i = 0; i < updates.length; i += BATCH) {
      const batch = updates.slice(i, i + BATCH)
      const { error } = await supabase.from('nilai_muadalah')
        .upsert(batch, { onConflict: 'no_induk,mapel_id' })
      if (error) throw error
    }

    originalMap.value = { ...nilaiMap.value }
    alert(`✅ ${updates.length} nilai disimpan${deletes.length > 0 ? ', ' + deletes.length + ' dikosongkan' : ''}`)
  } catch (err) {
    alert('Gagal simpan: ' + err.message)
  } finally {
    isSaving.value = false
  }
}

// ═══════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════
// ═══════════════════════════════════════════════
// EXPORT MUADALAH
// ═══════════════════════════════════════════════
function bukaExport() {
  if (daftarKonfig.value.length === 0) return alert('Belum ada konfigurasi')
  exportSearchSiswa.value = ''
  exportAllConfigs.value = true
  exportSelectedConfigs.value = daftarKonfig.value.map(k => k.id)
  exportModalOpen.value = true
}

function toggleConfig(id) {
  const i = exportSelectedConfigs.value.indexOf(id)
  if (i >= 0) exportSelectedConfigs.value.splice(i, 1)
  else exportSelectedConfigs.value.push(id)
  exportAllConfigs.value = exportSelectedConfigs.value.length === daftarKonfig.value.length
}

function toggleAllConfigs(v) {
  exportAllConfigs.value = v
  exportSelectedConfigs.value = v ? daftarKonfig.value.map(k => k.id) : []
}

async function doExport() {
  exportLoading.value = true
  try {
    const XLSX = await ensureXLSX()
    const now = new Date()
    const waktu = now.toLocaleDateString('id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
    const namaUser = userSesi.value?.user_metadata?.nama ||
                     userSesi.value?.user_metadata?.full_name ||
                     userSesi.value?.email || 'Administrator'

    // ─── Fetch data ───
    const [{ data: allConfigs }, { data: allMapel }, { data: allSiswa }] = await Promise.all([
      supabase.from('muadalah_konfig')
        .select('id, tahun_ajaran, tingkat, semester')
        .order('tahun_ajaran').order('tingkat').order('semester'),
      supabase.from('muadalah_mapel')
        .select('id, konfig_id, nama, urutan')
        .eq('is_active', true).order('urutan'),
      supabase.from('siswa')
        .select('no_induk, nama, kelas, status, detail_data')
        .order('nama')
    ])

    if (!allConfigs || allConfigs.length === 0) {
      alert('Belum ada konfigurasi')
      exportLoading.value = false
      return
    }

    const kw = exportSearchSiswa.value.toLowerCase().trim()
    const siswaFiltered = (allSiswa || []).filter(s => {
      const st = String(s.status || '').toLowerCase()
      if (st.includes('angkatan')) return false
      if (kw) return (s.nama || '').toLowerCase().includes(kw) || (s.no_induk || '').toLowerCase().includes(kw)
      return true
    })
    if (siswaFiltered.length === 0) {
      alert('Tidak ada siswa')
      exportLoading.value = false
      return
    }

    // Mapel per config
    const mapelByCfg = {}
    ;(allMapel || []).forEach(m => {
      if (!mapelByCfg[m.konfig_id]) mapelByCfg[m.konfig_id] = []
      mapelByCfg[m.konfig_id].push(m)
    })

    // Fetch nilai
    const noIndukList = siswaFiltered.map(s => s.no_induk)
    const mapelIds = (allMapel || []).map(m => m.id)
    let nilaiData = []
    if (mapelIds.length > 0 && noIndukList.length > 0) {
      const { data } = await supabase
        .from('nilai_muadalah')
        .select('no_induk, mapel_id, nilai')
        .in('no_induk', noIndukList)
        .in('mapel_id', mapelIds)
        .not('nilai', 'is', null)
      nilaiData = data || []
    }
    const nilaiMap = {}
    nilaiData.forEach(n => { nilaiMap[`${n.no_induk}|${n.mapel_id}`] = Number(n.nilai) })

    // Config lookup by key
    const configByKey = {}
    allConfigs.forEach(c => { configByKey[`${c.tahun_ajaran}|${c.tingkat}|${c.semester}`] = c })

    // ─── Group siswa ke config ───
    const cfgRows = {}   // cfg.id → [{ no_induk, nama, kelas, tahun, nilaiArr, jumlah, rata, rank }]
    allConfigs.forEach(c => { cfgRows[c.id] = [] })

    const TINGKAT_SMT = [
      { tingkat: 'X', smt: 'I' }, { tingkat: 'X', smt: 'II' },
      { tingkat: 'XI', smt: 'I' }, { tingkat: 'XI', smt: 'II' },
      { tingkat: 'XII', smt: 'I' }, { tingkat: 'XII', smt: 'II' }
    ]

    siswaFiltered.forEach(s => {
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

    // ─── Hitung ranking per (config, kelas paralel) ───
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

    // ─── Build workbook ───
    const wb = XLSX.utils.book_new()

    // ═══ SHEET 1: Konfigurasi ═══
    const cfgAoa = []
    cfgAoa.push(['Waktu Pengunduhan:', waktu])
    cfgAoa.push(['Nama Pengunduh:', namaUser])
    cfgAoa.push([])
    const cfgHeader = ['NO', 'TAHUN PELAJARAN', 'KELAS', 'SEMESTER']
    for (let i = 1; i <= 30; i++) cfgHeader.push('MAPEL ' + i)
    cfgAoa.push(cfgHeader)

    allConfigs.forEach((c, idx) => {
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

    // ═══ SHEET 2-7: Nilai per kelas/semester ═══
    const SEM_SHEETS = [
      { name: 'X I',    tingkat: 'X',   semester: 'I'  },
      { name: 'X II',   tingkat: 'X',   semester: 'II' },
      { name: 'XI I',   tingkat: 'XI',  semester: 'I'  },
      { name: 'XI II',  tingkat: 'XI',  semester: 'II' },
      { name: 'XII I',  tingkat: 'XII', semester: 'I'  },
      { name: 'XII II', tingkat: 'XII', semester: 'II' }
    ]

    SEM_SHEETS.forEach(ss => {
      const cfgList = allConfigs.filter(c => c.tingkat === ss.tingkat && c.semester === ss.semester)

      const aoa = []
      aoa.push(['Waktu Pengunduhan:', waktu])
      aoa.push(['Nama Pengunduh:', namaUser])
      aoa.push(['Kelas:', ss.tingkat, '', 'Semester:', ss.semester])
      aoa.push([])

      const header = ['NO INDUK', 'NAMA', 'KELAS', 'TAHUN PELAJARAN']
      for (let i = 1; i <= 30; i++) header.push('N ' + i)
      header.push('JUMLAH', 'RATA-RATA', 'RANKING')
      aoa.push(header)

      // Kumpulkan semua rows dari config yang sesuai (lintas tahun)
      const allRows = []
      cfgList.forEach(c => {
        (cfgRows[c.id] || []).forEach(r => allRows.push(r))
      })

      // Sort: tahun → kelas → nama
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

    const date = now.toISOString().slice(0, 10)
    XLSX.writeFile(wb, `Muadalah_${siswaFiltered.length}siswa_${date}.xlsx`)
    exportModalOpen.value = false
  } catch (err) {
    alert('Gagal export: ' + err.message)
  } finally {
    exportLoading.value = false
  }
}

// ═══════════════════════════════════════════════
// IMPORT NILAI MUADALAH
// ═══════════════════════════════════════════════
function bukaImport() {
  if (!konfigAktif.value || mapelAktif.value.length === 0) {
    return alert('Pilih konfigurasi dulu di dropdown (dengan mapel aktif)')
  }
  importOpen.value = true
  importStep.value = 1
  importFileName.value = ''
  importHeaders.value = []
  importRows.value = []
  importMapping.value = {}
  importPreview.value = []
  importCounts.value = {}
  importSelected.value = {}
  importUnmapped.value = []
}

function tutupImport() {
  importOpen.value = false
}

function normImp(s) {
  return String(s || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

async function importHandleFile(e) {
  const file = e.target.files?.[0]
  if (!file) return
  const XLSX = await ensureXLSX()
  importFileName.value = file.name
  const reader = new FileReader()
  reader.onload = ev => {
    try {
      const wb = XLSX.read(new Uint8Array(ev.target.result), { type: 'array', cellDates: true })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false, blankrows: false })
      if (aoa.length < 2) throw new Error('File harus punya header + minimal 1 baris data')
      importHeaders.value = (aoa[0] || []).map((h, i) => String(h).trim() || `Kolom ${i + 1}`)
      importRows.value = aoa.slice(1).filter(r => r.some(c => String(c).trim() !== ''))
      autoMapImport()
      importStep.value = 2
    } catch (err) {
      alert('Gagal baca file: ' + err.message)
    }
  }
  reader.readAsArrayBuffer(file)
}

function autoMapImport() {
  const used = new Set()
  const m = {}
  const unmapped = []
  const cfgMapel = mapelAktif.value

  importHeaders.value.forEach((h, i) => {
    const nh = normImp(h)

    // Identitas
    if (['noinduk','nomorinduk','nis','ni','nomorinduksantri','noinduksantri'].includes(nh)) {
      m[i] = '@no_induk'; return
    }
    if (['nama','namasiswa','namasantri','namalengkap','namalengkapsiswa'].includes(nh)) {
      m[i] = '@nama'; return
    }
    if (['kelas','rombel','kelassiswa'].includes(nh)) {
      m[i] = '@kelas'; return
    }
    if (nh.includes('tahun')) {
      m[i] = '@tahun'; return
    }
    // Skip kolom turunan
    if (['jumlah','jml','total'].includes(nh) ||
        ['ratarata','rata','average','avg'].includes(nh) ||
        ['ranking','rank','peringkat'].includes(nh)) {
      m[i] = '@skip'; return
    }

    // Slot-based: N1, N 1, Mapel 1
    const slotMatch = nh.match(/^(?:n|mapel)(\d+)$/)
    if (slotMatch) {
      const slot = parseInt(slotMatch[1], 10) - 1
      const mp = cfgMapel[slot]
      if (mp && !used.has(mp.id)) {
        m[i] = mp.id
        used.add(mp.id)
        return
      }
    }

    // Name match
    const hit = cfgMapel.find(mp => {
      if (used.has(mp.id)) return false
      const npm = normImp(mp.nama)
      return npm === nh || npm.includes(nh) || nh.includes(npm)
    })
    if (hit) {
      m[i] = hit.id
      used.add(hit.id)
      return
    }

    m[i] = ''
    unmapped.push(h)
  })

  importMapping.value = m
  importUnmapped.value = unmapped
}

function canPreviewImport() {
  const vals = Object.values(importMapping.value)
  return vals.includes('@no_induk') && vals.includes('@nama') && vals.some(v => v && !v.startsWith('@'))
}

async function importRunPreview() {
  importLoading.value = true
  try {
    const { data: siswaList } = await supabase.from('siswa').select('no_induk, nama, kelas')
    const siswaByNo = {}
    ;(siswaList || []).forEach(s => { siswaByNo[s.no_induk] = s })

    const inputCounts = {}
    const items = importRows.value.map((row, rowIdx) => {
      const obj = {
        rowIndex: rowIdx, sourceRow: rowIdx + 2,
        noInduk: '', nama: '', kelas: '', tahun: '',
        values: {}, validCount: 0,
        status: '', message: ''
      }
      Object.entries(importMapping.value).forEach(([ci, target]) => {
        if (!target || target === '@skip') return
        const val = String(row[parseInt(ci)] || '').trim()
        if (target === '@no_induk') obj.noInduk = val
        else if (target === '@nama') obj.nama = val
        else if (target === '@kelas') obj.kelas = val
        else if (target === '@tahun') obj.tahun = val
        else if (val !== '') {
          const num = parseFloat(val.replace(',', '.'))
          if (!isNaN(num)) { obj.values[target] = num; obj.validCount++ }
        }
      })
      if (obj.noInduk) inputCounts[obj.noInduk] = (inputCounts[obj.noInduk] || 0) + 1
      return obj
    })

    items.forEach(it => {
      if (!it.noInduk || !it.nama) { it.status = 'tidak_lengkap'; it.message = 'No induk & nama wajib'; return }
      if (inputCounts[it.noInduk] > 1) { it.status = 'duplikat_file'; it.message = 'No induk muncul >1× di file'; return }
      const s = siswaByNo[it.noInduk]
      if (!s) { it.status = 'tidak_ditemukan'; it.message = 'No induk tidak ada di DB'; return }
      if (normImp(s.nama) !== normImp(it.nama)) {
        it.status = 'nama_tidak_cocok'
        it.message = `Nama di DB: "${s.nama}"`
        return
      }
      if (it.validCount === 0) { it.status = 'tidak_ada_nilai'; it.message = 'Tidak ada nilai terpetakan'; return }
      it.status = 'cocok'
      it.message = `Siap (${it.validCount} nilai)`
      it.kelas = it.kelas || s.kelas || ''
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
  } finally {
    importLoading.value = false
  }
}

function importToggle(rowIdx) {
  importSelected.value = { ...importSelected.value, [rowIdx]: !importSelected.value[rowIdx] }
}
function importPilihSemua(v) {
  const next = {}
  importPreview.value.forEach(i => { if (i.status === 'cocok') next[i.rowIndex] = v })
  importSelected.value = next
}

async function importCommit() {
  const toCommit = importPreview.value.filter(i => importSelected.value[i.rowIndex])
  if (!toCommit.length) return alert('Pilih minimal 1 baris')

  const conf = await confirm({
    title: 'Import Nilai Muadalah',
    message: `Import ${toCommit.length} siswa ke config ${konfigAktif.value.tahun_ajaran} • ${konfigAktif.value.tingkat} • Smt ${konfigAktif.value.semester}?\n\nNilai yang sudah ada akan DITIMPA.`,
    variant: 'warning',
    confirmText: 'Ya, Simpan'
  })
  if (!conf) return

  importLoading.value = true
  try {
    // Fetch existing snapshot (kelas) — preserve existing
    const noIndukList = toCommit.map(i => i.noInduk)
    const mapelIds = mapelAktif.value.map(m => m.id)
    let existingSnap = []
    if (noIndukList.length > 0 && mapelIds.length > 0) {
      const { data } = await supabase.from('nilai_muadalah')
        .select('no_induk, mapel_id, kelas')
        .in('no_induk', noIndukList)
        .in('mapel_id', mapelIds)
      existingSnap = data || []
    }
    const snapMap = {}
    existingSnap.forEach(e => { snapMap[`${e.no_induk}|${e.mapel_id}`] = e.kelas })

    // Build rows
    const upsertRows = []
    toCommit.forEach(item => {
      Object.entries(item.values).forEach(([mapelId, nilai]) => {
        upsertRows.push({
          no_induk: item.noInduk,
          mapel_id: mapelId,
          nilai: nilai,
          tahun_ajaran: konfigAktif.value.tahun_ajaran,
          tingkat: konfigAktif.value.tingkat,
          semester: konfigAktif.value.semester,
          kelas: snapMap[`${item.noInduk}|${mapelId}`] || item.kelas || ''
        })
      })
    })

    let ok = 0, fail = 0
    const errs = []
    for (let i = 0; i < upsertRows.length; i += 500) {
      const batch = upsertRows.slice(i, i + 500)
      const { error } = await supabase.from('nilai_muadalah')
        .upsert(batch, { onConflict: 'no_induk,mapel_id' })
      if (error) { fail += batch.length; errs.push(error.message) }
      else ok += batch.length
    }

    alert(`Import selesai.\n✅ ${ok} nilai disimpan${fail > 0 ? '\n❌ ' + fail + ' gagal' : ''}${errs.length ? '\n\n' + errs.slice(0, 3).join('\n') : ''}`)
    importOpen.value = false
    await loadNilai()
  } catch (err) {
    alert('Gagal commit: ' + err.message)
  } finally {
    importLoading.value = false
  }
}

// ═══════════════════════════════════════════════
// MOUNT
// ═══════════════════════════════════════════════
onMounted(loadKonfig)
</script>

<template>
  <div>
  <div class="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-5">

    <!-- HEADER -->
    <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl md:text-3xl font-bold text-white tracking-tight">Nilai Muadalah</h1>
        <p class="text-sm text-slate-500 mt-1">
          Nilai kitab kuning / kurikulum pesantren •
          <span class="text-emerald-400 font-semibold">{{ stats.total }}</span> konfigurasi
        </p>
      </div>
      <div v-if="activeTab === 'konfig'" class="flex flex-wrap gap-2 shrink-0">
        <button @click="bukaModalKonfig()"
                class="inline-flex items-center gap-2 px-4 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white text-[13px] font-bold shadow-lg shadow-emerald-900/40 transition">
          <Plus class="w-4 h-4" /><span>Konfig Baru</span>
        </button>
      </div>
    </div>

    <!-- TABS -->
    <div class="flex gap-1 border-b border-slate-800">
      <button @click="activeTab = 'konfig'"
              class="px-4 py-3 text-[13px] font-semibold border-b-2 transition flex items-center gap-2"
              :class="activeTab === 'konfig' ? 'text-emerald-400 border-emerald-500' : 'text-slate-400 border-transparent hover:text-white'">
        <Settings class="w-4 h-4" /> Konfigurasi
      </button>
      <button @click="activeTab = 'nilai'"
              class="px-4 py-3 text-[13px] font-semibold border-b-2 transition flex items-center gap-2"
              :class="activeTab === 'nilai' ? 'text-emerald-400 border-emerald-500' : 'text-slate-400 border-transparent hover:text-white'">
        <BookMarked class="w-4 h-4" /> Input Nilai
      </button>
    </div>

    <!-- ═══════ TAB KONFIG ═══════ -->
    <template v-if="activeTab === 'konfig'">
      <div class="grid grid-cols-2 gap-2 md:gap-3">
        <div class="rounded-xl md:rounded-2xl border border-slate-800 bg-slate-900/50 p-2.5 md:p-3.5">
          <div class="flex items-center gap-1.5 text-slate-500 text-[9.5px] md:text-[10.5px] font-bold uppercase tracking-wider mb-1">
            <Settings class="w-3 h-3 md:w-3.5 md:h-3.5 shrink-0" /> Total Konfig
          </div>
          <div class="text-lg md:text-2xl font-bold text-white leading-none">{{ stats.total }}</div>
        </div>
        <div class="rounded-xl md:rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-2.5 md:p-3.5">
          <div class="flex items-center gap-1.5 text-emerald-400 text-[9.5px] md:text-[10.5px] font-bold uppercase tracking-wider mb-1">
            <BookMarked class="w-3 h-3 md:w-3.5 md:h-3.5 shrink-0" /> Total Mapel
          </div>
          <div class="text-lg md:text-2xl font-bold text-emerald-400 leading-none">{{ stats.mapel }}</div>
        </div>
      </div>

      <div class="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <div class="px-4 py-3 border-b border-slate-800 bg-slate-950/40 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div class="text-xs text-slate-400">
            Menampilkan <b class="text-slate-200">{{ konfigPaged.length }}</b> dari
            <b class="text-emerald-400">{{ daftarKonfig.length }}</b> konfigurasi
          </div>
          <div class="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
            <div class="relative h-8 w-[92px] shrink-0">
              <CustomSelect v-model.number="konfigPageSize" :options="konfigPageSizeOptions" size="sm" />
            </div>
            <div class="flex items-center gap-1.5 ml-auto sm:ml-0">
              <button @click="konfigCurrentPage = Math.max(1, konfigCurrentPage - 1)" :disabled="konfigCurrentPage === 1"
                      class="h-8 px-3 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition">
                Prev
              </button>
              <div class="h-8 px-3 flex items-center rounded-lg bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 whitespace-nowrap">
                {{ konfigCurrentPage }} / {{ konfigTotalPages }}
              </div>
              <button @click="konfigCurrentPage = Math.min(konfigTotalPages, konfigCurrentPage + 1)" :disabled="konfigCurrentPage >= konfigTotalPages"
                      class="h-8 px-3 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition">
                Next
              </button>
            </div>
          </div>
        </div>

        <div class="overflow-x-auto hidden md:block">
          <table class="w-full text-sm">
            <thead class="bg-slate-950 border-b border-slate-800">
            <tr>
                <th class="px-2 py-3 text-center text-[10px] font-bold uppercase text-slate-500 w-12">No</th>
                <th class="px-3 py-3 text-left text-[10px] font-bold uppercase text-slate-500">Tahun Ajaran</th>
                <th class="px-3 py-3 text-center text-[10px] font-bold uppercase text-slate-500 w-24">Tingkat</th>
                <th class="px-3 py-3 text-center text-[10px] font-bold uppercase text-slate-500 w-32">Semester</th>
                <th class="px-3 py-3 text-center text-[10px] font-bold uppercase text-slate-500 w-24">Mapel</th>
                <th class="px-3 py-3 text-center text-[10px] font-bold uppercase text-slate-500 w-32">Aksi</th>
            </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/60">
              <tr v-if="isLoadingKonfig">
                <td colspan="6" class="px-4 py-16 text-center text-slate-500">Memuat...</td>
              </tr>
              <tr v-else-if="konfigPaged.length === 0">
                <td colspan="6" class="px-4 py-16 text-center">
                  <div class="text-slate-500 text-sm mb-2">Belum ada konfigurasi</div>
                  <button @click="bukaModalKonfig()" class="text-emerald-400 hover:text-emerald-300 underline text-xs">Buat konfigurasi pertama</button>
                </td>
              </tr>
              <tr v-for="(k, i) in konfigPaged" :key="k.id" class="hover:bg-slate-800/40 transition">
                <td class="px-2 py-3 text-center text-slate-500 text-xs">{{ (konfigCurrentPage - 1) * konfigPageSize + i + 1 }}</td>
                <td class="px-3 py-3 font-mono text-white font-semibold">{{ k.tahun_ajaran }}</td>
                <td class="px-3 py-3 text-center">
                  <span class="inline-flex px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 font-semibold text-[11px]">Kelas {{ k.tingkat }}</span>
                </td>
                <td class="px-3 py-3 text-center">
                  <span class="inline-flex px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 font-semibold text-[11px]">Smt {{ k.semester }}</span>
                </td>
                <td class="px-3 py-3 text-center font-bold text-emerald-400">{{ k.mapel_count }} mapel</td>
                <td class="px-3 py-3 text-center">
                  <div class="flex items-center justify-center gap-1">
                    <button @click="bukaModalKonfig(k)" class="p-1.5 rounded-md text-slate-400 hover:bg-amber-500/15 hover:text-amber-400 transition" title="Edit">
                      <Edit class="w-3.5 h-3.5" />
                    </button>
                    <button @click="hapusKonfig(k)" class="p-1.5 rounded-md text-slate-400 hover:bg-red-500/15 hover:text-red-400 transition" title="Hapus">
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
                        </tbody>
          </table>
        </div>

        <!-- KARTU KONFIG (KHUSUS HP) -->
        <div class="md:hidden divide-y divide-slate-800/60">
          <div v-if="isLoadingKonfig" class="p-8 text-center text-slate-500 text-sm">Memuat...</div>
          <div v-else-if="konfigPaged.length === 0" class="p-8 text-center">
            <div class="text-slate-500 text-sm mb-2">Belum ada konfigurasi</div>
            <button @click="bukaModalKonfig()" class="text-emerald-400 hover:text-emerald-300 underline text-xs">Buat konfigurasi pertama</button>
          </div>
          <div v-for="k in konfigPaged" :key="k.id" class="p-3.5 active:bg-slate-800/30 transition">
            <div class="flex items-start justify-between gap-2 mb-2">
              <div class="min-w-0">
                <h3 class="text-[13.5px] font-bold text-white font-mono truncate">{{ k.tahun_ajaran }}</h3>
                <div class="flex items-center gap-1.5 mt-1 text-[10px] flex-wrap">
                  <span class="inline-flex px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-semibold">Kelas {{ k.tingkat }}</span>
                  <span class="inline-flex px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-semibold">Smt {{ k.semester }}</span>
                  <span class="text-emerald-400 font-semibold">{{ k.mapel_count }} mapel</span>
                </div>
              </div>
            </div>
            <div class="flex items-center gap-1.5 mt-2.5">
              <button @click="bukaModalKonfig(k)" class="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-300 text-[11.5px] font-semibold active:scale-95 transition">
                <Edit class="w-3.5 h-3.5 text-amber-400" /> Edit
              </button>
              <button @click="hapusKonfig(k)" class="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-lg bg-slate-800/60 hover:bg-red-500/15 text-slate-300 hover:text-red-400 text-[11.5px] font-semibold active:scale-95 transition">
                <Trash2 class="w-3.5 h-3.5" /> Hapus
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- ═══════ TAB NILAI ═══════ -->
    <template v-if="activeTab === 'nilai'">
      <div class="rounded-2xl border border-slate-800 bg-slate-900/50 p-3">
        <div class="grid grid-cols-2 md:grid-cols-12 gap-2">
          <div class="col-span-2 md:col-span-5">
            <label class="block text-[10.5px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Pilih Konfigurasi</label>
            <CustomSelect v-model="selectedKonfigId" :options="konfigOptions" placeholder="— Pilih tahun / kelas / semester —" searchable />
          </div>
          <div class="col-span-2 md:col-span-3">
            <label class="block text-[10.5px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Cari Siswa</label>
            <div class="relative">
              <Search class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input v-model="searchSiswa" type="text" placeholder="Nama / no induk…"
                  class="w-full h-10 pl-10 pr-10 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white placeholder:text-slate-400 outline-none focus:border-emerald-500/60" />
              <button v-if="searchSiswa" @click="searchSiswa = ''" type="button"
                      class="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition">
                <X class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div class="col-span-2 md:col-span-4 flex items-end gap-2">
            <button @click="bukaImport" :disabled="!konfigAktif || mapelAktif.length === 0"
                    class="flex-1 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[12px] sm:text-[13px] font-semibold flex items-center justify-center gap-1 sm:gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition">
              <FileUp class="w-4 h-4 shrink-0" />
              <span>Import</span>
            </button>
            <button @click="bukaExport" :disabled="daftarKonfig.length === 0"
                    class="flex-1 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[12px] sm:text-[13px] font-semibold flex items-center justify-center gap-1 sm:gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition">
              <Download class="w-4 h-4 shrink-0" />
              <span>Export</span>
            </button>
          </div>
        </div>
      </div>

      <div v-if="!konfigAktif" class="rounded-2xl border border-slate-800 bg-slate-900/50 p-12 text-center">
        <div class="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
          <BookMarked class="w-8 h-8 text-emerald-400" />
        </div>
        <div class="text-slate-300 font-semibold mb-1">Belum ada konfigurasi terpilih</div>
        <div class="text-slate-500 text-xs">Pilih tahun ajaran, kelas, dan semester di atas untuk mulai input nilai</div>
      </div>

      <div v-else-if="isLoadingNilai" class="rounded-2xl border border-slate-800 bg-slate-900/50 p-16 text-center text-slate-500">
        Memuat nilai...
      </div>

      <div v-else class="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <!-- Toolbar -->
        <div class="px-4 py-3 border-b border-slate-800 bg-slate-950/40 space-y-2">
          <!-- Row 1: Info + Simpan -->
          <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div class="text-xs text-slate-400 flex flex-wrap gap-1.5">
              <b class="text-white">{{ konfigAktif.tahun_ajaran }}</b>
              <span class="text-slate-600">•</span>
              Kelas <b class="text-blue-400">{{ konfigAktif.tingkat }}</b>
              <span class="text-slate-600">•</span>
              Smt <b class="text-purple-400">{{ konfigAktif.semester }}</b>
              <span class="text-slate-600">•</span>
              <b class="text-emerald-400">{{ mapelAktif.length }}</b> mapel
              <span class="text-slate-600">•</span>
              <b class="text-slate-200">{{ siswaDenganRanking.length }}</b> siswa
            </div>
            <button @click="simpanSemua" :disabled="dirtyCount === 0 || isSaving"
                    class="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-lg text-[12px] font-bold transition w-full sm:w-auto shrink-0"
                    :class="dirtyCount > 0 ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white shadow-lg shadow-emerald-900/40' : 'bg-slate-800 text-slate-500 cursor-not-allowed'">
              <Save class="w-4 h-4" />
              {{ isSaving ? 'Menyimpan...' : dirtyCount > 0 ? `Simpan ${dirtyCount} Perubahan` : 'Tidak ada perubahan' }}
            </button>
          </div>
          <!-- Row 2: Pagination -->
          <div v-if="siswaDenganRanking.length > 0" class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5 pt-2 border-t border-slate-800/60">
            <div class="text-[11px] text-slate-500">
              Menampilkan <b class="text-slate-200">{{ siswaPaged.length }}</b> dari <b class="text-emerald-400">{{ siswaDenganRanking.length }}</b> siswa
            </div>
            <div class="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
              <div class="relative h-8 w-[92px] shrink-0">
                <CustomSelect v-model.number="siswaPageSize" :options="siswaPageSizeOptions" size="sm" />
              </div>
              <div class="flex items-center gap-1.5 ml-auto sm:ml-0">
                <button @click="siswaCurrentPage = Math.max(1, siswaCurrentPage - 1)" :disabled="siswaCurrentPage === 1"
                        class="h-8 px-3 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition">
                  Prev
                </button>
                <div class="h-8 px-3 flex items-center rounded-lg bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 whitespace-nowrap">
                  {{ siswaCurrentPage }} / {{ siswaTotalPages }}
                </div>
                <button @click="siswaCurrentPage = Math.min(siswaTotalPages, siswaCurrentPage + 1)" :disabled="siswaCurrentPage >= siswaTotalPages"
                        class="h-8 px-3 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition">
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>

        <div v-if="mapelAktif.length === 0" class="px-4 py-16 text-center text-slate-500 text-sm">
          Konfigurasi ini belum punya mapel. Edit konfigurasi dulu di tab Konfigurasi.
        </div>

        <div v-else-if="siswaDenganRanking.length === 0" class="px-4 py-16 text-center">
          <div class="text-slate-500 text-sm mb-1">Tidak ada siswa untuk konfigurasi ini</div>
          <div class="text-slate-600 text-xs">Pastikan siswa punya data <b>masuk</b> yang sesuai tahun ajaran</div>
        </div>

        <div v-else class="hidden md:block">
          <div class="overflow-x-auto" style="max-height: 70vh;">
          <table class="w-full text-xs" style="table-layout: fixed;">
            <colgroup>
            <col style="width: 44px;">
            <col style="width: 100px;">
            <col style="width: 180px;">
            <col v-for="m in mapelAktif" :key="m.id" style="width: 80px;">
            <col style="width: 80px;">
            <col style="width: 80px;">
            <col style="width: 70px;">
            </colgroup>
            <thead class="bg-slate-950 sticky top-0 z-20">
              <tr>
                <th class="px-2 py-3 text-center text-[10px] font-bold uppercase text-slate-500 bg-slate-950 sticky left-0 z-30">No</th>
                <th class="px-2 py-3 text-left text-[10px] font-bold uppercase text-slate-500 bg-slate-950 sticky left-[44px] z-30">No Induk</th>
                <th class="px-3 py-3 text-left text-[10px] font-bold uppercase text-slate-500 bg-slate-950 sticky left-[144px] z-30">Nama & Kelas</th>
                <th v-for="m in mapelAktif" :key="m.id" class="px-1 py-3 text-center text-[10px] font-bold uppercase text-slate-500" :title="m.nama">
                  <div class="truncate">{{ m.nama }}</div>
                </th>
                <th class="px-2 py-3 text-center text-[10px] font-bold uppercase text-emerald-400 bg-emerald-950/30">Jumlah</th>
                <th class="px-2 py-3 text-center text-[10px] font-bold uppercase text-emerald-400 bg-emerald-950/30">Rata</th>
                <th class="px-2 py-3 text-center text-[10px] font-bold uppercase text-amber-400 bg-amber-950/30">Rank</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/60">
              <tr v-for="(s, idx) in siswaPaged" :key="s.no_induk" class="hover:bg-slate-800/30">
  <td class="px-2 py-1.5 text-center text-slate-500 text-[11px] tabular-nums bg-slate-900 sticky left-0 z-10">{{ (siswaCurrentPage - 1) * siswaPageSize + idx + 1 }}</td>
                <td class="px-2 py-1.5 font-mono text-[11px] text-slate-300 bg-slate-900 sticky left-[44px] z-10">{{ s.no_induk }}</td>
                <td class="px-3 py-1.5 bg-slate-900 sticky left-[144px] z-10">
                  <div class="font-semibold text-white text-[12px] truncate">{{ s.nama }}</div>
                  <div class="text-[10px] text-slate-500 truncate">{{ s.kelas || '—' }}</div>
                </td>
                <td v-for="m in mapelAktif" :key="m.id" class="px-1 py-1 text-center">
                  <input :value="getNilai(s.no_induk, m.id)"
                      @change="e => onNilaiChange(s.no_induk, m.id, e.target.value)"
                      @keydown.enter="e => moveDown(e, s.no_induk, m.id)"
                      data-view="desktop"
                      :data-ni="s.no_induk" :data-mid="m.id"
                      type="text" inputmode="decimal" placeholder="—"
                      class="w-full h-7 px-1 bg-slate-950 border rounded text-[11px] text-center font-mono outline-none transition"
                      :class="isDirty(s.no_induk, m.id) ? 'border-amber-500/60 bg-amber-950/20 text-amber-200' : 'border-slate-800 text-white focus:border-emerald-500/60'" />
                </td>
                <td class="px-2 py-1.5 text-center font-mono font-bold text-emerald-400 text-[11px] bg-emerald-950/20">
                  {{ s._jumlah !== null ? s._jumlah.toFixed(2) : '—' }}
                </td>
                <td class="px-2 py-1.5 text-center font-mono font-bold text-emerald-400 text-[11px] bg-emerald-950/20">
                  {{ s._rata !== null ? s._rata.toFixed(2) : '—' }}
                </td>
                <td class="px-2 py-1.5 text-center font-mono font-bold text-[11px] bg-amber-950/20">
                  <span v-if="s._rank === 1" class="text-amber-300">🥇 {{ s._rank }}</span>
                  <span v-else-if="s._rank === 2" class="text-slate-300">🥈 {{ s._rank }}</span>
                  <span v-else-if="s._rank === 3" class="text-orange-300">🥉 {{ s._rank }}</span>
                  <span v-else-if="s._rank" class="text-slate-400">{{ s._rank }}</span>
                  <span v-else class="text-slate-600">—</span>
                </td>
              </tr>
            </tbody>
            </table>
          </div>
        </div>

        <!-- KARTU SISWA NILAI (KHUSUS HP) -->
        <div class="md:hidden divide-y divide-slate-800/60">
          <div v-for="(s, idx) in siswaPaged" :key="s.no_induk" class="p-3.5 space-y-2.5">
            <div class="flex items-start gap-2.5">
              <div class="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                {{ (s.nama || '?').charAt(0).toUpperCase() }}
              </div>
              <div class="flex-1 min-w-0">
                <h3 class="text-[13.5px] font-bold text-white truncate">{{ s.nama }}</h3>
                <div class="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-500 font-mono flex-wrap">
                  <span class="tabular-nums">{{ (siswaCurrentPage - 1) * siswaPageSize + idx + 1 }}.</span>
                  <span>{{ s.no_induk }}</span>
                  <span v-if="s.kelas" class="text-slate-600">•</span>
                  <span v-if="s.kelas" class="inline-flex px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">{{ s.kelas }}</span>
                </div>
              </div>
              <div class="text-right shrink-0">
                <div class="text-[9px] uppercase tracking-wider text-amber-400 font-bold">Rank</div>
                <div class="text-sm font-bold text-amber-400 font-mono leading-tight">
                  <span v-if="s._rank === 1">🥇</span>
                  <span v-else-if="s._rank === 2">🥈</span>
                  <span v-else-if="s._rank === 3">🥉</span>
                  <span v-else-if="s._rank">#{{ s._rank }}</span>
                  <span v-else class="text-slate-600">—</span>
                </div>
              </div>
            </div>
            <div class="space-y-1.5">
              <div v-for="m in mapelAktif" :key="m.id" class="flex items-center gap-2">
                <span class="flex-1 text-[11px] text-slate-400 truncate" :title="m.nama">{{ m.nama }}</span>
                <input :value="getNilai(s.no_induk, m.id)"
                       @change="e => onNilaiChange(s.no_induk, m.id, e.target.value)"
                       @keydown.enter="e => moveDown(e, s.no_induk, m.id)"
                       data-view="mobile"
                       :data-ni="s.no_induk" :data-mid="m.id"
                       type="text" inputmode="decimal" placeholder="—"
                       class="w-16 h-8 px-2 bg-slate-950 border rounded text-[12px] text-center font-mono outline-none transition shrink-0"
                       :class="isDirty(s.no_induk, m.id) ? 'border-amber-500/60 bg-amber-950/20 text-amber-200' : 'border-slate-800 text-white focus:border-emerald-500/60'" />
              </div>
            </div>
            <div class="flex items-center justify-between pt-2 border-t border-slate-800/60">
              <div class="text-[10.5px] text-slate-500">
                Jumlah: <b class="text-slate-200 font-mono">{{ s._jumlah !== null ? s._jumlah.toFixed(2) : '—' }}</b>
              </div>
              <div class="text-[10.5px] text-slate-500">
                Rata: <b class="text-emerald-400 font-mono">{{ s._rata !== null ? s._rata.toFixed(2) : '—' }}</b>
              </div>
            </div>
          </div>
        </div>

        <div v-if="siswaDenganRanking.length > 0" class="px-4 py-2.5 border-t border-slate-800 bg-slate-950/40 text-[11px] text-slate-500 flex items-center justify-between">
          <div>💡 Tekan <kbd class="px-1 rounded bg-slate-800 border border-slate-700 text-[10px]">Enter</kbd> untuk pindah ke baris bawah (kolom sama)</div>
          <div v-if="dirtyCount > 0" class="text-amber-400 font-semibold">{{ dirtyCount }} sel belum disimpan</div>
        </div>
      </div>
    </template>

    <!-- ═══════ MODAL KONFIG ═══════ -->
    <div v-if="konfigModalOpen" class="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div class="modal-standard bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-3xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden">
        <div class="px-5 sm:px-6 py-4 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <Settings class="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 class="text-base font-bold text-white">{{ isEditKonfig ? 'Edit Konfigurasi' : 'Konfigurasi Baru' }}</h3>
              <p class="text-[11px] text-slate-400 mt-0.5">Atur tahun ajaran, kelas, semester, dan daftar mapel</p>
            </div>
          </div>
          <button @click="konfigModalOpen = false" class="w-9 h-9 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition">
            <X class="w-4 h-4" />
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-5 space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
            <label class="block text-[11.5px] font-semibold text-slate-400 mb-1">Tahun Ajaran <span class="text-red-400">*</span></label>
            <input v-model="konfigForm.tahun_ajaran" type="text" placeholder="Contoh: 2026-2027" maxlength="9"
                    class="w-full h-10 px-3 bg-slate-950 border rounded-lg text-[13px] text-white font-mono placeholder-slate-500 outline-none focus:ring-2 focus:ring-emerald-500/10 transition"
                    :class="konfigTahunValid || !konfigForm.tahun_ajaran ? 'border-slate-800 focus:border-emerald-500/60' : 'border-red-500/60'" />
            <p class="text-[10px] mt-1" :class="konfigForm.tahun_ajaran && !konfigTahunValid ? 'text-red-400' : 'text-slate-500'">
                {{ konfigForm.tahun_ajaran && !konfigTahunValid ? 'Format salah. Gunakan: YYYY-YYYY' : 'Format: YYYY-YYYY' }}
            </p>
            </div>
            <div>
              <label class="block text-[11.5px] font-semibold text-slate-400 mb-1">Kelas <span class="text-red-400">*</span></label>
              <CustomSelect v-model="konfigForm.tingkat" :options="tingkatOptions" placeholder="Pilih kelas" />
            </div>
            <div>
              <label class="block text-[11.5px] font-semibold text-slate-400 mb-1">Semester <span class="text-red-400">*</span></label>
              <CustomSelect v-model="konfigForm.semester" :options="semesterOptions" placeholder="Pilih semester" />
            </div>
          </div>

          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="text-[11.5px] font-semibold text-slate-400">Daftar Mapel <span class="text-red-400">*</span></label>
              <button @click="tambahMapel" class="inline-flex items-center gap-1 px-2.5 h-7 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 text-[11px] font-semibold transition">
                <Plus class="w-3 h-3" /> Tambah
              </button>
            </div>
            <div class="space-y-1.5 max-h-[40vh] overflow-y-auto pr-1">
              <div v-for="(m, i) in konfigForm.mapel" :key="i" class="flex items-center gap-2">
                <span class="text-slate-500 text-[11px] w-6 text-right font-mono">{{ i + 1 }}.</span>
                <input v-model="konfigForm.mapel[i]" type="text" :placeholder="`Nama mapel ${i + 1}`"
                       class="flex-1 h-9 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white placeholder-slate-500 outline-none focus:border-emerald-500/60" />
                <button @click="hapusMapel(i)" class="p-1.5 rounded-md text-slate-400 hover:bg-red-500/15 hover:text-red-400 transition" title="Hapus">
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              </div>
              <div v-if="konfigForm.mapel.length === 0" class="text-center py-6 text-xs text-slate-500 italic">
                Belum ada mapel. Klik <b>Tambah</b> untuk mulai.
              </div>
            </div>
          </div>
        </div>

        <div class="px-5 sm:px-6 py-3 border-t border-slate-800 bg-slate-950 flex justify-end gap-2 shrink-0">
          <button @click="konfigModalOpen = false" class="h-10 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[13px] font-semibold transition">
            Batal
          </button>
          <button @click="simpanKonfig" :disabled="konfigSaving"
                  class="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white text-[13px] font-bold shadow-lg shadow-emerald-900/40 transition disabled:opacity-50">
            <Save class="w-4 h-4" />
            {{ konfigSaving ? 'Menyimpan...' : 'Simpan' }}
          </button>
        </div>
      </div>
    </div>

  </div>

  <!-- ═══════ EXPORT MODAL ═══════ -->
    <div v-if="exportModalOpen" class="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
    <div class="modal-standard bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden">
        <div class="px-5 sm:px-6 py-4 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
        <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center">
            <Download class="w-5 h-5 text-blue-400" />
            </div>
            <div>
            <h3 class="text-base font-bold text-white">Export Nilai Muadalah</h3>
            <p class="text-[11px] text-slate-400 mt-0.5">1 baris per siswa, semua mapel dalam kolom</p>
            </div>
        </div>
        <button @click="exportModalOpen = false" class="w-9 h-9 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition">
            <X class="w-4 h-4" />
        </button>
        </div>

        <div class="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
        <!-- Search siswa -->
        <div>
            <label class="block text-xs font-bold text-white mb-1.5">Cari Siswa (opsional)</label>
            <div class="relative">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input v-model="exportSearchSiswa" type="text" placeholder="Nama atau no induk..."
                    class="w-full h-10 pl-10 pr-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white placeholder-slate-500 outline-none focus:border-emerald-500" />
            </div>
        </div>

        <!-- Pilih config -->
        <div>
            <div class="flex items-center justify-between mb-2">
            <label class="text-xs font-bold text-white">Konfigurasi yang Diexport</label>
            <label class="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" :checked="exportAllConfigs" @change="e => toggleAllConfigs(e.target.checked)"
                    class="accent-emerald-500 w-3.5 h-3.5" />
                <span class="text-[11px] text-slate-300 font-semibold">Semua ({{ daftarKonfig.length }})</span>
            </label>
            </div>
            <div class="max-h-56 overflow-y-auto border border-slate-800 rounded-lg p-1.5 space-y-0.5">
            <label v-for="k in daftarKonfig" :key="k.id"
                    class="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-800/60 cursor-pointer transition">
                <input type="checkbox" :checked="exportSelectedConfigs.includes(k.id)"
                    @change="toggleConfig(k.id)"
                    class="accent-emerald-500 w-3.5 h-3.5 shrink-0" />
                <span class="text-[11.5px] text-white font-mono">{{ k.tahun_ajaran }}</span>
                <span class="text-[11.5px] text-blue-300">{{ k.tingkat }}</span>
                <span class="text-[11.5px] text-purple-300">Smt {{ k.semester }}</span>
                <span class="text-[10px] text-slate-500">({{ k.mapel_count || 0 }} mapel)</span>
            </label>
            <div v-if="daftarKonfig.length === 0" class="text-center text-[11px] text-slate-500 py-4">
                Belum ada konfigurasi
            </div>
            </div>
        </div>

        <!-- Info -->
        <div class="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 text-[11px] text-blue-200 leading-relaxed space-y-1.5">
        <div><b>Struktur File: 7 Sheet</b></div>
        <div>• <b>Konfigurasi</b> — daftar config + mapel 1–30 per tahun/kelas/semester</div>
        <div>• <b>X I, X II, XI I, XI II, XII I, XII II</b> — semua siswa untuk kelas/semester itu, lintas tahun</div>
        <div class="text-blue-300/70 pt-1">Header per sheet: <code>No Induk | Nama | Kelas | Tahun Pelajaran | N 1..N 30 | Jumlah | Rata-rata | Ranking</code></div>
        </div>

        <div class="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 flex items-center justify-between">
            <div class="text-xs text-slate-300">
            <b class="text-emerald-400 text-base">{{ exportSelectedConfigs.length }}</b> config dipilih
            </div>
            <button @click="toggleAllConfigs(true); exportSearchSiswa = ''"
                    class="text-[11px] text-slate-400 hover:text-white underline">
            Reset
            </button>
        </div>
        </div>

        <div class="px-5 sm:px-6 py-3 border-t border-slate-800 bg-slate-950 flex justify-end gap-2 shrink-0">
        <button @click="exportModalOpen = false"
                class="h-10 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[13px] font-semibold transition">
            Batal
        </button>
        <button @click="doExport" :disabled="exportLoading || exportSelectedConfigs.length === 0"
                class="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white text-[13px] font-bold shadow-lg shadow-emerald-900/40 transition disabled:opacity-50">
            <Download class="w-4 h-4" />
            {{ exportLoading ? 'Menyiapkan...' : `Download` }}
        </button>
        </div>
    </div>
    </div>

    <!-- ═══════ IMPORT MODAL ═══════ -->
    <div v-if="importOpen" class="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
    <div class="modal-standard bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-5xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden">
        <div class="px-5 sm:px-6 py-4 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
        <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <FileUp class="w-5 h-5 text-emerald-400" />
            </div>
            <div>
            <h3 class="text-base font-bold text-white">Import Nilai Muadalah</h3>
            <p class="text-[11px] text-slate-400 mt-0.5">Langkah {{ importStep }} dari 3</p>
            </div>
        </div>
        <button @click="tutupImport" class="w-9 h-9 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition">
            <X class="w-4 h-4" />
        </button>
        </div>

        <div class="flex-1 overflow-y-auto p-5 space-y-4 text-xs">

        <!-- STEP 1: Upload -->
        <div v-if="importStep === 1" class="space-y-4">
            <div class="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-1">
            <div class="font-bold text-emerald-300">Config terpilih:</div>
            <div class="text-slate-200">
                <b>{{ konfigAktif?.tahun_ajaran }}</b> • Kelas <b>{{ konfigAktif?.tingkat }}</b> • Smt <b>{{ konfigAktif?.semester }}</b>
            </div>
            <div class="text-slate-400 text-[11px]">{{ mapelAktif.length }} mapel: {{ mapelAktif.slice(0, 5).map(m => m.nama).join(', ') }}{{ mapelAktif.length > 5 ? ', ...' : '' }}</div>
            </div>

            <div v-if="isConfigPlaceholder" class="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[11.5px] text-amber-200 flex items-start gap-2">
            <AlertCircle class="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <div><b>Config ini pakai mapel placeholder.</b> Header file akan diabaikan kecuali pakai <code class="text-emerald-300">N1</code>. Edit config dulu via tab Konfigurasi untuk menambah mapel asli.</div>
            </div>

            <div class="p-12 flex flex-col items-center text-center space-y-4 border-2 border-dashed border-slate-700 rounded-2xl">
            <div class="w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-dashed border-emerald-500/30 flex items-center justify-center">
                <FileUp class="w-8 h-8 text-emerald-400" />
            </div>
            <div>
                <h4 class="text-base font-bold text-white mb-1">Pilih File Excel</h4>
                <p class="text-[13px] text-slate-400">Format: <code>No Induk | Nama | Mapel 1 | Mapel 2 | ...</code> atau <code>No Induk | Nama | N1 | N2 | ...</code></p>
            </div>
            <label class="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold text-[13px] cursor-pointer shadow-lg transition">
                <FileUp class="w-4 h-4" /> Pilih File
                <input type="file" accept=".xlsx,.xls,.csv" @change="importHandleFile" class="hidden" />
            </label>
            </div>
        </div>

        <!-- STEP 2: Mapping -->
        <div v-if="importStep === 2" class="space-y-3">
            <div class="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <div class="font-bold text-emerald-300 mb-1">Petakan kolom</div>
            <p class="text-slate-300">File: <b>{{ importFileName }}</b> • {{ importRows.length }} baris • {{ importHeaders.length }} kolom</p>
            </div>

            <div v-if="importUnmapped.length > 0" class="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[11.5px] text-amber-200 flex items-start gap-2">
            <AlertCircle class="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <div><b>{{ importUnmapped.length }} kolom tidak match mapel config:</b> {{ importUnmapped.slice(0, 8).join(', ') }}{{ importUnmapped.length > 8 ? ', ...' : '' }}. Kolom ini akan diabaikan.</div>
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
                    <td class="px-3 py-2 text-slate-200 truncate max-w-[200px]">{{ h }}</td>
                    <td class="px-3 py-2">
                    <select v-model="importMapping[i]" class="w-full bg-slate-950 border border-slate-700 rounded-md px-2 py-1.5 text-xs text-white outline-none focus:border-emerald-500 cursor-pointer">
                        <option value="">— Abaikan —</option>
                        <option value="@no_induk">IDENTITAS · No Induk</option>
                        <option value="@nama">IDENTITAS · Nama</option>
                        <option value="@kelas">IDENTITAS · Kelas</option>
                        <option value="@tahun">IDENTITAS · Tahun</option>
                        <option value="@skip">— Skip (Jumlah/Rata/Rank) —</option>
                        <optgroup label="Nilai Mapel">
                        <option v-for="mp in mapelAktif" :key="mp.id" :value="mp.id">{{ mp.urutan }}. {{ mp.nama }}</option>
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
            <button @click="importRunPreview" :disabled="!canPreviewImport() || importLoading"
                    class="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white text-[13px] font-bold shadow-lg shadow-emerald-900/40 transition disabled:opacity-50">
                {{ importLoading ? 'Memeriksa...' : 'Preview & Periksa' }}
            </button>
            </div>
        </div>

        <!-- STEP 3: Preview -->
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
            <table class="w-full text-xs min-w-[700px]">
                <thead class="bg-slate-800 text-slate-300 sticky top-0 z-10">
                <tr>
                    <th class="px-3 py-2 w-10">✓</th>
                    <th class="px-3 py-2">Baris</th>
                    <th class="px-3 py-2">No Induk</th>
                    <th class="px-3 py-2">Nama</th>
                    <th class="px-3 py-2">Nilai</th>
                    <th class="px-3 py-2">Status</th>
                    <th class="px-3 py-2">Keterangan</th>
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
                    <td class="px-3 py-2 text-white truncate">{{ it.nama }}</td>
                    <td class="px-3 py-2 text-center font-mono text-emerald-300">{{ it.validCount }}</td>
                    <td class="px-3 py-2">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold"
                            :class="{
                            'bg-emerald-500/20 text-emerald-300': it.status === 'cocok',
                            'bg-red-500/20 text-red-300': it.status === 'tidak_ditemukan' || it.status === 'duplikat_file',
                            'bg-amber-500/20 text-amber-300': it.status === 'nama_tidak_cocok',
                            'bg-slate-700 text-slate-300': it.status === 'tidak_lengkap' || it.status === 'tidak_ada_nilai'
                            }">{{ it.status }}</span>
                    </td>
                    <td class="px-3 py-2 text-slate-400 truncate max-w-[200px]">{{ it.message }}</td>
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
  </div>
</template>
