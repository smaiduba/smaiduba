<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '../lib/supabase'
import { userSesi } from '../stores/auth'
import { ensureXLSX, writeXlsx } from '../lib/xlsx-lazy'
import { useDebounced } from '../lib/debounce'
import { useExportFilter } from '../composables/useExportFilter'
import { confirm } from '../lib/confirm'
import CustomSelect from '../components/CustomSelect.vue'
import {
  Plus, Download, FileUp, Search, Edit, Trash2, X, Save, Users, CheckCircle2,
  AlertCircle, School, Calendar, ShieldCheck, Eye, Phone, MapPin, User, Award
} from 'lucide-vue-next'
import { parseTahunRange, normalizeTahun, getTahunPerTingkatLengkap } from '../lib/tahun'

const route = useRoute()
const router = useRouter()

// ─── STATE ───
const daftarSiswa = ref([])
const isLoading = ref(false)
const pencarian = ref('')
const pencarianDebounced = useDebounced(pencarian, 200)
const filterKelas = ref('')
const filterStatus = ref('')
const filterAngkatan = ref('')
const pageSize = ref(25)
const currentPage = ref(1)
const kelasOptions = ref([])
const statusOptions = ref([])
const angkatanOptions = ref([])
const kelasEditable = computed(() => !isEditMode.value)

// SPMB / Edit
const isModalOpen = ref(false)
const isEditMode = ref(false)
const tabAktif = ref('identitas')
const editId = ref(null)

// Detail
const detailOpen = ref(false)
const detailSiswa = ref(null)

// Edit Tahun per Tingkat
const editTahunOpen = ref(false)
const editTahunSiswa = ref(null)
const editTahunForm = ref({ X: '', XI: '', XII: '' })
const editTahunAuto = ref({ X: '', XI: '', XII: '' })
const editTahunPreview = ref({ X: false, XI: false, XII: false })
const editTahunSaving = ref(false)

// ═══════════════════════════════════════════════
// EDIT TAHUN MASUK
// ═══════════════════════════════════════════════
async function bukaEditTahun(s) {
  editTahunSiswa.value = s
  const lengkap = getTahunPerTingkatLengkap(s)
  editTahunAuto.value = { ...lengkap }
  editTahunForm.value = { ...lengkap }   // prefill semua, user bisa ubah
  editTahunOpen.value = true
  await refreshTahunPreview()
}

async function refreshTahunPreview() {
  const configs = []
  for (const t of ['X', 'XI', 'XII']) {
    const tahun = normalizeTahun(editTahunForm.value[t] || editTahunAuto.value[t])
    if (!tahun) continue
    const p = parseTahunRange(tahun)
    if (!p) continue
    // Convert "2021/2022" → "2021-2022" (format DB)
    configs.push({ tingkat: t, tahun_db: `${p[0]}-${p[1]}` })
  }
  if (configs.length === 0) { editTahunPreview.value = { X: false, XI: false, XII: false }; return }

  const { data } = await supabase.from('muadalah_konfig').select('tahun_ajaran, tingkat')
  const existing = new Set((data || []).map(k => `${k.tahun_ajaran}|${k.tingkat}`))
  const result = { X: false, XI: false, XII: false }
  configs.forEach(c => {
    result[c.tingkat] = existing.has(`${c.tahun_db}|${c.tingkat}`)
  })
  editTahunPreview.value = result
}

let tahunTimer = null
watch(editTahunForm, () => { 
  if (!editTahunOpen.value) return
  clearTimeout(tahunTimer)
  tahunTimer = setTimeout(() => {
    refreshTahunPreview()
  }, 500) // Tunggu 500ms setelah user berhenti mengetik
}, { deep: true })

function tutupEditTahun() {
  editTahunOpen.value = false
  editTahunSiswa.value = null
  editTahunForm.value = { X: '', XI: '', XII: '' }
  editTahunAuto.value = { X: '', XI: '', XII: '' }
  editTahunPreview.value = { X: false, XI: false, XII: false }
}

async function simpanEditTahun() {
  if (!editTahunSiswa.value) return
  editTahunSaving.value = true
  try {
    const newDetail = { ...(editTahunSiswa.value.detail_data || {}) }
    const tpt = {}
    for (const t of ['X', 'XI', 'XII']) {
      const val = normalizeTahun(editTahunForm.value[t])
      // Simpan hanya kalau beda dari auto (derived dari masuk)
      if (val && val !== editTahunAuto.value[t]) {
        tpt[t] = val
      }
    }
    if (Object.keys(tpt).length > 0) newDetail.tahun_per_tingkat = tpt
    else delete newDetail.tahun_per_tingkat

    const { error } = await supabase.from('siswa')
      .update({ detail_data: newDetail })
      .eq('id', editTahunSiswa.value.id)
    if (error) throw error

    const idx = daftarSiswa.value.findIndex(x => x.id === editTahunSiswa.value.id)
    if (idx >= 0) daftarSiswa.value[idx] = { ...daftarSiswa.value[idx], detail_data: newDetail }

    tutupEditTahun()
  } catch (err) {
    alert('Gagal simpan: ' + err.message)
  } finally {
    editTahunSaving.value = false
  }
}

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

// ─── OPTIONS UNTUK CUSTOMSELECT ───
const filterKelasOptions = computed(() => [
  { label: 'Semua Kelas', value: '' },
  ...kelasOptions.value.map(k => ({ label: k, value: k }))
])
const filterAngkatanOptions = computed(() => [
  { label: 'Semua Angkatan', value: '' },
  ...angkatanOptions.value.map(a => ({ label: a, value: a }))
])
const filterStatusOptions = computed(() => [
  { label: 'Semua Status', value: '' },
  ...statusOptions.value.map(s => ({ label: s, value: s }))
])
const pageSizeOptions = [
  { label: '10 / hal', value: 10 },
  { label: '25 / hal', value: 25 },
  { label: '50 / hal', value: 50 },
  { label: '100 / hal', value: 100 }
]

// ─── EXPORT ITEMS ───
const exportItems = computed(() =>
  daftarSiswa.value.map(s => ({
    no_induk: s.no_induk,
    nama: s.nama || '',
    kelas: s.kelas || '',
    angkatan: (String(s.detail_data?.masuk || '').match(/\d{4}/) || [])[0] || '',
    status: s.status || 'Aktif',
    raw: s
  }))
)

const ef = useExportFilter({
  daftarItems: exportItems,
  kelasOptions,
  angkatanOptions,
  statusOptions
})

const {
  filterKelas: exportKelas,
  filterAngkatan: exportAngkatan,
  filterStatus: exportStatus,
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
  toggleStatus: exportToggleStatus,
  toggleSiswa: exportToggleSiswa,
  pilihSemua: exportPilihSemuaSiswa,
  resetAll: exportResetAll
} = ef

