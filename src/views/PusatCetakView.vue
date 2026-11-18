<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../lib/supabase'
import CustomSelect from '../components/CustomSelect.vue'
import { FileText, Scroll, Book, Users, Sparkles, BookOpen, Printer, X, Search, ChevronRight } from 'lucide-vue-next'
import { isSiswaAktif } from '../lib/status'

const router = useRouter()

const daftarSiswa = ref([])
const daftarKelas = ref([])
const daftarKelasNabil = ref([])
const daftarPembimbing = ref([])

const isSelectOpen = ref(false)
const selectedType = ref('')
const searchSiswa = ref('')
const selectedSiswa = ref('')
const selectedSmt = ref('1')
const selectedKelas = ref('')

const cfgType = {
  'raport':        { title: 'Cetak Raport',   sub: 'Pilih siswa & semester', icon: FileText, color: 'emerald' },
  'ijazah':        { title: 'Cetak Ijazah',   sub: 'Transkrip nilai DKN',    icon: Scroll,   color: 'blue' },
  'bukuinduk':     { title: 'Cetak Buku Induk', sub: 'Biodata lengkap',      icon: Book,     color: 'purple' },
  'absen-kelas':   { title: 'Absensi Kelas',  sub: 'Pilih kelas',            icon: Users,    color: 'emerald' },
  'absen-nabil':   { title: 'Absensi Nabil',  sub: 'Pilih kelompok',         icon: Sparkles, color: 'purple' },
  'absen-sorogan': { title: 'Absensi Sorogan', sub: 'Pilih pembimbing',      icon: BookOpen, color: 'amber' },
}

const semesterOptions = [
  { label: 'Semester 1 (Kelas X - Ganjil)',   value: '1' },
  { label: 'Semester 2 (Kelas X - Genap)',    value: '2' },
  { label: 'Semester 3 (Kelas XI - Ganjil)',  value: '3' },
  { label: 'Semester 4 (Kelas XI - Genap)',   value: '4' },
  { label: 'Semester 5 (Kelas XII - Ganjil)', value: '5' },
  { label: 'Semester 6 (Kelas XII - Genap)',  value: '6' },
]

const currentCfg = computed(() => cfgType[selectedType.value] || {})
const isSiswaType = computed(() => ['raport', 'ijazah', 'bukuinduk'].includes(selectedType.value))

const labelPilihan = computed(() =>
  selectedType.value === 'absen-kelas' ? 'Kelas'
  : selectedType.value === 'absen-nabil' ? 'Kelompok Nabil'
  : 'Pembimbing'
)
const opsiPilihan = computed(() => {
  const list =
    selectedType.value === 'absen-kelas' ? daftarKelas.value
    : selectedType.value === 'absen-nabil' ? daftarKelasNabil.value
    : daftarPembimbing.value
  return list.map(v => ({ label: v, value: v }))
})

const warnaClass = (c) => ({
  emerald: 'bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white',
  blue:    'bg-blue-500/10 text-blue-400 group-hover:bg-blue-500 group-hover:text-white',
  purple:  'bg-purple-500/10 text-purple-400 group-hover:bg-purple-500 group-hover:text-white',
  amber:   'bg-amber-500/10 text-amber-400 group-hover:bg-amber-500 group-hover:text-white',
}[c] || 'bg-slate-700 text-slate-300')

const siswaFiltered = computed(() => {
  const kw = searchSiswa.value.toLowerCase().trim()
  const list = !kw ? daftarSiswa.value : daftarSiswa.value.filter(s =>
    (s.nama || '').toLowerCase().includes(kw) || (s.no_induk || '').toLowerCase().includes(kw)
  )
  return list.slice(0, 50)
})

const openSelector = (type) => {
  selectedType.value = type
  searchSiswa.value = ''
  selectedSiswa.value = ''
  selectedSmt.value = '1'
  selectedKelas.value = ''
  isSelectOpen.value = true
}

