<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../lib/supabase'
import CustomSelect from '../components/CustomSelect.vue'
import {
  Users, Search, Printer, X, ClipboardCheck, AlertCircle, CheckCircle2, Calendar, Download
} from 'lucide-vue-next'
import { writeXlsx } from '../lib/xlsx-lazy'
import { isSiswaAktif } from '../lib/status'

const router = useRouter()
const daftarSiswa = ref([])
const isLoading = ref(false)
const daftarGuru = ref([])
const filterKelas = ref('')
const pencarian = ref('')
const exporting = ref(false)

const pageSize = ref(25)
const currentPage = ref(1)
const pageSizeOptions = [
  { label: '10 / hal', value: 10 },
  { label: '25 / hal', value: 25 },
  { label: '50 / hal', value: 50 },
  { label: '100 / hal', value: 100 }
]

// Config modal
const showPrintConfig = ref(false)
const printKelas = ref('')
const cfgJenis = ref('guru')
const cfgSemester = ref('Ganjil')
const cfgTahun = ref('')
const cfgMapel = ref('')
const cfgGuru = ref('')
const cfgWaliKelas = ref('')
const cfgKepalaSekolah = ref("ACH. MA'RUF TAMAM, S.Pd.")
const cfgTanggal = ref('')

async function loadGuru() {
  const { data } = await supabase.from('guru')
    .select('kg, nama, mapel_smt1, mapel_smt2')
    .order('nama')
  daftarGuru.value = data || []
}

const guruOptions = computed(() =>
  daftarGuru.value.map(g => ({ label: g.nama, value: g.nama }))
)

const selectedGuru = computed(() =>
  daftarGuru.value.find(g => g.nama === cfgGuru.value)
)

watch([cfgGuru, cfgSemester], () => {
  if (!selectedGuru.value) return
  const mapel = cfgSemester.value === 'Ganjil'
    ? selectedGuru.value.mapel_smt1
    : selectedGuru.value.mapel_smt2
  cfgMapel.value = mapel || ''
})

async function loadData() {
  isLoading.value = true
  const { data, error } = await supabase
    .from('siswa')
    .select('no_induk, nama, kelas, alamat, status')
    .order('nama')
  if (error) { alert(error.message); isLoading.value = false; return }
  daftarSiswa.value = data || []
  isLoading.value = false
}

const kelasOptions = computed(() => {
  const set = new Set()
  daftarSiswa.value.forEach(s => {
    if (isSiswaAktif(s)) set.add(s.kelas.trim())
  })
  return Array.from(set).sort((a, b) => {
    const urut = { X: 1, XI: 2, XII: 3 }
    const ap = (a.match(/^(XII|XI|X)/) || [''])[0]
    const bp = (b.match(/^(XII|XI|X)/) || [''])[0]
    return (urut[ap] || 99) - (urut[bp] || 99) || a.localeCompare(b)
  }).map(k => ({ label: k, value: k }))
})

const siswaFiltered = computed(() => {
  // MENGUBAH FILTER: Pakai fungsi baru, bukan fungsi lokal
  let list = daftarSiswa.value.filter(s => isSiswaAktif(s)) 
  
  if (filterKelas.value) list = list.filter(s => String(s.kelas || '').trim() === filterKelas.value)
  
  const kw = pencarian.value.toLowerCase().trim()
  if (kw) {
    list = list.filter(s =>
      (s.nama || '').toLowerCase().includes(kw) || (s.no_induk || '').toLowerCase().includes(kw)
    )
  }
  return list
})

const totalHalaman = computed(() => Math.max(1, Math.ceil(siswaFiltered.value.length / pageSize.value)))
const siswaPaged = computed(() => {
  const m = (currentPage.value - 1) * pageSize.value
  return siswaFiltered.value.slice(m, m + pageSize.value)
})

watch([pencarian, filterKelas, pageSize], () => { currentPage.value = 1 })
watch(totalHalaman, () => { if (currentPage.value > totalHalaman.value) currentPage.value = 1 })

const stats = computed(() => {
  // MENGUBAH STATS: Pakai fungsi baru
  const aktif = daftarSiswa.value.filter(s => isSiswaAktif(s))
  const kelasSet = new Set(aktif.map(s => s.kelas).filter(Boolean))
  return { total: aktif.length, kelas: kelasSet.size }
})

function openPrintConfig(kelas) {
  printKelas.value = kelas
  cfgJenis.value = 'guru'
  cfgSemester.value = 'Ganjil'
  cfgTahun.value = ''
  cfgMapel.value = ''
  cfgGuru.value = ''
  cfgWaliKelas.value = ''
  cfgKepalaSekolah.value = "ACH. MA'RUF TAMAM, S.Pd."
  cfgTanggal.value = ''
  showPrintConfig.value = true
}