// ─── TARGET FIELDS (IMPORT) ───
const targetFields = [
  { key: 'no_induk', label: 'No Induk (Wajib)', aliases: ['no induk','no_induk','nomor induk','nis'] },
  { key: 'nama', label: 'Nama Lengkap (Wajib)', aliases: ['nama','nama lengkap','nama siswa','nama santri'] },
  { key: 'nisn', label: 'NISN', aliases: ['nisn'] },
  { key: 'kelas', label: 'Kelas', aliases: ['kelas','rombel'] },
  { key: 'status', label: 'Status', aliases: ['status','status siswa'] },
  { key: 'kelamin', label: 'Jenis Kelamin', aliases: ['jk','kelamin','jenis kelamin'] },
  { key: 'tetala', label: 'Tempat, Tgl Lahir', aliases: ['ttl','tetala','tempat tanggal lahir'] },
  { key: 'nik', label: 'NIK', aliases: ['nik'] },
  { key: 'kk', label: 'No. KK', aliases: ['kk','no kk','nomor kk'] },
  { key: 'alamat', label: 'Alamat Lengkap', aliases: ['alamat','alamat lengkap'] },
  { key: 'alamat_singkat', label: 'Alamat Singkat', aliases: ['alamat singkat','desa'] },
  { key: 'agama', label: 'Agama', aliases: ['agama'] },
  { key: 'anak_ke', label: 'Anak Ke-', aliases: ['anak ke','anak ke-'] },
  { key: 'sd', label: 'SD/MI Asal', aliases: ['sd','sd asal','mi'] },
  { key: 'mts', label: 'SMP/MTs Asal', aliases: ['mts','smp','smp asal'] },
  { key: 'alamat_mts', label: 'Alamat SMP/MTs', aliases: ['alamat mts','alamat smp'] },
  { key: 'npsn', label: 'NPSN', aliases: ['npsn'] },
  { key: 'mutasi', label: 'Asal Sekolah Mutasi', aliases: ['mutasi'] },
  { key: 'alamat_mutasi', label: 'Alamat Mutasi', aliases: ['alamat mutasi'] },
  { key: 'ayah', label: 'Nama Ayah', aliases: ['ayah','nama ayah','bapak'] },
  { key: 'tetala_ayah', label: 'TTL Ayah', aliases: ['ttl ayah','tetala ayah'] },
  { key: 'sekolah_ayah', label: 'Pendidikan Ayah', aliases: ['pendidikan ayah','sekolah ayah'] },
  { key: 'pekerjaanayah', label: 'Pekerjaan Ayah', aliases: ['pekerjaan ayah','pekerjaanayah'] },
  { key: 'ibu', label: 'Nama Ibu', aliases: ['ibu','nama ibu'] },
  { key: 'tetala_ibu', label: 'TTL Ibu', aliases: ['ttl ibu','tetala ibu'] },
  { key: 'sekolah_ibu', label: 'Pendidikan Ibu', aliases: ['pendidikan ibu','sekolah ibu'] },
  { key: 'no_telp', label: 'No. HP/WA', aliases: ['no hp','no_telp','no telepon','wa','whatsapp','notlp'] },
  { key: 'masuk', label: 'Tahun Masuk', aliases: ['masuk','tahun masuk'] },
  { key: 'keluar', label: 'Tahun Keluar', aliases: ['keluar','tahun keluar'] },
  { key: 'lanjut_s1', label: 'Lanjut S1', aliases: ['lanjut s1','kampus s1'] },
  { key: 'prodi_s1', label: 'Prodi S1', aliases: ['prodi s1','jurusan s1'] },
  { key: 'lanjut_s2', label: 'Lanjut S2', aliases: ['lanjut s2','kampus s2'] },
  { key: 'prodi_s2', label: 'Prodi S2', aliases: ['prodi s2','jurusan s2'] },
  { key: 'lanjut_s3', label: 'Lanjut S3', aliases: ['lanjut s3','kampus s3'] },
  { key: 'prodi_s3', label: 'Prodi S3', aliases: ['prodi s3','jurusan s3'] },
  { key: 'profesi1', label: 'Profesi 1', aliases: ['profesi 1','profesi1'] },
  { key: 'tahun_profesi1', label: 'Tahun Profesi 1', aliases: ['tahun profesi 1','tahun_profesi1'] },
  { key: 'profesi2', label: 'Profesi 2', aliases: ['profesi 2','profesi2'] },
  { key: 'tahun_profesi2', label: 'Tahun Profesi 2', aliases: ['tahun profesi 2','tahun_profesi2'] },
  { key: 'profesi3', label: 'Profesi 3', aliases: ['profesi 3','profesi3'] },
  { key: 'tahun_profesi3', label: 'Tahun Profesi 3', aliases: ['tahun profesi 3','tahun_profesi3'] },
  { key: 'profesi4', label: 'Profesi 4', aliases: ['profesi 4','profesi4'] },
  { key: 'tahun_profesi4', label: 'Tahun Profesi 4', aliases: ['tahun profesi 4','tahun_profesi4'] },
  { key: 'profesi5', label: 'Profesi 5', aliases: ['profesi 5','profesi5'] },
  { key: 'tahun_profesi5', label: 'Tahun Profesi 5', aliases: ['tahun profesi 5','tahun_profesi5'] },
  { key: 'prestasi_kab', label: 'Prestasi Kabupaten', aliases: ['prestasi kab','prestasi kabupaten'] },
  { key: 'prestasi_prov', label: 'Prestasi Provinsi', aliases: ['prestasi prov','prestasi provinsi'] },
  { key: 'prestasi_nas', label: 'Prestasi Nasional', aliases: ['prestasi nas','prestasi nasional'] },
  { key: 'no_ijazah', label: 'No. Ijazah', aliases: ['no ijazah','nomor ijazah'] },
  { key: 'tgl_kelulusan', label: 'Tgl Kelulusan', aliases: ['tgl kelulusan','tanggal lulus'] },
  { key: 'foto', label: 'URL Foto', aliases: ['foto','url foto'] }
]

const emptyForm = () => ({
  no_induk: '', nisn: '', nik: '', kk: '', nama: '', kelamin: 'Laki-laki',
  tetala: '', agama: 'Islam', anak_ke: '', alamat_singkat: '', alamat: '',
  sd: '', mts: '', alamat_mts: '', npsn: '',
  ayah: '', tetala_ayah: '', sekolah_ayah: '', pekerjaanayah: '',
  ibu: '', tetala_ibu: '', sekolah_ibu: '', no_telp: '',
  masuk: new Date().getFullYear().toString(), keluar: '', status: 'Aktif',
  mutasi: '', alamat_mutasi: '', prestasi_kab: '', prestasi_prov: '', prestasi_nas: '',
  no_ijazah: '', tgl_kelulusan: '', foto: '', kelas: 'SPMB',
  lanjut_s1: '', prodi_s1: '', lanjut_s2: '', prodi_s2: '', lanjut_s3: '', prodi_s3: '',
  profesi1: '', tahun_profesi1: '', profesi2: '', tahun_profesi2: '',
  profesi3: '', tahun_profesi3: '', profesi4: '', tahun_profesi4: '',
  profesi5: '', tahun_profesi5: ''
})

const form = ref(emptyForm())

// ─── EXPORT COLUMNS ───
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

// ─── COMPUTED ───
const siswaTerfilter = computed(() => {
  const kw = pencarianDebounced.value.toLowerCase().trim()
  return daftarSiswa.value.filter(s => {
    if (kw) {
      const m = (s.nama || '').toLowerCase().includes(kw) ||
                (s.no_induk || '').toLowerCase().includes(kw) ||
                (s.nisn || '').toLowerCase().includes(kw)
      if (!m) return false
    }
    if (filterKelas.value) {
      const k = s.kelas || ''
      if (!k || (k !== filterKelas.value && !k.startsWith(filterKelas.value + '-') && !k.startsWith(filterKelas.value + ' '))) return false
    }
    if (filterStatus.value && s.status !== filterStatus.value) return false
    if (filterAngkatan.value) {
      const m = String(s.detail_data?.masuk || '').match(/\d{4}/)
      if (!m || m[0] !== filterAngkatan.value) return false
    }
    return true
  })
})

const totalHalaman = computed(() => Math.max(1, Math.ceil(siswaTerfilter.value.length / pageSize.value)))
const siswaTampil = computed(() => {
  const m = (currentPage.value - 1) * pageSize.value
  return siswaTerfilter.value.slice(m, m + pageSize.value)
})

const stats = computed(() => {
  const total = daftarSiswa.value.length
  const aktif = daftarSiswa.value.filter(s => (s.status || '').toLowerCase() === 'aktif').length
  const lulus = daftarSiswa.value.filter(s => (s.status || '').toLowerCase() === 'lulus').length
  const tanpaKelas = daftarSiswa.value.filter(s => !s.kelas).length
  return { total, aktif, lulus, tanpaKelas }
})

// ─── WATCHERS ───
watch([pencarianDebounced, filterKelas, filterStatus, filterAngkatan, pageSize], () => { currentPage.value = 1 })
watch(totalHalaman, () => { if (currentPage.value > totalHalaman.value) currentPage.value = 1 })

// ─── HELPERS ───
function getStatusBadge(status) {
  if (!status) return 'bg-slate-500/20 text-slate-400'
  const s = status.toLowerCase()
  if (s === 'aktif') return 'bg-emerald-500/20 text-emerald-300'
  if (s === 'lulus') return 'bg-blue-500/20 text-blue-300'
  if (s.includes('berhenti') || s.includes('keluar')) return 'bg-red-500/20 text-red-300'
  if (s === 'mutasi') return 'bg-amber-500/20 text-amber-300'
  return 'bg-slate-500/20 text-slate-300'
}

function getKeteranganBadge(ket) {
  if (!ket) return { cls: 'bg-slate-500/15 text-slate-400', label: '—' }
  const k = String(ket).toLowerCase()
  if (k === 'lengkap') return { cls: 'bg-emerald-500/20 text-emerald-300', label: 'Lengkap' }
  if (k.includes('tidak')) return { cls: 'bg-amber-500/20 text-amber-300', label: 'Tidak Lengkap' }
  return { cls: 'bg-slate-500/15 text-slate-400', label: ket }
}

function rebuildFilterOptions() {
  const kSet = new Set(), sSet = new Set(), aSet = new Set()
  daftarSiswa.value.forEach(s => {
    if (s.kelas) kSet.add(s.kelas)
    if (s.status) sSet.add(s.status)
    const m = String(s.detail_data?.masuk || '').match(/\d{4}/)
    if (m) aSet.add(m[0])
  })
  kelasOptions.value = Array.from(kSet).sort()
  statusOptions.value = Array.from(sSet).sort()
  angkatanOptions.value = Array.from(aSet).sort().reverse()
}

// ─── LOAD ───
async function ambilData() {
  isLoading.value = true
  const { data, error } = await supabase.from('siswa').select('*').order('nama', { ascending: true })
  if (error) {
    alert('Gagal memuat: ' + error.message)
    isLoading.value = false
    return
  }
  daftarSiswa.value = (data || []).filter(s => {
    const st = String(s.status || '').toLowerCase()
    const ni = String(s.no_induk || '').toLowerCase()
    return !st.includes('angkatan') && !ni.includes('angkatan')
  })
  rebuildFilterOptions()
  isLoading.value = false
}

// ─── DETAIL ───
function bukaDetail(s) {
  detailSiswa.value = s
  detailOpen.value = true
}
function tutupDetail() {
  detailOpen.value = false
  detailSiswa.value = null
}

