<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '../lib/supabase'
import CustomSelect from '../components/CustomSelect.vue'
import {
  Users, Search, Printer, X, MessageSquare, BookOpen, AlertCircle, CheckCircle2,
  Plus, Trash2, UserPlus, Download
} from 'lucide-vue-next'
import { confirm } from '../lib/confirm'
import { writeXlsx } from '../lib/xlsx-lazy'

const route = useRoute()
const router = useRouter()
const type = computed(() => route.name === 'absen-nabil' ? 'nabil' : 'sorogan')

const daftarData = ref([])
const daftarGuru = ref([])
const isLoading = ref(false)
const filterGrup = ref('')
const pencarian = ref('')
const exporting = ref(false)

// Print config
const showPrintConfig = ref(false)
const printGrup = ref('')
const cfgJenis = ref('guru')
const cfgSemester = ref('Ganjil')
const cfgTahun = ref('')
const cfgGuru = ref('')
const cfgPembimbing = ref('')
const cfgKepalaSekolah = ref("ACH. MA'RUF TAMAM, S.Pd.")
const cfgTanggal = ref('')

// Tambah siswa modal
const showAddModal = ref(false)
const addTargetGrup = ref('')
const addSearch = ref('')
const addSelectedIds = ref([])
const addSaving = ref(false)
const allSiswa = ref([])
const semuaRelasi = ref([])

const labelGrup = computed(() => type.value === 'nabil' ? 'Kelompok Nabil' : 'Pembimbing')
const labelPrint = computed(() => type.value === 'nabil' ? 'KELOMPOK NABIL' : 'KELAS SOROGAN')
const IconMain = computed(() => type.value === 'nabil' ? MessageSquare : BookOpen)

async function loadData() {
  isLoading.value = true
  const view = type.value === 'nabil' ? 'v_nabil_lengkap' : 'v_sorogan_lengkap'
  const { data, error } = await supabase.from(view).select('*').order('nama')
  if (error) { alert(error.message); isLoading.value = false; return }
  daftarData.value = (data || []).filter(s => {
    const st = String(s.status || '').toLowerCase()
    return st === 'aktif'
  })
  isLoading.value = false
}

async function loadGuru() {
  const { data } = await supabase.from('guru').select('kg, nama, mapel_smt1, mapel_smt2').order('nama')
  daftarGuru.value = data || []
}

const guruOptions = computed(() => daftarGuru.value.map(g => ({ label: g.nama, value: g.nama })))
const selectedGuru = computed(() => daftarGuru.value.find(g => g.nama === cfgGuru.value))
const mapelAuto = computed(() => {
  if (!selectedGuru.value) return ''
  return cfgSemester.value === 'Ganjil' ? (selectedGuru.value.mapel_smt1 || '') : (selectedGuru.value.mapel_smt2 || '')
})

watch([cfgGuru, cfgSemester], () => { cfgGuru.value && (cfgGuru.value = cfgGuru.value) })

const grupOptions = computed(() => {
  const field = type.value === 'nabil' ? 'kelompok_nabil' : 'pembimbing'
  const set = new Set()
  daftarData.value.forEach(s => { if (s[field]) set.add(s[field]) })
  return Array.from(set).sort().map(v => ({ label: v, value: v }))
})

const addGrupOptions = computed(() => {
  const existing = grupOptions.value
  if (type.value === 'nabil') {
    const defaults = ['A','B','C','D','E'].map(k => ({ label: k, value: k }))
    const merged = new Map(defaults.map(o => [o.value, o]))
    existing.forEach(o => merged.set(o.value, o))
    return Array.from(merged.values()).sort((a, b) => String(a.value).localeCompare(String(b.value)))
  }
  return existing
})

const siswaBisaDipilih = computed(() => {
  if (!addTargetGrup.value) return []
  const field = type.value === 'nabil' ? 'kelompok_nabil' : 'pembimbing'
  const target = String(addTargetGrup.value).trim()
  const sudahAda = new Set(
    semuaRelasi.value
      .filter(r => String(r[field] || '').trim() === target)
      .map(r => r.no_induk)
  )
  return allSiswa.value.filter(s => !sudahAda.has(s.no_induk))
})