const proceed = () => {
  const type = selectedType.value
  if (isSiswaType.value && !selectedSiswa.value) return alert('Pilih siswa terlebih dahulu.')
  if (!isSiswaType.value && !selectedKelas.value) return alert('Pilih data terlebih dahulu.')

  isSelectOpen.value = false
  if (type === 'raport') router.push(`/print/raport/${selectedSiswa.value}/${selectedSmt.value}`)
  else if (type === 'ijazah') router.push(`/print/ijazah/${selectedSiswa.value}`)
  else if (type === 'bukuinduk') router.push(`/print/bukuinduk/${selectedSiswa.value}`)
  else if (type === 'absen-kelas') router.push(`/print/absensi/kelas/${encodeURIComponent(selectedKelas.value)}`)
  else if (type === 'absen-nabil') router.push(`/print/absensi/nabil/${encodeURIComponent(selectedKelas.value)}`)
  else if (type === 'absen-sorogan') router.push(`/print/absensi/sorogan/${encodeURIComponent(selectedKelas.value)}`)
}

// Sort kelas: X → XI → XII, sisanya di akhir
function sortKelas(a, b) {
  const urut = { X: 1, XI: 2, XII: 3 }
  const ap = (a.match(/^(XII|XI|X)/) || [''])[0]
  const bp = (b.match(/^(XII|XI|X)/) || [''])[0]
  return (urut[ap] || 99) - (urut[bp] || 99) || a.localeCompare(b)
}

onMounted(async () => {
  // Sumber data disamakan dengan halaman Absensi:
  // - kelas dari siswa (aktif)
  // - nabil dari v_nabil_lengkap (aktif)
  // - sorogan dari v_sorogan_lengkap (aktif)
  const [rSiswa, rNabil, rSorogan] = await Promise.all([
    supabase.from('siswa').select('no_induk, nama, kelas, status').order('nama'),
    supabase.from('v_nabil_lengkap').select('kelompok_nabil, status'),
    supabase.from('v_sorogan_lengkap').select('pembimbing, status'),
  ])

  if (rSiswa.data) {
    daftarSiswa.value = rSiswa.data
    daftarKelas.value = Array.from(new Set(
      rSiswa.data.filter(s => isSiswaAktif(s)).map(s => (s.kelas || '').trim()).filter(Boolean)
    )).sort(sortKelas)
  }
  if (rNabil.data) {
    daftarKelasNabil.value = Array.from(new Set(
      rNabil.data.filter(n => isSiswaAktif(n)).map(n => (n.kelompok_nabil || '').trim()).filter(Boolean)
    )).sort((a, b) => a.localeCompare(b))
  }
  if (rSorogan.data) {
    daftarPembimbing.value = Array.from(new Set(
      rSorogan.data.filter(s => isSiswaAktif(s)).map(s => (s.pembimbing || '').trim()).filter(Boolean)
    )).sort((a, b) => a.localeCompare(b))
  }
})
</script>