function goPrint() {
  if (!printKelas.value) return
  const params = new URLSearchParams({
    jenis: cfgJenis.value,
    semester: cfgSemester.value,
    tahun: cfgTahun.value,
    mapel: cfgMapel.value,
    guru: cfgGuru.value,
    waliKelas: cfgWaliKelas.value,
    kepalaSekolah: cfgKepalaSekolah.value,
    tanggal: cfgTanggal.value
  })
  router.push(`/print/absensi/kelas/${encodeURIComponent(printKelas.value)}?${params.toString()}`)
  showPrintConfig.value = false
}

async function exportXlsx() {
  if (siswaFiltered.value.length === 0) return alert('Tidak ada data untuk di-export')
  exporting.value = true
  try {
    const aoa = [
      ['No', 'No Induk', 'Nama', 'Kelas', 'Alamat'],
      ...siswaFiltered.value.map((s, i) => [
        i + 1, s.no_induk, s.nama, s.kelas || '', s.alamat || ''
      ])
    ]
    await writeXlsx({
      aoa,
      cols: [{ wch: 5 }, { wch: 12 }, { wch: 30 }, { wch: 8 }, { wch: 35 }],
      sheetName: filterKelas.value || 'Absensi',
      filename: `Absensi_Kelas_${filterKelas.value || 'Semua'}_${new Date().toISOString().slice(0,10)}.xlsx`
    })
  } catch (e) {
    alert('Gagal export: ' + e.message)
  } finally {
    exporting.value = false
  }
}

onMounted(() => {
  loadData()
  loadGuru()
})
</script>