// ─── SPMB / EDIT ───
function bukaModal(siswa = null) {
  if (siswa) {
    isEditMode.value = true
    editId.value = siswa.id
    const d = siswa.detail_data || {}
    form.value = {
      no_induk: siswa.no_induk || '', nisn: siswa.nisn || '', nik: siswa.nik || '',
      kk: siswa.no_kk || '', nama: siswa.nama || '',
      kelamin: siswa.kelamin || 'Laki-laki',
      tetala: d.tetala || '', agama: siswa.agama || 'Islam', anak_ke: d.anak_ke || siswa.anak_ke || '',
      alamat_singkat: d.alamat_singkat || '', alamat: siswa.alamat || '',
      sd: d.sd || siswa.asal_sekolah || '', mts: d.mts || '', alamat_mts: d.alamat_mts || '', npsn: d.npsn || '',
      ayah: d.ayah || siswa.nama_ayah || '', tetala_ayah: d.tetala_ayah || '',
      sekolah_ayah: d.sekolah_ayah || '', pekerjaanayah: d.pekerjaanayah || siswa.ayah_pekerjaan || '',
      ibu: d.ibu || siswa.nama_ibu || '', tetala_ibu: d.tetala_ibu || '', sekolah_ibu: d.sekolah_ibu || '',
      no_telp: siswa.no_telp || d.no_telp || '',
      masuk: d.masuk || '', keluar: d.keluar || '', status: siswa.status || 'Aktif',
      mutasi: d.mutasi || '', alamat_mutasi: d.alamat_mutasi || '',
      prestasi_kab: d.prestasi_kab || '', prestasi_prov: d.prestasi_prov || '', prestasi_nas: d.prestasi_nas || '',
      no_ijazah: d.no_ijazah || '', tgl_kelulusan: d.tgl_kelulusan || '',
      lanjut_s1: d.lanjut_s1 || '', prodi_s1: d.prodi_s1 || '',
      lanjut_s2: d.lanjut_s2 || '', prodi_s2: d.prodi_s2 || '',
      lanjut_s3: d.lanjut_s3 || '', prodi_s3: d.prodi_s3 || '',
      profesi1: d.profesi1 || '', tahun_profesi1: d.tahun_profesi1 || '',
      profesi2: d.profesi2 || '', tahun_profesi2: d.tahun_profesi2 || '',
      profesi3: d.profesi3 || '', tahun_profesi3: d.tahun_profesi3 || '',
      profesi4: d.profesi4 || '', tahun_profesi4: d.tahun_profesi4 || '',
      profesi5: d.profesi5 || '', tahun_profesi5: d.tahun_profesi5 || '',
      foto: d.foto || '', kelas: siswa.kelas || ''
    }
  } else {
    isEditMode.value = false
    editId.value = null
    form.value = emptyForm()
  }
  tabAktif.value = 'identitas'
  isModalOpen.value = true
}

async function simpanSiswa() {
  if (!form.value.no_induk || !form.value.nama) return alert('No Induk dan Nama wajib diisi!')
  isLoading.value = true

  const core = {
    no_induk: form.value.no_induk,
    nama: form.value.nama,
    nisn: form.value.nisn,
    kelas: form.value.kelas,
    status: form.value.status,
    kelamin: form.value.kelamin,
    jenis_kelamin: form.value.kelamin === 'Laki-laki' ? 'L' : 'P',
    alamat: form.value.alamat,
    nama_ayah: form.value.ayah,
    nama_ibu: form.value.ibu,
    no_telp: form.value.no_telp,
    nik: form.value.nik,
    no_kk: form.value.kk,
    agama: form.value.agama,
    anak_ke: form.value.anak_ke,
    asal_sekolah: form.value.sd,
    ayah_pekerjaan: form.value.pekerjaanayah
  }

  const detail = { ...form.value }
  Object.keys(core).forEach(k => delete detail[k])
  delete detail.id; delete detail.created_at
  delete detail.jenis_kelamin
  delete detail.detail_data
  delete detail.keterangan

  core.detail_data = detail

  let error, savedRow
  if (isEditMode.value) {
    const res = await supabase.from('siswa').update(core).eq('id', editId.value).select().single()
    error = res.error; savedRow = res.data
    if (!error && savedRow) {
      const idx = daftarSiswa.value.findIndex(s => s.id === editId.value)
      if (idx >= 0) daftarSiswa.value[idx] = savedRow
      else daftarSiswa.value.push(savedRow)
    }
  } else {
    const res = await supabase.from('siswa').insert([core]).select().single()
    error = res.error; savedRow = res.data
    if (!error && savedRow) daftarSiswa.value.push(savedRow)
  }

  if (error) {
    alert('Gagal menyimpan: ' + error.message)
  } else {
    daftarSiswa.value.sort((a, b) => (a.nama || '').localeCompare(b.nama || ''))
    rebuildFilterOptions()
    isModalOpen.value = false
  }
  isLoading.value = false
}

async function hapusSiswa(id, nama) {
  const ok = await confirm({
    title: 'Hapus Siswa',
    message: `Yakin ingin menghapus "${nama}"?\n\nNilai akademik siswa ini juga akan ikut terhapus dan tidak bisa dikembalikan.`,
    variant: 'danger',
    confirmText: 'Ya, Hapus'
  })
  if (!ok) return
  isLoading.value = true
  const { error } = await supabase.from('siswa').delete().eq('id', id)
  if (error) alert('Gagal hapus: ' + error.message)
  else {
    daftarSiswa.value = daftarSiswa.value.filter(s => s.id !== id)
    rebuildFilterOptions()
  }
  isLoading.value = false
}