const siswaBisaDipilihFiltered = computed(() => {
  const kw = addSearch.value.toLowerCase().trim()
  const list = siswaBisaDipilih.value
  if (!kw) return list
  return list.filter(s =>
    (s.nama || '').toLowerCase().includes(kw) ||
    (s.no_induk || '').toLowerCase().includes(kw)
  )
})

const addTotalSelected = computed(() => addSelectedIds.value.length)

async function bukaModalTambah() {
  showAddModal.value = true
  addTargetGrup.value = filterGrup.value || ''
  addSearch.value = ''
  addSelectedIds.value = []

  const [rSiswa, rRelasi] = await Promise.all([
    supabase.from('siswa').select('no_induk, nama, kelas, status').order('nama'),
    supabase.from(type.value === 'nabil' ? 'nabil' : 'sorogan')
      .select(type.value === 'nabil' ? 'no_induk, kelompok_nabil' : 'no_induk, pembimbing')
  ])
  allSiswa.value = (rSiswa.data || []).filter(s => String(s.status || '').toLowerCase().trim() === 'aktif')
  semuaRelasi.value = rRelasi.data || []
}

function tutupModalTambah() {
  showAddModal.value = false
}

function toggleAddSiswa(noInduk) {
  const i = addSelectedIds.value.indexOf(noInduk)
  if (i >= 0) addSelectedIds.value.splice(i, 1)
  else addSelectedIds.value.push(noInduk)
}

function addPilihSemua(v) {
  if (v) addSelectedIds.value = siswaBisaDipilihFiltered.value.map(s => s.no_induk)
  else addSelectedIds.value = []
}

async function simpanTambah() {
  if (!addTargetGrup.value || addSelectedIds.value.length === 0) return
  addSaving.value = true
  try {
    const field = type.value === 'nabil' ? 'kelompok_nabil' : 'pembimbing'
    const table = type.value === 'nabil' ? 'nabil' : 'sorogan'
    const grup = String(addTargetGrup.value).trim()
    const rows = addSelectedIds.value.map(ni => ({ no_induk: ni, [field]: grup }))

    const { error } = await supabase.from(table).insert(rows)
    if (error) throw error

    alert(`Berhasil menambahkan ${rows.length} siswa ke ${labelGrup.value} "${grup}"`)
    showAddModal.value = false
    await loadData()
  } catch (err) {
    alert('Gagal menambah: ' + err.message)
  } finally {
    addSaving.value = false
  }
}

async function keluarkanSiswa(item) {
  const field = type.value === 'nabil' ? 'kelompok_nabil' : 'pembimbing'
  const grup = type.value === 'nabil' ? item.kelompok_nabil : item.pembimbing
  const ok = await confirm({
    title: 'Keluarkan dari ' + labelGrup.value,
    message: `Keluarkan "${item.nama}" dari ${labelGrup.value} "${grup}"?\n\nData siswa di DB induk TIDAK terhapus, hanya relasi grupnya.`,
    variant: 'warning',
    confirmText: 'Ya, Keluarkan'
  })
  if (!ok) return

  const table = type.value === 'nabil' ? 'nabil' : 'sorogan'
  const { error } = await supabase.from(table).delete().eq('id', item.id)
  if (error) return alert('Gagal: ' + error.message)
  await loadData()
}

const dataFiltered = computed(() => {
  const field = type.value === 'nabil' ? 'kelompok_nabil' : 'pembimbing'
  let list = daftarData.value
  if (filterGrup.value) list = list.filter(s => s[field] === filterGrup.value)
  const kw = pencarian.value.toLowerCase().trim()
  if (kw) list = list.filter(s => (s.nama || '').toLowerCase().includes(kw) || (s.no_induk || '').toLowerCase().includes(kw))
  return list
})