<template>
  <div class="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-5">
    <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl md:text-3xl font-bold text-white tracking-tight">Absensi Kelas</h1>
        <p class="text-sm text-slate-500 mt-1">
          Daftar siswa aktif per kelas •
          <span class="text-emerald-400 font-semibold">{{ stats.total }}</span> siswa aktif
        </p>
      </div>
    </div>

    <div class="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
      <div class="rounded-xl md:rounded-2xl border border-slate-800 bg-slate-900/50 p-2.5 md:p-3.5">
        <div class="flex items-center gap-1.5 text-slate-500 text-[9.5px] md:text-[10.5px] font-bold uppercase tracking-wider mb-1">
          <Users class="w-3 h-3 md:w-3.5 md:h-3.5 shrink-0" /> Siswa Aktif
        </div>
        <div class="text-lg md:text-2xl font-bold text-white leading-none">{{ stats.total }}</div>
        <div class="hidden md:block text-[10.5px] text-slate-500 mt-0.5">Bisa diabsen</div>
      </div>
      <div class="rounded-xl md:rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-2.5 md:p-3.5">
        <div class="flex items-center gap-1.5 text-emerald-400 text-[9.5px] md:text-[10.5px] font-bold uppercase tracking-wider mb-1">
          <CheckCircle2 class="w-3 h-3 md:w-3.5 md:h-3.5 shrink-0" /> Kelas Aktif
        </div>
        <div class="text-lg md:text-2xl font-bold text-emerald-400 leading-none">{{ stats.kelas }}</div>
        <div class="hidden md:block text-[10.5px] text-slate-500 mt-0.5">Rombel terisi</div>
      </div>
      <div class="col-span-2 md:col-span-1 rounded-xl md:rounded-2xl border border-blue-500/30 bg-blue-500/5 p-2.5 md:p-3.5">
        <div class="flex items-center gap-1.5 text-blue-400 text-[9.5px] md:text-[10.5px] font-bold uppercase tracking-wider mb-1">
          <ClipboardCheck class="w-3 h-3 md:w-3.5 md:h-3.5 shrink-0" /> Fitur
        </div>
        <div class="text-[10.5px] md:text-[11px] text-slate-300 leading-tight">Cetak absen pegangan guru & murid</div>
      </div>
    </div>

    <div class="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-3">
      <div class="grid grid-cols-3 md:grid-cols-12 gap-2">
        <div class="col-span-3 md:col-span-5 relative">
          <Search class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input v-model="pencarian" type="text" placeholder="Cari nama atau no induk…"
                class="w-full h-10 pl-10 pr-10 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white placeholder:text-slate-400 outline-none focus:border-emerald-500/60" />
          <button v-if="pencarian" @click="pencarian = ''" type="button"
                  class="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition">
            <X class="w-3.5 h-3.5" />
          </button>
        </div>
        <div class="col-span-1 md:col-span-3">
          <CustomSelect v-model="filterKelas" :options="kelasOptions" placeholder="Kelas" searchable />
        </div>
        <div class="col-span-1 md:col-span-2 flex items-end">
          <button @click="exportXlsx" :disabled="exporting"
                  class="w-full h-10 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[12px] sm:text-[13px] font-semibold flex items-center justify-center gap-1 sm:gap-1.5 transition disabled:opacity-50">
            <Download class="w-4 h-4 shrink-0" /><span>Export</span>
          </button>
        </div>
        <div class="col-span-1 md:col-span-2 flex items-end">
          <button @click="filterKelas && openPrintConfig(filterKelas)"
                  :disabled="!filterKelas"
                  class="w-full h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white text-[12px] sm:text-[13px] font-bold shadow-lg shadow-emerald-900/40 flex items-center justify-center gap-1 sm:gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition">
            <Printer class="w-4 h-4 shrink-0" /><span>Cetak</span>
          </button>
        </div>
      </div>
    </div>

    <div class="rounded-2xl border border-slate-800/80 bg-slate-900/50 overflow-hidden">
      <div class="px-4 py-3 border-b border-slate-800/80 bg-slate-950/40 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div class="text-xs text-slate-400">
          Menampilkan <b class="text-slate-200">{{ siswaPaged.length }}</b> dari
          <b class="text-emerald-400">{{ siswaFiltered.length }}</b> siswa
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

      <div class="hidden md:block">
        <table class="w-full text-sm" style="table-layout: fixed;">
          <thead class="bg-slate-950 border-b border-slate-800 sticky top-0 z-10">
            <tr>
              <th class="w-12 px-2 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">No</th>
              <th class="w-24 px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">No Induk</th>
              <th class="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">Nama</th>
              <th class="w-24 px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">Kelas</th>
              <th class="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">Alamat</th>
              <th class="w-28 px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800/60">
            <tr v-if="isLoading">
              <td colspan="6" class="px-4 py-16 text-center text-slate-500">Memuat...</td>
            </tr>
            <tr v-else-if="siswaPaged.length === 0">
              <td colspan="6" class="px-4 py-16 text-center">
                <div class="text-slate-500 text-sm">Tidak ada siswa aktif</div>
                <div class="text-slate-600 text-xs mt-1">Coba ubah filter atau kata kunci</div>
              </td>
            </tr>
            <tr v-for="(s, idx) in siswaPaged" :key="s.no_induk" class="hover:bg-slate-800/40 transition">
              <td class="px-2 py-3 text-center text-slate-500 text-xs tabular-nums">{{ (currentPage - 1) * pageSize + idx + 1 }}</td>
              <td class="px-3 py-3 font-mono text-[11.5px] font-semibold text-slate-300">{{ s.no_induk }}</td>
              <td class="px-3 py-3 font-semibold text-white text-[13px] truncate">{{ s.nama }}</td>
              <td class="px-3 py-3 text-center">
                <span class="inline-flex px-2 py-0.5 rounded-md bg-slate-800 text-slate-200 font-mono text-[10.5px] font-semibold">{{ s.kelas }}</span>
              </td>
              <td class="px-3 py-3 text-slate-500 text-[12px] truncate">{{ s.alamat || '—' }}</td>
              <td class="px-3 py-3 text-center">
                <button @click="openPrintConfig(s.kelas)"
                        class="inline-flex items-center gap-1 px-2.5 h-7 rounded-md bg-emerald-500/15 hover:bg-emerald-500 text-emerald-300 hover:text-white text-[11px] font-semibold transition">
                  <Printer class="w-3 h-3" /> Cetak
                </button>
              </td>
            </tr>
                    </tbody>
        </table>
      </div>

      <!-- KARTU SISWA (KHUSUS HP) -->
      <div class="md:hidden divide-y divide-slate-800/60">
        <div v-if="isLoading" class="p-8 text-center text-slate-500 text-sm">Memuat...</div>
        <div v-else-if="siswaPaged.length === 0" class="p-8 text-center">
          <div class="text-slate-500 text-sm">Tidak ada siswa aktif</div>
          <div class="text-slate-600 text-xs mt-1">Coba ubah filter atau kata kunci</div>
        </div>
        <div v-for="(s, idx) in siswaPaged" :key="s.no_induk" class="p-3.5 active:bg-slate-800/30 transition">
          <div class="flex items-start gap-2.5">
            <div class="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {{ (s.nama || '?').charAt(0).toUpperCase() }}
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="text-[13.5px] font-bold text-white truncate">{{ s.nama || '-' }}</h3>
              <div class="flex items-center gap-1.5 mt-1 text-[11px] text-slate-500 font-mono flex-wrap">
                <span class="tabular-nums">{{ (currentPage - 1) * pageSize + idx + 1 }}.</span>
                <span>{{ s.no_induk }}</span>
                <span v-if="s.kelas" class="text-slate-600">•</span>
                <span v-if="s.kelas" class="inline-flex px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">{{ s.kelas }}</span>
              </div>
            </div>
            <button @click="openPrintConfig(s.kelas)" class="shrink-0 inline-flex items-center gap-1 h-8 px-2.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500 text-emerald-300 hover:text-white text-[11px] font-semibold active:scale-95 transition">
              <Printer class="w-3.5 h-3.5" /> Cetak
            </button>
          </div>
          <p v-if="s.alamat" class="text-[10.5px] text-slate-500 mt-1.5 truncate">{{ s.alamat }}</p>
        </div>
        </div>

      <div class="px-4 py-2 border-t border-slate-800/80 bg-slate-950/40 text-center text-[11px] text-slate-500">
        Total <b class="text-emerald-400">{{ siswaFiltered.length }}</b> siswa
      </div>
    </div>

    <!-- Print Config Modal -->
    <div v-if="showPrintConfig" class="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div class="modal-standard bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        <div class="px-5 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
            <Printer class="w-5 h-5 text-emerald-400" />
            </div>
            <div>
            <h3 class="text-base font-bold text-white">Pengaturan Cetak Absen</h3>
            <p class="text-[11px] text-slate-400">Kelas: <b class="text-emerald-400">{{ printKelas }}</b></p>
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
              <button @click="cfgJenis = 'guru'"
                      :class="cfgJenis === 'guru' ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-300' : 'border-slate-800 text-slate-300'"
                      class="h-10 rounded-lg border font-semibold text-[12px] transition">
                Pegangan Guru (15 hari)
              </button>
              <button @click="cfgJenis = 'murid'"
                      :class="cfgJenis === 'murid' ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-300' : 'border-slate-800 text-slate-300'"
                      class="h-10 rounded-lg border font-semibold text-[12px] transition">
                Pegangan Murid (6 hari × 3 jam)
              </button>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">Semester</label>
              <select v-model="cfgSemester" class="w-full h-10 bg-slate-950 border border-slate-800 rounded-lg px-3 text-[13px] text-white outline-none focus:border-emerald-500/60">
                <option value="Ganjil">Ganjil</option>
                <option value="Genap">Genap</option>
              </select>
            </div>
            <div>
              <label class="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">Tahun Pelajaran</label>
              <input v-model="cfgTahun" type="text" placeholder="2025/2026"
                     class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white outline-none focus:border-emerald-500/60" />
            </div>
          </div>

          <div>
            <label class="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">Guru Mata Pelajaran</label>
            <CustomSelect v-model="cfgGuru" :options="guruOptions" placeholder="Pilih guru" searchable />
            <p v-if="cfgGuru && selectedGuru" class="text-[10px] mt-1 text-slate-500">
              KG: {{ selectedGuru.kg }}
            </p>
          </div>

          <div>
            <label class="block text-[11px] font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1.5">
              Mata Pelajaran
              <span v-if="cfgGuru && cfgMapel" class="text-[9.5px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 normal-case tracking-normal font-bold">AUTO</span>
              <span v-else-if="cfgGuru && !cfgMapel" class="text-[9.5px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 normal-case tracking-normal font-bold">KOSONG</span>
            </label>
            <input v-model="cfgMapel" type="text" :placeholder="cfgGuru ? 'Kosong di semester ini' : 'Pilih guru dulu'"
                   :class="['w-full h-10 px-3 rounded-lg text-[13px] outline-none transition', cfgGuru ? 'bg-slate-950 border border-emerald-500/30 text-white' : 'bg-slate-950/60 border border-slate-800 text-slate-400']" />
            <p v-if="cfgGuru && !cfgMapel" class="text-[10px] mt-1 text-amber-400">
              Guru ini belum punya mapel untuk semester {{ cfgSemester }}. Isi manual atau ubah di data guru.
            </p>
            <p v-else-if="cfgGuru" class="text-[10px] mt-1 text-slate-500">
              Otomatis dari data guru. Bisa diedit manual.
            </p>
          </div>

          <div>
            <label class="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">Wali Kelas</label>
            <input v-model="cfgWaliKelas" type="text" placeholder="Nama wali kelas"
                   class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white outline-none focus:border-emerald-500/60" />
          </div>

          <div>
            <label class="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">Kepala Sekolah</label>
            <input v-model="cfgKepalaSekolah" type="text"
                   class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white outline-none focus:border-emerald-500/60" />
          </div>

          <div>
            <label class="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">Tanggal Cetak (opsional)</label>
            <input v-model="cfgTanggal" type="text" placeholder="Otomatis: hari ini"
                   class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-[13px] text-white outline-none focus:border-emerald-500/60" />
          </div>
        </div>

        <div class="px-5 py-3 border-t border-slate-800 bg-slate-950 flex justify-end gap-2 shrink-0">
          <button @click="showPrintConfig = false"
                  class="h-10 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[13px] font-semibold transition">
            Batal
          </button>
          <button @click="goPrint"
                  class="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white text-[13px] font-bold shadow-lg shadow-emerald-900/40 transition">
            <Printer class="w-4 h-4" /> Buka Cetak
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