<template>
  <div class="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6 fade-in-up">

    <div>
      <h1 class="text-2xl md:text-3xl font-bold text-white tracking-tight">Pusat Cetak</h1>
      <p class="text-sm text-slate-500 mt-1">Cetak semua dokumen akademik dalam satu tempat</p>
    </div>

    <!-- DOKUMEN SISWA -->
    <div>
      <h2 class="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3 px-1">Dokumen Siswa</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <button v-for="type in ['raport','ijazah','bukuinduk']" :key="type"
                @click="openSelector(type)"
                class="group relative overflow-hidden p-5 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-emerald-500/40 text-left transition-all hover:bg-slate-900/80">
          <div class="flex items-start gap-4">
            <div class="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all" :class="warnaClass(cfgType[type].color)">
              <component :is="cfgType[type].icon" class="w-5 h-5" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="text-[14px] font-bold text-white mb-1">{{ cfgType[type].title }}</div>
              <div class="text-[11.5px] text-slate-500">{{ cfgType[type].sub }}</div>
            </div>
            <ChevronRight class="w-4 h-4 text-slate-600 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all self-center shrink-0" />
          </div>
        </button>
      </div>
    </div>

    <!-- ABSENSI -->
    <div>
      <h2 class="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3 px-1">Absensi</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <button v-for="type in ['absen-kelas','absen-nabil','absen-sorogan']" :key="type"
                @click="openSelector(type)"
                class="group relative overflow-hidden p-5 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-emerald-500/40 text-left transition-all hover:bg-slate-900/80">
          <div class="flex items-start gap-4">
            <div class="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all" :class="warnaClass(cfgType[type].color)">
              <component :is="cfgType[type].icon" class="w-5 h-5" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="text-[14px] font-bold text-white mb-1">{{ cfgType[type].title }}</div>
              <div class="text-[11.5px] text-slate-500">{{ cfgType[type].sub }}</div>
            </div>
            <ChevronRight class="w-4 h-4 text-slate-600 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all self-center shrink-0" />
          </div>
        </button>
      </div>
    </div>

    <!-- MODAL PEMILIHAN -->
    <div v-if="isSelectOpen" class="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div class="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col fade-in-up">

        <!-- Header -->
        <div class="px-5 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div>
            <h3 class="text-[15px] font-bold text-white">{{ currentCfg.title }}</h3>
            <p class="text-[11px] text-slate-500">{{ currentCfg.sub }}</p>
          </div>
          <button @click="isSelectOpen = false" class="p-2 rounded-lg text-slate-500 hover:bg-slate-800 hover:text-white transition">
            <X class="w-4 h-4" />
          </button>
        </div>

        <!-- Body -->
        <div class="p-5 overflow-y-auto flex-1 space-y-3">

          <!-- Pilihan Siswa -->
          <template v-if="isSiswaType">
            <div class="relative">
              <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              <input v-model="searchSiswa" type="text" placeholder="Cari nama atau no induk..."
                     class="w-full h-10 pl-10 pr-3 bg-slate-950/60 border border-slate-800 rounded-lg text-[13px] text-white placeholder-slate-500 focus:border-emerald-500/60 outline-none">
            </div>
            <div class="max-h-[300px] overflow-y-auto space-y-1 rounded-xl border border-slate-800 bg-slate-950/40 p-1.5">
              <button v-for="s in siswaFiltered" :key="s.no_induk"
                      @click="selectedSiswa = s.no_induk"
                      class="w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-center justify-between gap-2"
                      :class="selectedSiswa === s.no_induk ? 'bg-emerald-500/15 text-emerald-300' : 'hover:bg-slate-800/60 text-slate-300'">
                <div class="min-w-0 flex-1">
                  <div class="text-[13px] font-semibold truncate">{{ s.nama }}</div>
                  <div class="text-[11px] text-slate-500 font-mono">{{ s.no_induk }} • {{ s.kelas || '—' }}</div>
                </div>
                <div v-if="selectedSiswa === s.no_induk" class="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></div>
              </button>
              <div v-if="siswaFiltered.length === 0" class="p-4 text-center text-[12px] text-slate-500">
                Tidak ada siswa ditemukan
              </div>
            </div>
            <div v-if="selectedType === 'raport'">
              <label class="block text-[11px] font-semibold text-slate-400 mb-1.5">Semester</label>
              <CustomSelect v-model="selectedSmt" :options="semesterOptions" placeholder="Pilih semester" />
            </div>
          </template>

          <!-- Pilihan Kelas/Nabil/Sorogan -->
          <template v-else>
            <div>
              <label class="block text-[11px] font-semibold text-slate-400 mb-1.5">{{ labelPilihan }}</label>
              <CustomSelect v-model="selectedKelas" :options="opsiPilihan" :placeholder="'Pilih ' + labelPilihan" searchable />
            </div>
          </template>

        </div>

        <!-- Footer -->
        <div class="px-5 py-3 border-t border-slate-800 flex justify-end gap-2 shrink-0">
          <button @click="isSelectOpen = false" class="h-10 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[13px] font-semibold transition">
            Batal
          </button>
          <button @click="proceed" class="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white text-[13px] font-bold shadow-lg shadow-emerald-900/40 transition">
            <Printer class="w-4 h-4" /> Buka Cetak
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