const stats = computed(() => {
  const field = type.value === 'nabil' ? 'kelompok_nabil' : 'pembimbing'
  const set = new Set(daftarData.value.map(s => s[field]).filter(Boolean))
  return { total: daftarData.value.length, grup: set.size }
})

function openPrintConfig(grup) {
  printGrup.value = grup
  cfgJenis.value = 'guru'
  cfgSemester.value = 'Ganjil'
  cfgTahun.value = ''
  cfgGuru.value = ''
  cfgPembimbing.value = type.value === 'sorogan' ? grup : ''
  cfgKepalaSekolah.value = "ACH. MA'RUF TAMAM, S.Pd."
  cfgTanggal.value = ''
  showPrintConfig.value = true
}

function goPrint() {
  if (!printGrup.value) return
  const params = new URLSearchParams({
    jenis: cfgJenis.value,
    semester: cfgSemester.value,
    tahun: cfgTahun.value,
    guru: cfgGuru.value,
    pembimbing: cfgPembimbing.value,
    kepalaSekolah: cfgKepalaSekolah.value,
    tanggal: cfgTanggal.value
  })
  router.push(`/print/absensi/${type.value}/${encodeURIComponent(printGrup.value)}?${params.toString()}`)
  showPrintConfig.value = false
}

async function exportXlsx() {
  if (dataFiltered.value.length === 0) return alert('Tidak ada data untuk di-export')
  exporting.value = true
  try {
    const field = type.value === 'nabil' ? 'kelompok_nabil' : 'pembimbing'
    const label = type.value === 'nabil' ? 'Kelompok Nabil' : 'Pembimbing'
    const aoa = [
      ['No', 'No Induk', 'Nama', 'Kelas', 'Alamat', label],
      ...dataFiltered.value.map((s, i) => [
        i + 1, s.no_induk, s.nama, s.kelas || '', s.alamat || '', s[field] || ''
      ])
    ]
    await writeXlsx({
      aoa,
      cols: [{ wch: 5 }, { wch: 12 }, { wch: 30 }, { wch: 8 }, { wch: 35 }, { wch: 18 }],
      sheetName: type.value === 'nabil' ? 'Nabil' : 'Sorogan',
      filename: `Absensi_${type.value === 'nabil' ? 'Nabil' : 'Sorogan'}_${new Date().toISOString().slice(0,10)}.xlsx`
    })
  } catch (e) {
    alert('Gagal export: ' + e.message)
  } finally {
    exporting.value = false
  }
}

watch(type, () => { filterGrup.value = ''; loadData() })
onMounted(() => { loadData(); loadGuru() })
</script>