// ─── IMPORT ───
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
  if (!mappedValues.includes('no_induk') || !mappedValues.includes('nama')) {
    return alert("Kolom 'No Induk' dan 'Nama Lengkap' wajib dipetakan!")
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

    const core = {
      no_induk: getVal('no_induk'),
      nama: getVal('nama'),
      nisn: getVal('nisn'),
      kelas: getVal('kelas'),
      status: getVal('status') || 'Aktif',
      kelamin: getVal('kelamin') || 'Laki-laki',
      jenis_kelamin: getVal('kelamin').toLowerCase().startsWith('p') ? 'P' : 'L',
      alamat: getVal('alamat'),
      nama_ayah: getVal('ayah'),
      nama_ibu: getVal('ibu'),
      no_telp: getVal('no_telp'),
      detail_data: {}
    }

    if (!core.no_induk || !core.nama) { tidakLengkap++; continue }

    targetFields.forEach(f => {
      if (!['no_induk','nama','nisn','kelas','status','kelamin','alamat','ayah','ibu','no_telp'].includes(f.key)) {
        core.detail_data[f.key] = getVal(f.key)
      }
    })
    payload.push(core)
  }

  const uniqueMap = new Map()
  payload.forEach(p => uniqueMap.set(p.no_induk, p))
  const uniquePayload = Array.from(uniqueMap.values())
  const dup = payload.length - uniquePayload.length

    // --- TAMBAHAN BARU: Ambil data lama untuk mencegah Data Loss ---
  const existingMap = {}
  if (uniquePayload.length > 0) {
    const noIndukList = uniquePayload.map(p => p.no_induk)
    const { data: existing } = await supabase.from('siswa')
      .select('no_induk, detail_data')
      .in('no_induk', noIndukList)
      
    if (existing) {
      existing.forEach(e => {
        existingMap[e.no_induk] = e.detail_data || {}
      })
    }
  }
  
  // Gabungkan detail_data lama dengan yang baru dari Excel
  uniquePayload.forEach(p => {
    p.detail_data = { ...(existingMap[p.no_induk] || {}), ...p.detail_data }
  })
  // ---------------------------------------------------------------

  const BATCH = 200
  let sukses = 0, gagal = tidakLengkap + dup
  const errorLogs = []

  for (let i = 0; i < uniquePayload.length; i += BATCH) {
    const batch = uniquePayload.slice(i, i + BATCH)
    try {
      const { error } = await supabase.from('siswa').upsert(batch, { onConflict: 'no_induk' })
      if (error) {
        for (const item of batch) {
          const { error: e2 } = await supabase.from('siswa').upsert(item, { onConflict: 'no_induk' })
          if (e2) { gagal++; if (errorLogs.length < 3) errorLogs.push(item.no_induk + ': ' + e2.message) }
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

// ─── EXPORT ───
function bukaExport() {
  exportResetAll()
  exportOpen.value = true
}
function tutupExport() { exportOpen.value = false }

async function exportDo() {
  const rows = exportFinalSiswa.value
  if (rows.length === 0) return alert('Tidak ada siswa untuk diexport')

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
  if (exportKelas.value.length) filters.push('Kelas: ' + exportKelas.value.join(', '))
  if (exportAngkatan.value.length) filters.push('Angkatan: ' + exportAngkatan.value.join(', '))
  if (exportStatus.value.length) filters.push('Status: ' + exportStatus.value.join(', '))
  if (exportSelectedSiswa.value.length) filters.push('Siswa spesifik (' + exportSelectedSiswa.value.length + ' siswa)')
  const filterDesc = filters.length ? filters.join(' • ') : 'Semua Data'

  const aoa = []
  aoa.push(['Waktu Pengunduhan:', waktu])
  aoa.push(['Nama Pengunduh:', namaUser])
  aoa.push(['Filter Pengunduhan:', filterDesc])
  aoa.push(['Total Siswa:', rows.length])
  aoa.push([])
  aoa.push(EXPORT_COLUMNS.map(c => c.label))

  rows.forEach(it => {
    const s = it.raw
    const detail = s.detail_data || {}
    const row = EXPORT_COLUMNS.map(c => {
      const val = c.source === 'core' ? s[c.key] : detail[c.key]
      if (val === null || val === undefined) return ''
      return String(val)
    })
    aoa.push(row)
  })

  const date = now.toISOString().slice(0, 10)
  await writeXlsx({
    aoa,
    cols: EXPORT_COLUMNS.map(c => ({ wch: Math.max(12, Math.min(30, c.label.length + 3)) })),
    autofilterRange: {
      s: { r: 5, c: 0 },
      e: { r: 5 + rows.length, c: EXPORT_COLUMNS.length - 1 }
    },
    sheetName: 'Data Siswa',
    filename: `Database_Siswa_${rows.length}_siswa_${date}.xlsx`
  })
  tutupExport()
}

// ─── MOUNT ───
onMounted(() => {
  ambilData()
  if (route.query.spmb === 'true') {
    bukaModal()
    router.replace({ path: '/siswa' })
  }
})
</script>

<template>
  <div class="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-5">

    <!-- HEADER -->
    <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl md:text-3xl font-bold text-white tracking-tight">Data Induk Siswa</h1>
        <p class="text-sm text-slate-500 mt-1">
          Kelola database santri •
          <span class="text-emerald-400 font-semibold">{{ stats.total }}</span> siswa terdaftar
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
          <Plus class="w-4 h-4" /><span>SPMB</span>
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
        <div class="text-[10.5px] text-slate-500 mt-0.5">Siswa terdaftar</div>
      </div>
      <div class="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3.5">
        <div class="flex items-center gap-2 text-emerald-400 text-[10.5px] font-bold uppercase tracking-wider mb-1.5">
          <CheckCircle2 class="w-3.5 h-3.5" /> Aktif
        </div>
        <div class="text-2xl font-bold text-emerald-400">{{ stats.aktif }}</div>
        <div class="text-[10.5px] text-slate-500 mt-0.5">Status aktif</div>
      </div>
      <div class="rounded-2xl border border-blue-500/30 bg-blue-500/5 p-3.5">
        <div class="flex items-center gap-2 text-blue-400 text-[10.5px] font-bold uppercase tracking-wider mb-1.5">
          <ShieldCheck class="w-3.5 h-3.5" /> Lulus
        </div>
        <div class="text-2xl font-bold text-blue-400">{{ stats.lulus }}</div>
        <div class="text-[10.5px] text-slate-500 mt-0.5">Alumni terdaftar</div>
      </div>
      <div class="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3.5">
        <div class="flex items-center gap-2 text-amber-400 text-[10.5px] font-bold uppercase tracking-wider mb-1.5">
          <AlertCircle class="w-3.5 h-3.5" /> Tanpa Kelas
        </div>
        <div class="text-2xl font-bold text-amber-400">{{ stats.tanpaKelas }}</div>
        <div class="text-[10.5px] text-slate-500 mt-0.5">Perlu di-assign</div>
      </div>
    </div>

    <!-- FILTER -->
    <div class="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-3">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5">
        <div class="lg:col-span-5 relative">
          <Search class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input v-model="pencarian" type="text" placeholder="Cari nama, no induk, atau NISN..."
                 class="w-full h-10 pl-10 pr-10 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white placeholder-slate-500 outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/10 transition-all" />
          <button v-if="pencarian" @click="pencarian = ''"
                  class="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition">
            <X class="w-3.5 h-3.5" />
          </button>
        </div>
        <div class="lg:col-span-3">
          <CustomSelect v-model="filterKelas" :options="filterKelasOptions" placeholder="Semua Kelas" searchable />
        </div>
        <div class="lg:col-span-2">
          <CustomSelect v-model="filterAngkatan" :options="filterAngkatanOptions" placeholder="Semua Angkatan" searchable />
        </div>
        <div class="lg:col-span-2">
          <CustomSelect v-model="filterStatus" :options="filterStatusOptions" placeholder="Semua Status" />
        </div>
      </div>
    </div>

    <!-- TABLE -->
    <div class="rounded-2xl border border-slate-800/80 bg-slate-900/50 overflow-hidden">
      <div class="px-4 py-3 border-b border-slate-800/80 bg-slate-950/40 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div class="text-xs text-slate-400">
          Menampilkan <b class="text-slate-200">{{ siswaTampil.length }}</b> dari
          <b class="text-emerald-400">{{ siswaTerfilter.length }}</b> data
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

      <table class="w-full text-sm" style="table-layout: fixed;">
        <thead class="bg-slate-950 border-b border-slate-800">
          <tr>
            <th class="w-10 px-2 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">No</th>
            <th class="w-24 px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">No Induk</th>
            <th class="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">Nama Lengkap</th>
            <th class="w-20 px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">Kelas</th>
            <th class="w-32 px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 hidden lg:table-cell">TTL</th>
            <th class="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 hidden xl:table-cell">Alamat</th>
            <th class="w-24 px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">Status</th>
            <th class="w-28 px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500 hidden lg:table-cell">Keterangan</th>
            <th class="w-24 px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">Aksi</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-800/60">
          <tr v-if="isLoading">
            <td colspan="9" class="px-4 py-16 text-center text-slate-500">Memuat data...</td>
          </tr>
          <tr v-else-if="siswaTampil.length === 0">
            <td colspan="9" class="px-4 py-16 text-center">
              <div class="text-slate-500 text-sm">Tidak ada data yang cocok</div>
              <div class="text-slate-600 text-xs mt-1">Coba ubah filter atau kata kunci pencarian</div>
            </td>
          </tr>
          <tr v-for="(s, idx) in siswaTampil" :key="s.id" class="hover:bg-slate-800/40 transition">
            <td class="px-2 py-3 text-center text-slate-500 text-xs tabular-nums">{{ (currentPage - 1) * pageSize + idx + 1 }}</td>
            <td class="px-3 py-3">
              <span class="font-mono text-[11.5px] font-semibold text-slate-300">{{ s.no_induk }}</span>
            </td>
            <td class="px-3 py-3">
              <div class="font-semibold text-white text-[13px] truncate">{{ s.nama || '-' }}</div>
            </td>
            <td class="px-3 py-3 text-center">
              <span v-if="s.kelas" class="inline-flex px-1.5 py-0.5 rounded-md bg-slate-800 text-slate-200 font-mono text-[10.5px] font-semibold truncate max-w-full">
                {{ s.kelas }}
              </span>
              <span v-else class="text-slate-600 text-[10px] italic">—</span>
            </td>
            <td class="px-3 py-3 text-slate-400 text-[11.5px] truncate hidden lg:table-cell">{{ s.detail_data?.tetala || '—' }}</td>
            <td class="px-3 py-3 text-slate-500 text-[11.5px] truncate hidden xl:table-cell">{{ s.alamat || '—' }}</td>
            <td class="px-3 py-3 text-center">
              <span class="inline-flex px-2 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase" :class="getStatusBadge(s.status)">
                {{ s.status || 'Aktif' }}
              </span>
            </td>
            <td class="px-3 py-3 text-center hidden lg:table-cell">
              <span class="inline-flex px-2 py-1 rounded-full text-[10px] font-bold" :class="getKeteranganBadge(s.keterangan).cls">
                {{ getKeteranganBadge(s.keterangan).label }}
              </span>
            </td>
            <td class="px-3 py-3 text-center">
              <div class="flex items-center justify-center gap-0.5">
                <button @click="bukaDetail(s)" class="p-1.5 rounded-md text-slate-400 hover:bg-blue-500/15 hover:text-blue-400 transition" title="Detail">
                  <Eye class="w-3.5 h-3.5" />
                </button>
                <button @click="bukaModal(s)" class="p-1.5 rounded-md text-slate-400 hover:bg-amber-500/15 hover:text-amber-400 transition" title="Edit">
                  <Edit class="w-3.5 h-3.5" />
                </button>
                <button @click="hapusSiswa(s.id, s.nama)" class="p-1.5 rounded-md text-slate-400 hover:bg-red-500/15 hover:text-red-400 transition" title="Hapus">
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="px-4 py-3 border-t border-slate-800/80 bg-slate-950/40 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div class="text-xs text-slate-400">Total: <b class="text-emerald-400">{{ siswaTerfilter.length }}</b> data</div>
        <div class="w-24">
          <CustomSelect v-model.number="pageSize" :options="pageSizeOptions" size="sm" />
        </div>
      </div>
    </div>

    <!-- ═══════ EDIT TAHUN PER TINGKAT MODAL ═══════ -->
    <div v-if="editTahunOpen && editTahunSiswa" class="fixed inset-0 z-[55] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div class="modal-standard bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[92vh]">
        <div class="px-5 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
              <Calendar class="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 class="text-base font-bold text-white">Edit Tahun Pelajaran</h3>
              <p class="text-[11px] text-slate-400 font-mono">{{ editTahunSiswa.nama }} • {{ editTahunSiswa.no_induk }}</p>
            </div>
          </div>
          <button @click="tutupEditTahun" class="w-9 h-9 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition">
            <X class="w-4 h-4" />
          </button>
        </div>

        <div class="p-5 space-y-3 overflow-y-auto flex-1">
          <div class="rounded-xl bg-slate-950/60 border border-slate-800 p-3 space-y-1">
            <div class="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">Tahun Masuk</div>
            <div class="text-[13px] text-amber-300 font-mono font-semibold">
              {{ editTahunSiswa.detail_data?.masuk || '—' }}
            </div>
          </div>

          <div class="text-[11px] text-slate-400 leading-relaxed">
            Atur tahun pelajaran <b>per tingkat</b>. Kalau berbeda dari tahun masuk, akan di-override. Kosongkan untuk pakai otomatis.
          </div>

          <div v-for="t in ['X', 'XI', 'XII']" :key="t" class="space-y-1.5">
            <label class="flex items-center justify-between text-[11.5px] font-semibold">
              <span class="text-slate-400">Kelas {{ t }}</span>
              <span v-if="editTahunAuto[t]" class="text-[10px] text-slate-500 font-mono">
                auto: {{ editTahunAuto[t] }}
              </span>
            </label>
            <input v-model="editTahunForm[t]" type="text" :placeholder="editTahunAuto[t] || 'YYYY/YYYY'"
                  class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white font-mono placeholder-slate-600 outline-none focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/10" />
            <div v-if="editTahunForm[t] || editTahunAuto[t]"
                class="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md border text-[10.5px]"
                :class="editTahunPreview[t] ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'">
              <span class="font-mono" :class="editTahunPreview[t] ? 'text-emerald-300' : 'text-red-300'">
                Muadalah: {{ editTahunForm[t] || editTahunAuto[t] }} • {{ t }}
              </span>
              <span :class="editTahunPreview[t] ? 'text-emerald-400' : 'text-red-400'">
                {{ editTahunPreview[t] ? '✓' : '✗ belum ada' }}
              </span>
            </div>
          </div>

          <div v-if="editTahunForm.X && editTahunForm.XI && parseTahunRange(editTahunForm.XI) && parseTahunRange(editTahunForm.X) && parseTahunRange(editTahunForm.XI)[0] < parseTahunRange(editTahunForm.X)[0]"
              class="px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300 flex items-start gap-2">
            <AlertCircle class="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <div>Tahun XI lebih awal dari X — tidak wajar (kemungkinan salah input).</div>
          </div>
        </div>

        <div class="px-5 py-3 border-t border-slate-800 bg-slate-950 flex justify-end gap-2 shrink-0">
          <button @click="tutupEditTahun"
                  class="h-10 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[13px] font-semibold transition">
            Batal
          </button>
          <button @click="simpanEditTahun" :disabled="editTahunSaving"
                  class="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white text-[13px] font-bold shadow-lg shadow-amber-900/40 transition disabled:opacity-50">
            <Save class="w-4 h-4" />
            {{ editTahunSaving ? 'Menyimpan...' : 'Simpan' }}
          </button>
        </div>
      </div>
    </div>

        <!-- ═══════ DETAIL MODAL ═══════ -->
    <div v-if="detailOpen && detailSiswa" class="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 md:p-4">
      <div class="modal-standard bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col w-full max-w-4xl max-h-[94vh]">
        <!-- Header -->
        <div class="px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0 gap-3">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shrink-0">
              <User class="w-5 h-5 text-white" />
            </div>
            <div class="min-w-0">
              <h2 class="text-base font-bold text-white truncate">{{ detailSiswa.nama }}</h2>
              <p class="text-[11px] text-slate-400 font-mono truncate">
                {{ detailSiswa.no_induk }} • {{ detailSiswa.kelas || 'Tanpa kelas' }}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <span class="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase" :class="getStatusBadge(detailSiswa.status)">
              {{ detailSiswa.status || 'Aktif' }}
            </span>
            <span class="px-2.5 py-1 rounded-full text-[10px] font-bold" :class="getKeteranganBadge(detailSiswa.keterangan).cls">
              {{ getKeteranganBadge(detailSiswa.keterangan).label }}
            </span>
            <button @click="tutupDetail" class="w-9 h-9 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition">
              <X class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- Body (scrollable) -->
        <div class="p-5 overflow-y-auto flex-1 space-y-5">

          <!-- Identitas -->
          <section>
            <h3 class="text-[11px] font-bold uppercase tracking-wider text-emerald-400 mb-2 pb-1 border-b border-slate-800">Identitas</h3>
            <div class="flex gap-4">
              <div class="shrink-0">
                <div v-if="detailSiswa.detail_data?.foto" class="w-24 h-32 rounded-lg overflow-hidden border border-slate-700">
                  <img :src="detailSiswa.detail_data.foto" class="w-full h-full object-cover" alt="Foto" />
                </div>
                <div v-else class="w-24 h-32 rounded-lg border-2 border-dashed border-slate-700 flex items-center justify-center text-slate-600 text-[10px] text-center leading-tight">
                  Tidak ada<br>foto
                </div>
              </div>
              <div class="flex-1 grid grid-cols-2 md:grid-cols-3 gap-3 text-[12.5px]">
                <div><div class="text-slate-500 text-[10.5px] uppercase">Nama</div><div class="text-white font-semibold">{{ detailSiswa.nama || '—' }}</div></div>
                <div><div class="text-slate-500 text-[10.5px] uppercase">No Induk</div><div class="text-white font-mono">{{ detailSiswa.no_induk || '—' }}</div></div>
                <div><div class="text-slate-500 text-[10.5px] uppercase">NISN</div><div class="text-white font-mono">{{ detailSiswa.nisn || '—' }}</div></div>
                <div><div class="text-slate-500 text-[10.5px] uppercase">NIK</div><div class="text-white font-mono">{{ detailSiswa.nik || '—' }}</div></div>
                <div><div class="text-slate-500 text-[10.5px] uppercase">No KK</div><div class="text-white font-mono">{{ detailSiswa.no_kk || '—' }}</div></div>
                <div><div class="text-slate-500 text-[10.5px] uppercase">Kelas</div><div class="text-white">{{ detailSiswa.kelas || '—' }}</div></div>
                <div><div class="text-slate-500 text-[10.5px] uppercase">Jenis Kelamin</div><div class="text-white">{{ detailSiswa.kelamin || '—' }}</div></div>
                <div><div class="text-slate-500 text-[10.5px] uppercase">Agama</div><div class="text-white">{{ detailSiswa.agama || '—' }}</div></div>
                <div><div class="text-slate-500 text-[10.5px] uppercase">Anak Ke-</div><div class="text-white">{{ detailSiswa.anak_ke || detailSiswa.detail_data?.anak_ke || '—' }}</div></div>
                <div class="md:col-span-3">
                  <div class="text-slate-500 text-[10.5px] uppercase mb-1">Tahun Pelajaran per Tingkat</div>
                  <div class="flex flex-wrap gap-2 text-[12px] font-mono">
                    <span class="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/30">
                      <span class="text-amber-300 font-bold">X</span>
                      <span class="text-white">{{ getTahunPerTingkatLengkap(detailSiswa).X || '—' }}</span>
                    </span>
                    <span class="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/30">
                      <span class="text-amber-300 font-bold">XI</span>
                      <span class="text-white">{{ getTahunPerTingkatLengkap(detailSiswa).XI || '—' }}</span>
                    </span>
                    <span class="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/30">
                      <span class="text-amber-300 font-bold">XII</span>
                      <span class="text-white">{{ getTahunPerTingkatLengkap(detailSiswa).XII || '—' }}</span>
                    </span>
                    <span v-if="detailSiswa.detail_data?.tahun_per_tingkat && Object.keys(detailSiswa.detail_data.tahun_per_tingkat).length > 0"
                          class="text-[10px] text-amber-400 self-center italic">(override aktif)</span>
                  </div>
                </div>
                <div class="md:col-span-2"><div class="text-slate-500 text-[10.5px] uppercase">Tempat, Tgl Lahir</div><div class="text-white">{{ detailSiswa.detail_data?.tetala || '—' }}</div></div>
                <div><div class="text-slate-500 text-[10.5px] uppercase">No HP / WA</div><div class="text-white font-mono">{{ detailSiswa.no_telp || '—' }}</div></div>
                <div class="md:col-span-3"><div class="text-slate-500 text-[10.5px] uppercase">Alamat Lengkap</div><div class="text-white">{{ detailSiswa.alamat || '—' }}</div></div>
                <div class="md:col-span-3"><div class="text-slate-500 text-[10.5px] uppercase">Alamat Singkat</div><div class="text-white">{{ detailSiswa.detail_data?.alamat_singkat || '—' }}</div></div>
              </div>
            </div>
          </section>

          <!-- Orang Tua -->
          <section>
            <h3 class="text-[11px] font-bold uppercase tracking-wider text-emerald-400 mb-2 pb-1 border-b border-slate-800">Orang Tua</h3>
            <div class="grid grid-cols-2 md:grid-cols-3 gap-3 text-[12.5px]">
              <div><div class="text-slate-500 text-[10.5px] uppercase">Nama Ayah</div><div class="text-white">{{ detailSiswa.nama_ayah || detailSiswa.detail_data?.ayah || '—' }}</div></div>
              <div><div class="text-slate-500 text-[10.5px] uppercase">TTL Ayah</div><div class="text-white">{{ detailSiswa.detail_data?.tetala_ayah || '—' }}</div></div>
              <div><div class="text-slate-500 text-[10.5px] uppercase">Pendidikan Ayah</div><div class="text-white">{{ detailSiswa.detail_data?.sekolah_ayah || '—' }}</div></div>
              <div><div class="text-slate-500 text-[10.5px] uppercase">Pekerjaan Ayah</div><div class="text-white">{{ detailSiswa.ayah_pekerjaan || detailSiswa.detail_data?.pekerjaanayah || '—' }}</div></div>
              <div><div class="text-slate-500 text-[10.5px] uppercase">Nama Ibu</div><div class="text-white">{{ detailSiswa.nama_ibu || detailSiswa.detail_data?.ibu || '—' }}</div></div>
              <div><div class="text-slate-500 text-[10.5px] uppercase">TTL Ibu</div><div class="text-white">{{ detailSiswa.detail_data?.tetala_ibu || '—' }}</div></div>
              <div><div class="text-slate-500 text-[10.5px] uppercase">Pendidikan Ibu</div><div class="text-white">{{ detailSiswa.detail_data?.sekolah_ibu || '—' }}</div></div>
            </div>
          </section>

          <!-- Pendidikan -->
          <section>
            <h3 class="text-[11px] font-bold uppercase tracking-wider text-emerald-400 mb-2 pb-1 border-b border-slate-800">Riwayat Pendidikan</h3>
            <div class="grid grid-cols-2 md:grid-cols-3 gap-3 text-[12.5px]">
              <div><div class="text-slate-500 text-[10.5px] uppercase">SD / MI</div><div class="text-white">{{ detailSiswa.detail_data?.sd || detailSiswa.asal_sekolah || '—' }}</div></div>
              <div><div class="text-slate-500 text-[10.5px] uppercase">SMP / MTs</div><div class="text-white">{{ detailSiswa.detail_data?.mts || '—' }}</div></div>
              <div><div class="text-slate-500 text-[10.5px] uppercase">NPSN</div><div class="text-white font-mono">{{ detailSiswa.detail_data?.npsn || '—' }}</div></div>
              <div class="md:col-span-3"><div class="text-slate-500 text-[10.5px] uppercase">Alamat SMP/MTs</div><div class="text-white">{{ detailSiswa.detail_data?.alamat_mts || '—' }}</div></div>
            </div>
          </section>

          <!-- Mutasi & Kelulusan -->
          <section>
            <h3 class="text-[11px] font-bold uppercase tracking-wider text-emerald-400 mb-2 pb-1 border-b border-slate-800">Mutasi & Kelulusan</h3>
            <div class="grid grid-cols-2 md:grid-cols-3 gap-3 text-[12.5px]">
              <div><div class="text-slate-500 text-[10.5px] uppercase">Tahun Masuk</div><div class="text-white">{{ detailSiswa.detail_data?.masuk || '—' }}</div></div>
              <div><div class="text-slate-500 text-[10.5px] uppercase">Tahun Keluar</div><div class="text-white">{{ detailSiswa.detail_data?.keluar || '—' }}</div></div>
              <div><div class="text-slate-500 text-[10.5px] uppercase">Asal Mutasi</div><div class="text-white">{{ detailSiswa.detail_data?.mutasi || '—' }}</div></div>
              <div class="md:col-span-2"><div class="text-slate-500 text-[10.5px] uppercase">Alamat Asal Mutasi</div><div class="text-white">{{ detailSiswa.detail_data?.alamat_mutasi || '—' }}</div></div>
              <div><div class="text-slate-500 text-[10.5px] uppercase">No Ijazah</div><div class="text-white font-mono">{{ detailSiswa.detail_data?.no_ijazah || '—' }}</div></div>
              <div><div class="text-slate-500 text-[10.5px] uppercase">Tanggal Kelulusan</div><div class="text-white">{{ detailSiswa.detail_data?.tgl_kelulusan || '—' }}</div></div>
              <div><div class="text-slate-500 text-[10.5px] uppercase">Prestasi Kab</div><div class="text-white">{{ detailSiswa.detail_data?.prestasi_kab || '—' }}</div></div>
              <div><div class="text-slate-500 text-[10.5px] uppercase">Prestasi Prov</div><div class="text-white">{{ detailSiswa.detail_data?.prestasi_prov || '—' }}</div></div>
              <div><div class="text-slate-500 text-[10.5px] uppercase">Prestasi Nas</div><div class="text-white">{{ detailSiswa.detail_data?.prestasi_nas || '—' }}</div></div>
            </div>
          </section>

          <!-- Alumni -->
          <section>
            <h3 class="text-[11px] font-bold uppercase tracking-wider text-emerald-400 mb-2 pb-1 border-b border-slate-800">Alumni</h3>
            <div class="grid grid-cols-2 md:grid-cols-3 gap-3 text-[12.5px] mb-3">
              <div><div class="text-slate-500 text-[10.5px] uppercase">S1</div><div class="text-white">{{ detailSiswa.detail_data?.lanjut_s1 || '—' }} <span class="text-slate-500">/</span> {{ detailSiswa.detail_data?.prodi_s1 || '—' }}</div></div>
              <div><div class="text-slate-500 text-[10.5px] uppercase">S2</div><div class="text-white">{{ detailSiswa.detail_data?.lanjut_s2 || '—' }} <span class="text-slate-500">/</span> {{ detailSiswa.detail_data?.prodi_s2 || '—' }}</div></div>
              <div><div class="text-slate-500 text-[10.5px] uppercase">S3</div><div class="text-white">{{ detailSiswa.detail_data?.lanjut_s3 || '—' }} <span class="text-slate-500">/</span> {{ detailSiswa.detail_data?.prodi_s3 || '—' }}</div></div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-[12.5px]">
              <div v-for="i in 5" :key="i">
                <div class="text-slate-500 text-[10.5px] uppercase">Profesi {{ i }}</div>
                <div class="text-white">
                  {{ detailSiswa.detail_data?.['profesi' + i] || '—' }}
                  <span v-if="detailSiswa.detail_data?.['tahun_profesi' + i]" class="text-slate-400 text-[11px]"> • {{ detailSiswa.detail_data['tahun_profesi' + i] }}</span>
                </div>
              </div>
            </div>
          </section>

          <!-- Keterangan -->
          <section>
            <h3 class="text-[11px] font-bold uppercase tracking-wider text-emerald-400 mb-2 pb-1 border-b border-slate-800">Keterangan</h3>
            <div class="px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-800 text-[12.5px] text-slate-300 whitespace-pre-line">
              {{ detailSiswa.detail_data?.keterangan || detailSiswa.keterangan || 'Tidak ada keterangan' }}
            </div>
            <div class="mt-2 text-[11px] text-slate-500 flex items-center gap-2 flex-wrap">
              <span>Status kelengkapan:</span>
              <span class="px-2 py-0.5 rounded-full font-bold text-[10px]" :class="getKeteranganBadge(detailSiswa.keterangan).cls">
                {{ getKeteranganBadge(detailSiswa.keterangan).label }}
              </span>
              <span class="text-[10px] italic">— dihitung otomatis dari kelengkapan field</span>
            </div>
          </section>

        </div>

        <!-- Footer -->
        <div class="px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex flex-wrap justify-end gap-2 shrink-0">
          <button @click="tutupDetail"
                  class="h-10 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[13px] font-semibold transition">
            Tutup
          </button>
          <button @click="bukaEditTahun(detailSiswa)"
                  class="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[13px] font-semibold transition">
            <Calendar class="w-4 h-4 text-amber-400" /> Edit Tahun
          </button>
          <button @click="tutupDetail(); bukaModal(detailSiswa)"
                  class="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white text-[13px] font-bold shadow-lg shadow-amber-900/40 transition">
            <Edit class="w-4 h-4" /> Edit Data
          </button>
        </div>
      </div>
    </div>

    <!-- ═══════ IMPORT MODAL ═══════ -->
    <div v-if="isImportModalOpen" class="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div class="modal-standard bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-4xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden">
        <div class="px-5 sm:px-6 py-4 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center">
              <FileUp class="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 class="text-base font-bold text-white">Import Data Siswa</h3>
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
              <p class="text-slate-300">Format .xlsx atau .xls. Baris pertama harus berisi judul kolom.</p>
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
              <div><b>{{ fileName }}</b> — Cocokkan kolom Excel dengan kolom database.</div>
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

    <!-- ═══════ SPMB MODAL ═══════ -->
    <div v-if="isModalOpen" class="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 md:p-4">
      <div class="modal-standard bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col w-full max-w-4xl max-h-[94vh]">
        <div class="px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-900/40">
              <Plus class="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 class="text-[15px] font-bold text-white flex items-center gap-2">
                {{ isEditMode ? 'Edit Data Siswa' : 'SPMB — Siswa Baru' }}
                <span v-if="isEditMode && form.status" class="px-2 py-0.5 rounded-full text-[10px] font-bold" :class="getStatusBadge(form.status)">
                  {{ form.status }}
                </span>
              </h2>
              <p class="text-[11px] text-slate-500">{{ isEditMode ? 'Perubahan langsung tersimpan saat klik Simpan' : 'Sistem Penerimaan Murid Baru' }}</p>
            </div>
          </div>
          <button @click="isModalOpen = false" class="w-9 h-9 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition">
            <X class="w-4 h-4" />
          </button>
        </div>

        <div class="flex overflow-x-auto border-b border-slate-800 bg-slate-950/30 px-3 shrink-0">
          <button v-for="t in [
            {id:'identitas', l:'Identitas'}, {id:'pendidikan', l:'Pendidikan'},
            {id:'ortu', l:'Orang Tua'}, {id:'mutasi', l:'Mutasi'},
            {id:'kelulusan', l:'Kelulusan'}, {id:'alumni', l:'Alumni'}
          ]" :key="t.id" @click="tabAktif = t.id"
            class="relative px-4 py-3 text-[12.5px] font-semibold whitespace-nowrap transition-colors"
            :class="tabAktif === t.id ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'">
            {{ t.l }}
            <span v-if="tabAktif === t.id" class="absolute bottom-0 left-2 right-2 h-0.5 rounded-t bg-emerald-500"></span>
          </button>
        </div>

        <div class="p-5 md:p-6 overflow-y-auto flex-1 space-y-4">
          <div v-if="tabAktif === 'identitas'" class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label class="block text-[11.5px] font-semibold text-slate-400 mb-1">No Induk <span class="text-red-400">*</span></label><input v-model="form.no_induk" type="text" class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white focus:border-emerald-500 outline-none" /></div>
            <div><label class="block text-[11.5px] font-semibold text-slate-400 mb-1">Nama Lengkap <span class="text-red-400">*</span></label><input v-model="form.nama" type="text" class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white focus:border-emerald-500 outline-none" /></div>
            <div><label class="block text-[11.5px] font-semibold text-slate-400 mb-1">NISN</label><input v-model="form.nisn" type="text" class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white focus:border-emerald-500 outline-none" /></div>
            <div><label class="block text-[11.5px] font-semibold text-slate-400 mb-1">NIK</label><input v-model="form.nik" type="text" class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white focus:border-emerald-500 outline-none" /></div>
            <div><label class="block text-[11.5px] font-semibold text-slate-400 mb-1">No KK</label><input v-model="form.kk" type="text" class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white focus:border-emerald-500 outline-none" /></div>
            <div>
              <label class="block text-[11.5px] font-semibold text-slate-400 mb-1">
                Kelas
                <span v-if="!kelasEditable" class="text-[10px] text-amber-400 ml-1">🔒 terkunci</span>
              </label>
              <input v-model="form.kelas" type="text"
                    :disabled="!kelasEditable"
                    :placeholder="kelasEditable ? 'Contoh: SPMB atau X A' : ''"
                    class="w-full h-10 px-3 rounded-lg text-[13px] font-mono outline-none transition"
                    :class="kelasEditable
                      ? 'bg-slate-950 border border-slate-800 text-white focus:border-emerald-500 placeholder-slate-500'
                      : 'bg-slate-950/60 border border-slate-800/50 text-slate-400 cursor-not-allowed opacity-70'" />
              <p v-if="!kelasEditable" class="text-[10px] text-amber-400/80 mt-1">
                Ubah kelas lewat menu <b>Kenaikan Kelas</b>
              </p>
              <p v-else class="text-[10px] text-slate-500 mt-1">
                Isi kelas awal (contoh: SPMB, X A, XI B)
              </p>
            </div>
            <div>
              <label class="block text-[11.5px] font-semibold text-slate-400 mb-1">Jenis Kelamin</label>
              <CustomSelect v-model="form.kelamin" :options="[{label:'Laki-laki',value:'Laki-laki'},{label:'Perempuan',value:'Perempuan'}]" />
            </div>
            <div><label class="block text-[11.5px] font-semibold text-slate-400 mb-1">Tempat, Tgl Lahir</label><input v-model="form.tetala" type="text" placeholder="Pamekasan, 12 Mei 2008" class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white focus:border-emerald-500 outline-none" /></div>
            <div><label class="block text-[11.5px] font-semibold text-slate-400 mb-1">Agama</label><input v-model="form.agama" type="text" class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white focus:border-emerald-500 outline-none" /></div>
            <div><label class="block text-[11.5px] font-semibold text-slate-400 mb-1">Anak Ke-</label><input v-model="form.anak_ke" type="text" class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white focus:border-emerald-500 outline-none" /></div>
            <div class="md:col-span-2"><label class="block text-[11.5px] font-semibold text-slate-400 mb-1">Alamat Singkat</label><input v-model="form.alamat_singkat" type="text" class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white focus:border-emerald-500 outline-none" /></div>
            <div class="md:col-span-2"><label class="block text-[11.5px] font-semibold text-slate-400 mb-1">Alamat Lengkap</label><textarea v-model="form.alamat" rows="2" class="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white focus:border-emerald-500 outline-none resize-none"></textarea></div>
          </div>

          <div v-if="tabAktif === 'pendidikan'" class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label class="block text-[11.5px] font-semibold text-slate-400 mb-1">SD / MI Asal</label><input v-model="form.sd" type="text" class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white focus:border-emerald-500 outline-none" /></div>
            <div><label class="block text-[11.5px] font-semibold text-slate-400 mb-1">SMP / MTs Asal</label><input v-model="form.mts" type="text" class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white focus:border-emerald-500 outline-none" /></div>
            <div class="md:col-span-2"><label class="block text-[11.5px] font-semibold text-slate-400 mb-1">Alamat MTs / SMP</label><input v-model="form.alamat_mts" type="text" class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white focus:border-emerald-500 outline-none" /></div>
            <div><label class="block text-[11.5px] font-semibold text-slate-400 mb-1">NPSN Sekolah Asal</label><input v-model="form.npsn" type="text" class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white focus:border-emerald-500 outline-none" /></div>
          </div>

          <div v-if="tabAktif === 'ortu'" class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label class="block text-[11.5px] font-semibold text-slate-400 mb-1">Nama Ayah</label><input v-model="form.ayah" type="text" class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white focus:border-emerald-500 outline-none" /></div>
            <div><label class="block text-[11.5px] font-semibold text-slate-400 mb-1">TTL Ayah</label><input v-model="form.tetala_ayah" type="text" class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white focus:border-emerald-500 outline-none" /></div>
            <div><label class="block text-[11.5px] font-semibold text-slate-400 mb-1">Pendidikan Ayah</label><input v-model="form.sekolah_ayah" type="text" class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white focus:border-emerald-500 outline-none" /></div>
            <div><label class="block text-[11.5px] font-semibold text-slate-400 mb-1">Pekerjaan Ayah</label><input v-model="form.pekerjaanayah" type="text" class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white focus:border-emerald-500 outline-none" /></div>
            <div><label class="block text-[11.5px] font-semibold text-slate-400 mb-1">Nama Ibu</label><input v-model="form.ibu" type="text" class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white focus:border-emerald-500 outline-none" /></div>
            <div><label class="block text-[11.5px] font-semibold text-slate-400 mb-1">TTL Ibu</label><input v-model="form.tetala_ibu" type="text" class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white focus:border-emerald-500 outline-none" /></div>
            <div class="md:col-span-2"><label class="block text-[11.5px] font-semibold text-slate-400 mb-1">Pendidikan Ibu</label><input v-model="form.sekolah_ibu" type="text" class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white focus:border-emerald-500 outline-none" /></div>
            <div class="md:col-span-2"><label class="block text-[11.5px] font-semibold text-slate-400 mb-1">No HP / WhatsApp</label><input v-model="form.no_telp" type="text" class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white focus:border-emerald-500 outline-none" /></div>
          </div>

          <div v-if="tabAktif === 'mutasi'" class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label class="block text-[11.5px] font-semibold text-slate-400 mb-1">Tahun Masuk</label><input v-model="form.masuk" type="text" class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white focus:border-emerald-500 outline-none" /></div>
            <div><label class="block text-[11.5px] font-semibold text-slate-400 mb-1">Tahun Keluar</label><input v-model="form.keluar" type="text" class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white focus:border-emerald-500 outline-none" /></div>
            <div class="md:col-span-2"><label class="block text-[11.5px] font-semibold text-slate-400 mb-1">Asal Sekolah (Mutasi)</label><input v-model="form.mutasi" type="text" class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white focus:border-emerald-500 outline-none" /></div>
            <div class="md:col-span-2"><label class="block text-[11.5px] font-semibold text-slate-400 mb-1">Alamat Sekolah Asal Mutasi</label><input v-model="form.alamat_mutasi" type="text" class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white focus:border-emerald-500 outline-none" /></div>
            <div>
              <label class="block text-[11.5px] font-semibold text-slate-400 mb-1">Status Keaktifan</label>
              <CustomSelect v-model="form.status" :options="[
                {label:'Aktif',value:'Aktif'},{label:'Lulus',value:'Lulus'},
                {label:'Mutasi',value:'Mutasi'},{label:'Keluar',value:'Keluar'}
              ]" />
            </div>
            <div><label class="block text-[11.5px] font-semibold text-slate-400 mb-1">Prestasi Kabupaten</label><input v-model="form.prestasi_kab" type="text" class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white focus:border-emerald-500 outline-none" /></div>
            <div><label class="block text-[11.5px] font-semibold text-slate-400 mb-1">Prestasi Provinsi</label><input v-model="form.prestasi_prov" type="text" class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white focus:border-emerald-500 outline-none" /></div>
            <div><label class="block text-[11.5px] font-semibold text-slate-400 mb-1">Prestasi Nasional</label><input v-model="form.prestasi_nas" type="text" class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white focus:border-emerald-500 outline-none" /></div>
          </div>

          <div v-if="tabAktif === 'kelulusan'" class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label class="block text-[11.5px] font-semibold text-slate-400 mb-1">Nomor Ijazah</label><input v-model="form.no_ijazah" type="text" class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white focus:border-emerald-500 outline-none" /></div>
            <div><label class="block text-[11.5px] font-semibold text-slate-400 mb-1">Tanggal Kelulusan</label><input v-model="form.tgl_kelulusan" type="text" class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white focus:border-emerald-500 outline-none" /></div>
            <div class="md:col-span-2"><label class="block text-[11.5px] font-semibold text-slate-400 mb-1">URL Pasfoto</label><input v-model="form.foto" type="text" class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white focus:border-emerald-500 outline-none" /></div>
            <div class="md:col-span-2 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-[11.5px] text-emerald-300 flex items-start gap-2">
              <AlertCircle class="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <div><b>Keterangan data</b> (Lengkap/Tidak Lengkap) dihitung otomatis oleh database berdasarkan kelengkapan field. Tidak dapat diubah manual.</div>
            </div>
          </div>

          <div v-if="tabAktif === 'alumni'" class="space-y-4">
            <div class="rounded-xl border border-slate-800 bg-slate-950/40 p-3 space-y-2">
              <h4 class="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Lanjut Studi S1</h4>
              <div class="grid grid-cols-2 gap-2">
                <input v-model="form.lanjut_s1" type="text" placeholder="Nama Kampus" class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white focus:border-emerald-500 outline-none" />
                <input v-model="form.prodi_s1" type="text" placeholder="Program Studi" class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white focus:border-emerald-500 outline-none" />
              </div>
            </div>
            <div class="rounded-xl border border-slate-800 bg-slate-950/40 p-3 space-y-2">
              <h4 class="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Lanjut Studi S2</h4>
              <div class="grid grid-cols-2 gap-2">
                <input v-model="form.lanjut_s2" type="text" placeholder="Nama Kampus" class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white focus:border-emerald-500 outline-none" />
                <input v-model="form.prodi_s2" type="text" placeholder="Program Studi" class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white focus:border-emerald-500 outline-none" />
              </div>
            </div>
            <div class="rounded-xl border border-slate-800 bg-slate-950/40 p-3 space-y-2">
              <h4 class="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Lanjut Studi S3</h4>
              <div class="grid grid-cols-2 gap-2">
                <input v-model="form.lanjut_s3" type="text" placeholder="Nama Kampus" class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white focus:border-emerald-500 outline-none" />
                <input v-model="form.prodi_s3" type="text" placeholder="Program Studi" class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white focus:border-emerald-500 outline-none" />
              </div>
            </div>
            <div class="rounded-xl border border-slate-800 bg-slate-950/40 p-3 space-y-2">
              <h4 class="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Profesi</h4>
              <div class="grid grid-cols-2 gap-2">
                <input v-model="form.profesi1" type="text" placeholder="Profesi 1" class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white focus:border-emerald-500 outline-none" />
                <input v-model="form.tahun_profesi1" type="text" placeholder="Tahun" class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white focus:border-emerald-500 outline-none" />
                <input v-model="form.profesi2" type="text" placeholder="Profesi 2" class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white focus:border-emerald-500 outline-none" />
                <input v-model="form.tahun_profesi2" type="text" placeholder="Tahun" class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white focus:border-emerald-500 outline-none" />
                <input v-model="form.profesi3" type="text" placeholder="Profesi 3" class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white focus:border-emerald-500 outline-none" />
                <input v-model="form.tahun_profesi3" type="text" placeholder="Tahun" class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white focus:border-emerald-500 outline-none" />
                <input v-model="form.profesi4" type="text" placeholder="Profesi 4" class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white focus:border-emerald-500 outline-none" />
                <input v-model="form.tahun_profesi4" type="text" placeholder="Tahun" class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white focus:border-emerald-500 outline-none" />
                <input v-model="form.profesi5" type="text" placeholder="Profesi 5" class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white focus:border-emerald-500 outline-none" />
                <input v-model="form.tahun_profesi5" type="text" placeholder="Tahun" class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white focus:border-emerald-500 outline-none" />
              </div>
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
            <button @click="simpanSiswa" :disabled="isLoading"
                    class="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white text-[13px] font-bold shadow-lg shadow-emerald-900/40 transition disabled:opacity-50">
              <Save class="w-4 h-4" />
              {{ isLoading ? 'Menyimpan...' : 'Simpan' }}
            </button>
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
              <h3 class="text-base font-bold text-white">Export Data Siswa</h3>
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
                <div class="flex items-center gap-2">
                  <School class="w-3.5 h-3.5 text-blue-400" />
                  <span class="text-xs font-bold text-white">Filter Kelas</span>
                </div>
                <button @click="exportKelas = []; exportSelectedSiswa = []" class="text-[10px] text-red-400 hover:text-red-300 underline font-semibold">Reset</button>
              </div>
              <div class="p-2">
                <div class="relative mb-2">
                  <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
                  <input v-model="exportSearchKelas" type="text" placeholder="Cari kelas..."
                         class="w-full pl-7 pr-2 py-1.5 bg-slate-950 border border-slate-800 rounded-md text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500" />
                </div>
                <div class="max-h-32 overflow-y-auto space-y-0.5">
                  <label v-for="k in exportKelasFiltered" :key="k"
                         class="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-800/60 cursor-pointer transition">
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
                <div class="flex items-center gap-2">
                  <Calendar class="w-3.5 h-3.5 text-purple-400" />
                  <span class="text-xs font-bold text-white">Filter Angkatan</span>
                </div>
                <button @click="exportAngkatan = []; exportSelectedSiswa = []" class="text-[10px] text-red-400 hover:text-red-300 underline font-semibold">Reset</button>
              </div>
              <div class="p-2">
                <div class="relative mb-2">
                  <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
                  <input v-model="exportSearchAngkatan" type="text" placeholder="Cari angkatan..."
                         class="w-full pl-7 pr-2 py-1.5 bg-slate-950 border border-slate-800 rounded-md text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500" />
                </div>
                <div class="max-h-32 overflow-y-auto space-y-0.5">
                  <label v-for="a in exportAngkatanFiltered" :key="a"
                         class="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-800/60 cursor-pointer transition">
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

          <div class="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <ShieldCheck class="w-3.5 h-3.5 text-emerald-400" />
                <span class="text-xs font-bold text-white">Filter Status</span>
              </div>
              <button @click="exportStatus = []; exportSelectedSiswa = []" class="text-[10px] text-red-400 hover:text-red-300 underline font-semibold">Reset</button>
            </div>
            <div class="flex flex-wrap gap-1.5">
              <label v-for="st in statusOptions" :key="st"
                     class="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 hover:border-slate-700 cursor-pointer transition"
                     :class="exportStatus.includes(st) ? 'border-emerald-500/50 bg-emerald-500/10' : ''">
                <input type="checkbox" :checked="exportStatus.includes(st)" @change="exportToggleStatus(st)" class="accent-emerald-500 w-3.5 h-3.5" />
                <span class="text-[11px] text-slate-200">{{ st }}</span>
              </label>
            </div>
          </div>

          <div class="rounded-xl border border-slate-800 bg-slate-950/40 overflow-hidden">
            <div class="px-3 py-2 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2">
              <div class="flex items-center gap-2">
                <Users class="w-3.5 h-3.5 text-emerald-400" />
                <span class="text-xs font-bold text-white">Pilih Siswa Spesifik</span>
                <span class="text-[10px] text-slate-500">(opsional)</span>
              </div>
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
                <label v-for="s in exportSiswaFiltered" :key="s.no_induk"
                       class="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-800/60 cursor-pointer transition">
                  <input type="checkbox" :checked="exportSelectedSiswa.includes(s.no_induk)"
                         @change="exportToggleSiswa(s.no_induk)" class="accent-emerald-500 w-3.5 h-3.5 shrink-0" />
                  <span class="text-xs text-white font-semibold truncate flex-1">{{ s.nama || '-' }}</span>
                  <span class="text-[10px] text-slate-500 font-mono shrink-0">{{ s.no_induk }}</span>
                </label>
                <div v-if="exportSiswaFiltered.length === 0" class="text-center text-[10px] text-slate-500 py-4">
                  Tidak ada siswa yang cocok
                </div>
              </div>
            </div>
            <div class="px-3 py-1.5 border-t border-slate-800 text-[10px] text-slate-500">
              <span class="text-emerald-400 font-bold">{{ exportSelectedSiswa.length }}</span> siswa dipilih spesifik
              <span v-if="exportSelectedSiswa.length > 0" class="ml-1 text-slate-400">• filter kelas/angkatan/status diabaikan</span>
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
              <b class="text-emerald-400 text-base">{{ exportFinalSiswa.length }}</b> siswa akan diexport
            </div>
            <button @click="exportResetAll"
                    class="text-[11px] text-slate-400 hover:text-white underline">
              Reset semua
            </button>
          </div>
        </div>

        <div class="px-5 sm:px-6 py-3 border-t border-slate-800 bg-slate-950 flex justify-end gap-2 shrink-0">
          <button @click="tutupExport"
                  class="h-10 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[13px] font-semibold transition">
            Batal
          </button>
          <button @click="exportDo" :disabled="exportFinalSiswa.length === 0"
                  class="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white text-[13px] font-bold shadow-lg shadow-emerald-900/40 transition disabled:opacity-50 disabled:cursor-not-allowed">
            <Download class="w-4 h-4" />
            <span>Download {{ exportFinalSiswa.length }} Siswa</span>
          </button>
        </div>
      </div>
    </div>

  </div>
</template>