<template>
  <div class="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-5">
    <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-purple-900/40">
          <component :is="IconMain" class="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 class="text-2xl md:text-3xl font-bold text-white tracking-tight">
            Absensi {{ type === 'nabil' ? 'Nabil' : 'Sorogan' }}
          </h1>
          <p class="text-sm text-slate-500 mt-1">
            {{ type === 'nabil' ? 'Forum penelitian masalah (Bahtsul Masail)' : 'Kelas sorogan kitab kuning' }} •
            <span class="text-emerald-400 font-semibold">{{ stats.total }}</span> siswa aktif
          </p>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
      <div class="rounded-2xl border border-slate-800 bg-slate-900/50 p-3.5">
        <div class="flex items-center gap-2 text-slate-500 text-[10.5px] font-bold uppercase tracking-wider mb-1.5">
          <Users class="w-3.5 h-3.5" /> Total Siswa
        </div>
        <div class="text-2xl font-bold text-white">{{ stats.total }}</div>
      </div>
      <div class="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3.5">
        <div class="flex items-center gap-2 text-emerald-400 text-[10.5px] font-bold uppercase tracking-wider mb-1.5">
          <CheckCircle2 class="w-3.5 h-3.5" /> {{ labelGrup }}
        </div>
        <div class="text-2xl font-bold text-emerald-400">{{ stats.grup }}</div>
      </div>
    </div>

    <div class="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-3">
      <div class="grid grid-cols-1 md:grid-cols-12 gap-2.5">
        <div class="md:col-span-5 relative">
            <Search class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            <input v-model="pencarian" type="text" placeholder="Cari nama atau no induk..."
                class="w-full h-10 pl-10 pr-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white placeholder-slate-500 outline-none focus:border-emerald-500/60" />
        </div>
        <div class="md:col-span-3">
            <CustomSelect v-model="filterGrup" :options="grupOptions" :placeholder="'Semua ' + labelGrup" searchable />
        </div>
        <div class="md:col-span-2 flex items-end">
            <button @click="bukaModalTambah"
                    class="w-full h-10 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[13px] font-semibold flex items-center justify-center gap-1.5 transition">
            <UserPlus class="w-4 h-4" /> Tambah
            </button>
        </div>
        <div class="md:col-span-2 flex items-end gap-1.5">
            <button @click="exportXlsx" :disabled="exporting" title="Export ke Excel"
                    class="h-10 w-10 shrink-0 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 flex items-center justify-center transition disabled:opacity-50">
            <Download class="w-4 h-4" />
            </button>
            <button @click="filterGrup && openPrintConfig(filterGrup)" :disabled="!filterGrup"
                    class="flex-1 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-fuchsia-600 hover:from-purple-400 hover:to-fuchsia-500 text-white text-[13px] font-bold shadow-lg shadow-purple-900/40 flex items-center justify-center gap-1.5 disabled:opacity-40 transition">
            <Printer class="w-4 h-4" /> Cetak
            </button>
        </div>
      </div>
    </div>

    <div class="rounded-2xl border border-slate-800/80 bg-slate-900/50 overflow-hidden">
      <div class="px-4 py-3 border-b border-slate-800/80 bg-slate-950/40 text-xs text-slate-400">
        Menampilkan <b class="text-slate-200">{{ dataFiltered.length }}</b> siswa
      </div>
      <div class="overflow-y-auto" style="max-height: 65vh;">
        <table class="w-full text-sm" style="table-layout: fixed;">
          <thead class="bg-slate-950 border-b border-slate-800 sticky top-0 z-10">
            <tr>
              <th class="w-12 px-2 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">No</th>
              <th class="w-24 px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">No Induk</th>
              <th class="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">Nama</th>
              <th class="w-20 px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">Kelas</th>
              <th class="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">Alamat</th>
              <th class="w-40 px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-purple-400">{{ labelGrup }}</th>
              <th class="w-24 px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800/60">
            <tr v-if="isLoading"><td colspan="7" class="px-4 py-16 text-center text-slate-500">Memuat...</td></tr>
            <tr v-else-if="dataFiltered.length === 0"><td colspan="7" class="px-4 py-16 text-center text-slate-500 text-sm">Tidak ada data</td></tr>
            <tr v-for="(s, idx) in dataFiltered" :key="s.id" class="hover:bg-slate-800/40 transition">
              <td class="px-2 py-3 text-center text-slate-500 text-xs tabular-nums">{{ idx + 1 }}</td>
              <td class="px-3 py-3 font-mono text-[11.5px] font-semibold text-slate-300">{{ s.no_induk }}</td>
              <td class="px-3 py-3 font-semibold text-white text-[13px] truncate">{{ s.nama }}</td>
              <td class="px-3 py-3 text-center">
                <span class="inline-flex px-2 py-0.5 rounded-md bg-slate-800 text-slate-200 font-mono text-[10.5px] font-semibold">{{ s.kelas || '—' }}</span>
              </td>
              <td class="px-3 py-3 text-slate-500 text-[12px] truncate">{{ s.alamat || '—' }}</td>
              <td class="px-3 py-3 text-purple-300 font-semibold text-[12px] truncate">{{ type === 'nabil' ? s.kelompok_nabil : s.pembimbing }}</td>
              <td class="px-3 py-3 text-center">
                <button @click="keluarkanSiswa(s)"
                        class="inline-flex items-center gap-1 px-2 h-7 rounded-md bg-red-500/15 hover:bg-red-500 text-red-400 hover:text-white text-[11px] font-semibold transition"
                        title="Keluarkan dari grup">
                    <Trash2 class="w-3 h-3" /> Keluar
                </button>
                </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Print Config Modal -->
    <div v-if="showPrintConfig" class="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div class="modal-standard bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        <div class="px-5 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center">
              <Printer class="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 class="text-base font-bold text-white">Pengaturan Cetak</h3>
              <p class="text-[11px] text-slate-400">{{ labelGrup }}: <b class="text-purple-400">{{ printGrup }}</b></p>
            </div>
          </div>
          <button @click="showPrintConfig = false" class="w-9 h-9 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition">
            <X class="w-4 h-4" />
          </button>
        </div>

        <div class="p-5 space-y-3 text-xs flex-1 overflow-y-auto">
          <div>
            <label class="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">Jenis Absen</label>
            <div class="grid grid-cols-2 gap-2">
              <button @click="cfgJenis = 'guru'" :class="cfgJenis === 'guru' ? 'border-purple-500/60 bg-purple-500/10 text-purple-300' : 'border-slate-800 text-slate-300'" class="h-10 rounded-lg border font-semibold text-[12px] transition">Pegangan Guru</button>
              <button @click="cfgJenis = 'murid'" :class="cfgJenis === 'murid' ? 'border-purple-500/60 bg-purple-500/10 text-purple-300' : 'border-slate-800 text-slate-300'" class="h-10 rounded-lg border font-semibold text-[12px] transition">Pegangan Murid</button>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">Semester</label>
              <select v-model="cfgSemester" class="w-full h-10 bg-slate-950 border border-slate-800 rounded-lg px-3 text-[13px] text-white outline-none focus:border-purple-500/60">
                <option value="Ganjil">Ganjil</option><option value="Genap">Genap</option>
              </select>
            </div>
            <div>
              <label class="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">Tahun Pelajaran</label>
              <input v-model="cfgTahun" type="text" placeholder="2025/2026" class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white outline-none focus:border-purple-500/60" />
            </div>
          </div>

          <div v-if="type === 'nabil'">
            <label class="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">Guru Pengampu</label>
            <CustomSelect v-model="cfgGuru" :options="guruOptions" placeholder="Pilih guru (opsional)" searchable />
            <p v-if="mapelAuto" class="text-[10px] mt-1 text-slate-500">Mapel: <b class="text-emerald-400">{{ mapelAuto }}</b></p>
          </div>

          <div v-if="type === 'sorogan'">
            <label class="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">Pembimbing</label>
            <input v-model="cfgPembimbing" type="text" class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white outline-none focus:border-purple-500/60" />
          </div>

          <div>
            <label class="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">Kepala Sekolah</label>
            <input v-model="cfgKepalaSekolah" type="text" class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white outline-none focus:border-purple-500/60" />
          </div>

          <div>
            <label class="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">Tanggal Cetak (opsional)</label>
            <input v-model="cfgTanggal" type="text" placeholder="Otomatis: hari ini" class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white outline-none focus:border-purple-500/60" />
          </div>
        </div>

        <div class="px-5 py-3 border-t border-slate-800 bg-slate-950 flex justify-end gap-2 shrink-0">
          <button @click="showPrintConfig = false" class="h-10 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[13px] font-semibold transition">Batal</button>
          <button @click="goPrint" class="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-gradient-to-br from-purple-500 to-fuchsia-600 hover:from-purple-400 hover:to-fuchsia-500 text-white text-[13px] font-bold shadow-lg shadow-purple-900/40 transition">
            <Printer class="w-4 h-4" /> Buka Cetak
          </button>
        </div>
      </div>
    </div>

    <!-- ═══════ ADD MODAL ═══════ -->
    <div v-if="showAddModal" class="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
    <div class="modal-standard bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col">
        <div class="px-5 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center">
            <UserPlus class="w-5 h-5 text-purple-400" />
            </div>
            <div>
            <h3 class="text-base font-bold text-white">Tambah Siswa ke {{ labelGrup }}</h3>
            <p class="text-[11px] text-slate-400">Pilih siswa aktif yang belum ada di grup terpilih</p>
            </div>
        </div>
        <button @click="tutupModalTambah" class="w-9 h-9 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition">
            <X class="w-4 h-4" />
        </button>
        </div>

        <div class="flex-1 overflow-y-auto p-5 space-y-3 text-xs">
        <div>
            <label class="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">Pilih {{ labelGrup }}</label>
            <CustomSelect v-model="addTargetGrup" :options="addGrupOptions" :placeholder="'Pilih ' + labelGrup" searchable />
            <p v-if="!addTargetGrup" class="text-[10px] mt-1 text-slate-500">Pilih grup dulu untuk mulai memilih siswa</p>
        </div>

        <div v-if="addTargetGrup">
            <div class="flex items-center justify-between mb-1.5">
            <label class="block text-[11px] font-bold text-slate-400 uppercase">Pilih Siswa</label>
            <div class="flex items-center gap-2">
                <button @click="addPilihSemua(true)" class="text-[10px] text-emerald-400 hover:text-emerald-300 underline font-semibold">Pilih Semua</button>
                <button @click="addPilihSemua(false)" class="text-[10px] text-slate-400 hover:text-white underline font-semibold">Kosongkan</button>
            </div>
            </div>
            <div class="relative mb-2">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input v-model="addSearch" type="text" placeholder="Cari nama atau no induk..."
                    class="w-full h-9 pl-9 pr-8 bg-slate-950 border border-slate-800 rounded-lg text-[12px] text-white placeholder-slate-500 outline-none focus:border-purple-500/60" />
            <button v-if="addSearch" @click="addSearch = ''"
                    class="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 flex items-center justify-center">
                <X class="w-3 h-3" />
            </button>
            </div>

            <div class="max-h-[45vh] overflow-y-auto border border-slate-800 rounded-lg p-1">
            <label v-for="s in siswaBisaDipilihFiltered" :key="s.no_induk"
                    class="flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-slate-800/60 cursor-pointer transition">
                <input type="checkbox" :checked="addSelectedIds.includes(s.no_induk)"
                    @change="toggleAddSiswa(s.no_induk)" class="accent-purple-500 w-3.5 h-3.5 shrink-0" />
                <span class="text-xs text-white font-semibold truncate flex-1">{{ s.nama }}</span>
                <span class="text-[10px] text-slate-500 font-mono shrink-0">{{ s.no_induk }}</span>
                <span v-if="s.kelas" class="text-[10px] text-slate-400 shrink-0">{{ s.kelas }}</span>
            </label>
            <div v-if="siswaBisaDipilihFiltered.length === 0" class="text-center text-[11px] text-slate-500 py-8">
                {{ addSearch ? 'Tidak ada siswa yang cocok' : 'Semua siswa aktif sudah ada di grup ini' }}
            </div>
            </div>
        </div>
        </div>

        <div class="px-5 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between shrink-0">
        <div class="text-xs text-slate-400">
            <b class="text-purple-400">{{ addTotalSelected }}</b> siswa dipilih
        </div>
        <div class="flex gap-2">
            <button @click="tutupModalTambah" class="h-10 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[13px] font-semibold transition">Batal</button>
            <button @click="simpanTambah" :disabled="addSaving || !addTargetGrup || addTotalSelected === 0"
                    class="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-gradient-to-br from-purple-500 to-fuchsia-600 hover:from-purple-400 hover:to-fuchsia-500 text-white text-[13px] font-bold shadow-lg shadow-purple-900/40 transition disabled:opacity-50 disabled:cursor-not-allowed">
            <Plus class="w-4 h-4" />
            {{ addSaving ? 'Menyimpan...' : `Tambah ${addTotalSelected} Siswa` }}
            </button>
        </div>
        </div>
    </div>
    </div>
  </div>
</template>