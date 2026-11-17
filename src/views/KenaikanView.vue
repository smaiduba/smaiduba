<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../lib/supabase'
import { confirm } from '../lib/confirm'
import CustomSelect from '../components/CustomSelect.vue'
import { parseTahunRange, deriveTahunPerTingkat } from '../lib/tahun'
import {
  ArrowUpCircle, GraduationCap, Users, CheckCircle2, AlertCircle,
  Search, ChevronRight, Save, X, RefreshCw
} from 'lucide-vue-next'

// ═══════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════
const daftarSiswa = ref([])
const isLoading = ref(false)
const processing = ref(false)

// Filter
const tahunBaru = ref('')
const kelasAsal = ref('')
const kelasTujuan = ref('')
const mode = ref('naik')   // 'naik' | 'lulus'

// Selection
const selectedIds = ref([])
const searchSiswa = ref('')

// ═══════════════════════════════════════════════
// OPTIONS
// ═══════════════════════════════════════════════
const tahunOptions = computed(() => {
  const set = new Set()
  const now = new Date().getFullYear()
  for (let y = now - 2; y <= now + 3; y++) set.add(`${y}-${y + 1}`)
  return Array.from(set).sort().reverse().map(t => ({ label: t, value: t }))
})

const kelasAsalOptions = computed(() => {
  const set = new Set()
  daftarSiswa.value.forEach(s => {
    const k = String(s.kelas || '').trim()
    if (!k) return
    if (k.toLowerCase().startsWith('lulus')) return
    set.add(k)
  })
  const urut = { SPMB: 0, X: 1, XI: 2, XII: 3 }
  return Array.from(set).sort((a, b) => {
    const ap = (a.match(/^(SPMB|XII|XI|X)/i) || [''])[0].toUpperCase()
    const bp = (b.match(/^(SPMB|XII|XI|X)/i) || [''])[0].toUpperCase()
    return (urut[ap] ?? 99) - (urut[bp] ?? 99) || a.localeCompare(b, 'id', { sensitivity: 'base' })
  }).map(k => ({ label: k, value: k }))
})

const modeOptions = [
  { label: 'Naik Kelas', value: 'naik' },
  { label: 'Luluskan', value: 'lulus' }
]

// ═══════════════════════════════════════════════
// COMPUTED
// ═══════════════════════════════════════════════
const siswaAsal = computed(() => {
  if (!kelasAsal.value) return []
  return daftarSiswa.value.filter(s => {
    if (String(s.kelas || '').trim() !== kelasAsal.value) return false
    if (String(s.status || '').toLowerCase() === 'lulus') return false
    return true
  }).sort((a, b) => (a.nama || '').localeCompare(b.nama || ''))
})

const siswaFiltered = computed(() => {
  const kw = searchSiswa.value.toLowerCase().trim()
  if (!kw) return siswaAsal.value
  return siswaAsal.value.filter(s =>
    (s.nama || '').toLowerCase().includes(kw) || (s.no_induk || '').toLowerCase().includes(kw)
  )
})

const semuaSelected = computed(() =>
  siswaFiltered.value.length > 0 && siswaFiltered.value.every(s => selectedIds.value.includes(s.id))
)

// Preview: analisis per siswa apakah perlu override
const previewItems = computed(() => {
  const tahunP = parseTahunRange(tahunBaru.value)
  if (!tahunP) return []
  const tahunPilih = tahunP[0]

  const tingkatTujuan = mode.value === 'lulus' ? null : getTingkatFromKelas(kelasTujuan.value)

  return siswaFiltered.value.map(s => {
    const masuk = s.detail_data?.masuk || ''
    const derived = deriveTahunPerTingkat(masuk)
    const butuhOverride = tingkatTujuan && derived[tingkatTujuan]
      ? derived[tingkatTujuan] !== `${tahunP[0]}/${tahunP[1]}`
      : false
    const autoTahun = tingkatTujuan ? derived[tingkatTujuan] : ''
    return {
      ...s,
      _butuhOverride: butuhOverride,
      _autoTahun: autoTahun,
      _tahunBaru: `${tahunP[0]}/${tahunP[1]}`
    }
  })
})

const tahunValid = computed(() => /^\d{4}-\d{4}$/.test(tahunBaru.value))
const kelasTujuanOptions = computed(() => {
  const set = new Set()
  const asalUpper = String(kelasAsal.value || '').toUpperCase().trim()

  // 1. Ambil semua kelas aktif dari DB
  const allAktif = new Set()
  daftarSiswa.value.forEach(s => {
    const k = String(s.kelas || '').trim()
    if (k && !k.toLowerCase().startsWith('lulus')) allAktif.add(k)
  })

  // 2. Generate turunan sesuai tingkat asal
  if (/^SPMB/.test(asalUpper)) {
    // SPMB → kelas X
    Array.from(allAktif).forEach(k => {
      if (/^X(\s|$)/.test(k.toUpperCase())) set.add(k)
    })
  } else if (/^XII/.test(asalUpper)) {
    // XII → gunakan mode Luluskan, tidak ada kelas tujuan
  } else if (/^XI/.test(asalUpper)) {
    const suffix = asalUpper.replace(/^XI\s*/, '').trim()
    if (suffix) set.add('XII ' + suffix)
    Array.from(allAktif).forEach(k => {
      if (/^XII(\s|$)/.test(k.toUpperCase())) set.add(k)
    })
  } else if (/^X(\s|$)/.test(asalUpper)) {
    const suffix = asalUpper.replace(/^X\s*/, '').trim()
    if (suffix) set.add('XI ' + suffix)
    Array.from(allAktif).forEach(k => {
      if (/^XI(\s|$)/.test(k.toUpperCase())) set.add(k)
    })
  }

  return Array.from(set)
    .sort((a, b) => a.localeCompare(b, 'id', { sensitivity: 'base' }))
    .map(k => ({ label: k, value: k }))
})

const validasi = computed(() => {
  const errors = []
  if (!tahunBaru.value) errors.push('Tahun ajaran baru wajib diisi')
  else if (!tahunValid.value) errors.push('Format tahun ajaran harus YYYY-YYYY')
  if (!kelasAsal.value) errors.push('Kelas asal wajib dipilih')
  if (mode.value === 'naik' && !kelasTujuan.value.trim()) errors.push('Kelas tujuan wajib diisi')
  if (selectedIds.value.length === 0) errors.push('Pilih minimal 1 siswa')
  return errors
})

// ═══════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════
function getTingkatFromKelas(kelas) {
  const k = String(kelas || '').toUpperCase().trim()
  if (/^XII/.test(k)) return 'XII'
  if (/^XI/.test(k)) return 'XI'
  if (/^X/.test(k)) return 'X'
  return null
}

function toggleSiswa(id) {
  const i = selectedIds.value.indexOf(id)
  if (i >= 0) selectedIds.value.splice(i, 1)
  else selectedIds.value.push(id)
}

function toggleSemua() {
  if (semuaSelected.value) {
    selectedIds.value = selectedIds.value.filter(id => !siswaFiltered.value.some(s => s.id === id))
  } else {
    const current = new Set(selectedIds.value)
    siswaFiltered.value.forEach(s => current.add(s.id))
    selectedIds.value = Array.from(current)
  }
}

// ═══════════════════════════════════════════════
// LOAD
// ═══════════════════════════════════════════════
async function ambilData() {
  isLoading.value = true
  const { data, error } = await supabase.from('siswa').select('id, no_induk, nama, kelas, status, detail_data')
    .order('nama')
  if (error) { alert('Gagal memuat: ' + error.message); isLoading.value = false; return }
  daftarSiswa.value = (data || []).filter(s => {
    const st = String(s.status || '').toLowerCase()
    return !st.includes('angkatan') && !String(s.no_induk || '').toLowerCase().includes('angkatan')
  })
  isLoading.value = false
}

// ═══════════════════════════════════════════════
// PROCESS
// ═══════════════════════════════════════════════
async function proses() {
  if (validasi.value.length > 0) return alert('Lengkapi dulu:\n' + validasi.value.join('\n'))

  const jumlah = selectedIds.value.length
  const konfirmasi = await confirm({
    title: mode.value === 'lulus' ? 'Luluskan Siswa' : 'Naik Kelas',
    message: `${mode.value === 'lulus' ? 'Luluskan' : 'Naikkan'} ${jumlah} siswa dari "${kelasAsal.value}" ke "${mode.value === 'lulus' ? 'LULUS' : kelasTujuan.value}" pada tahun ${tahunBaru.value}?\n\nTindakan ini mengubah data siswa dan tidak bisa di-undo otomatis.`,
    variant: mode.value === 'lulus' ? 'warning' : 'info',
    confirmText: 'Ya, Proses'
  })
  if (!konfirmasi) return

  processing.value = true
  try {
    const tahunP = parseTahunRange(tahunBaru.value)
    const tahunPilih = `${tahunP[0]}/${tahunP[1]}`
    const tingkatTujuan = mode.value === 'lulus' ? null : getTingkatFromKelas(kelasTujuan.value)

    let ok = 0, fail = 0
    const errLog = []

    for (const item of previewItems.value) {
      if (!selectedIds.value.includes(item.id)) continue

      const s = daftarSiswa.value.find(x => x.id === item.id)
      if (!s) continue

      const newDetail = { ...(s.detail_data || {}) }
      let payload = {}

      if (mode.value === 'lulus') {
        payload = {
          kelas: 'Lulus ' + (s.kelas || ''),
          status: 'Lulus'
        }
        // Hapus override (tidak relevan setelah lulus)
        if (newDetail.tahun_per_tingkat) {
          delete newDetail.tahun_per_tingkat
          payload.detail_data = newDetail
        }
      } else {
        payload = { kelas: kelasTujuan.value.trim() }

        // Handle tahun override
        const derived = deriveTahunPerTingkat(s.detail_data?.masuk)
        const expected = tingkatTujuan ? derived[tingkatTujuan] : ''
        const tpt = { ...(newDetail.tahun_per_tingkat || {}) }

        if (tingkatTujuan) {
          if (expected !== tahunPilih) {
            tpt[tingkatTujuan] = tahunPilih
          } else {
            delete tpt[tingkatTujuan]
          }
        }
        if (Object.keys(tpt).length > 0) newDetail.tahun_per_tingkat = tpt
        else delete newDetail.tahun_per_tingkat
        payload.detail_data = newDetail
      }

      const { error } = await supabase.from('siswa').update(payload).eq('id', item.id)
      if (error) { fail++; errLog.push(s.no_induk + ': ' + error.message) }
      else {
        ok++
        // Update lokal
        const idx = daftarSiswa.value.findIndex(x => x.id === item.id)
        if (idx >= 0) daftarSiswa.value[idx] = { ...daftarSiswa.value[idx], ...payload }
      }
    }

    alert(`Proses selesai.\n✅ Berhasil: ${ok}\n❌ Gagal: ${fail}${errLog.length ? '\n\n' + errLog.slice(0, 5).join('\n') : ''}`)
    selectedIds.value = []
    kelasAsal.value = ''
    kelasTujuan.value = ''
    await ambilData()
  } catch (err) {
    alert('Gagal proses: ' + err.message)
  } finally {
    processing.value = false
  }
}

onMounted(ambilData)
</script>

<template>
  <div class="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-5">

    <!-- HEADER -->
    <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl md:text-3xl font-bold text-white tracking-tight">Kenaikan Kelas</h1>
        <p class="text-sm text-slate-500 mt-1">Proses naik kelas & kelulusan siswa per tahun ajaran</p>
      </div>
      <button @click="ambilData" :disabled="isLoading"
              class="inline-flex items-center gap-2 px-4 h-10 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-[13px] font-semibold transition disabled:opacity-50">
        <RefreshCw class="w-4 h-4" :class="isLoading ? 'animate-spin' : ''" />
        <span>{{ isLoading ? 'Memuat...' : 'Refresh' }}</span>
      </button>
    </div>

    <!-- CONFIG CARD -->
    <div class="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-4 space-y-3">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
        <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Tahun Ajaran Baru <span class="text-red-400">*</span></label>
        <input v-model="tahunBaru" type="text" placeholder="Contoh: 2026-2027" maxlength="9"
                class="w-full h-10 px-3 bg-slate-950 border rounded-lg text-[13px] text-white font-mono placeholder-slate-500 outline-none focus:ring-2 focus:ring-emerald-500/10 transition"
                :class="tahunValid || !tahunBaru ? 'border-slate-800 focus:border-emerald-500/60' : 'border-red-500/60'" />
        <p class="text-[10px] mt-1" :class="tahunBaru && !tahunValid ? 'text-red-400' : 'text-slate-500'">
            {{ tahunBaru && !tahunValid ? 'Format salah. Gunakan: YYYY-YYYY' : 'Format: YYYY-YYYY' }}
        </p>
        </div>
        <div>
          <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Kelas Asal <span class="text-red-400">*</span></label>
          <CustomSelect v-model="kelasAsal" :options="kelasAsalOptions" placeholder="Pilih kelas asal" searchable />
        </div>
        <div>
          <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Mode <span class="text-red-400">*</span></label>
          <CustomSelect v-model="mode" :options="modeOptions" />
        </div>
      </div>

      <div v-if="mode === 'naik'">
        <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Kelas Tujuan <span class="text-red-400">*</span></label>
        <CustomSelect v-model="kelasTujuan" :options="kelasTujuanOptions" placeholder="Pilih kelas tujuan" searchable />
        <p class="text-[10px] mt-1" :class="kelasTujuanOptions.length === 0 && kelasAsal ? 'text-amber-400' : 'text-slate-500'">
            <template v-if="kelasTujuanOptions.length === 0 && kelasAsal">
            ⚠ Tidak ada kelas tujuan tersedia. Buat kelas dulu via <b>SPMB (Data Siswa → + SPMB)</b> untuk tingkat berikutnya.
            </template>
            <template v-else-if="kelasTujuanOptions.length > 0">
            {{ kelasTujuanOptions.length }} kelas tersedia (dari rombel aktif + turunan otomatis)
            </template>
            <template v-else>
            Pilih kelas asal dulu
            </template>
        </p>
        </div>

      <div v-if="mode === 'lulus'" class="px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11.5px] text-amber-300 flex items-start gap-2">
        <AlertCircle class="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <div>Semua siswa terpilih akan di-set <b>status = Lulus</b> dan <b>kelas = "Lulus + kelas lama"</b>. Override tahun akan dihapus.</div>
      </div>

      <div v-if="validasi.length > 0" class="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-[11.5px] text-red-300 space-y-0.5">
        <div class="font-semibold">Perlu dilengkapi:</div>
        <div v-for="(e, i) in validasi" :key="i">• {{ e }}</div>
      </div>
    </div>

    <!-- PREVIEW -->
    <div v-if="kelasAsal && previewItems.length > 0" class="rounded-2xl border border-slate-800/80 bg-slate-900/50 overflow-hidden">
      <div class="px-4 py-3 border-b border-slate-800/80 bg-slate-950/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div class="text-xs text-slate-400">
          Preview: <b class="text-emerald-400">{{ previewItems.length }}</b> siswa di kelas <b class="text-white">{{ kelasAsal }}</b>
          <span class="text-slate-500 mx-2">•</span>
          <b class="text-amber-400">{{ selectedIds.length }}</b> dipilih
        </div>
        <div class="flex items-center gap-2 w-full sm:w-auto">
          <div class="relative flex-1 sm:w-64">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input v-model="searchSiswa" type="text" placeholder="Cari nama / no induk..."
                   class="w-full h-8 pl-8 pr-3 bg-slate-950 border border-slate-800 rounded-md text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500/60" />
          </div>
        </div>
      </div>

      <div class="overflow-y-auto" style="max-height: 55vh;">
        <table class="w-full text-xs">
          <thead class="bg-slate-950 border-b border-slate-800 sticky top-0 z-10">
            <tr>
              <th class="px-2 py-2.5 w-10">
                <input type="checkbox" :checked="semuaSelected" @change="toggleSemua"
                       class="accent-emerald-500 w-3.5 h-3.5 cursor-pointer" />
              </th>
              <th class="px-3 py-2.5 text-left text-[10px] font-bold uppercase text-slate-500">No Induk</th>
              <th class="px-3 py-2.5 text-left text-[10px] font-bold uppercase text-slate-500">Nama</th>
              <th class="px-3 py-2.5 text-left text-[10px] font-bold uppercase text-slate-500">Kelas</th>
              <th class="px-3 py-2.5 text-center text-[10px] font-bold uppercase text-amber-400">Tahun Override</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800/60">
            <tr v-for="s in previewItems" :key="s.id" class="hover:bg-slate-800/40 transition">
              <td class="px-2 py-2.5 text-center">
                <input type="checkbox" :checked="selectedIds.includes(s.id)" @change="toggleSiswa(s.id)"
                       class="accent-emerald-500 w-3.5 h-3.5 cursor-pointer" />
              </td>
              <td class="px-3 py-2.5 font-mono text-[11.5px] text-slate-300">{{ s.no_induk }}</td>
              <td class="px-3 py-2.5 font-semibold text-white truncate">{{ s.nama }}</td>
              <td class="px-3 py-2.5 font-mono text-[11px] text-slate-300">{{ s.kelas }}</td>
              <td class="px-3 py-2.5 text-center">
                <div v-if="mode === 'naik' && s._butuhOverride" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 text-[10.5px] font-mono">
                  <AlertCircle class="w-3 h-3" />
                  {{ s._tahunBaru }} (auto: {{ s._autoTahun || '—' }})
                </div>
                <div v-else-if="mode === 'naik'" class="inline-flex items-center gap-1 text-[10.5px] text-emerald-400 font-mono">
                  <CheckCircle2 class="w-3 h-3" />
                  {{ s._tahunBaru }} (otomatis)
                </div>
                <span v-else class="text-[10.5px] text-slate-500 italic">—</span>
              </td>
            </tr>
            <tr v-if="previewItems.length === 0">
              <td colspan="5" class="px-4 py-12 text-center text-slate-500 text-sm">Tidak ada siswa di kelas ini</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="px-4 py-3 border-t border-slate-800/80 bg-slate-950/40 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div class="text-xs text-slate-400">
          <b class="text-emerald-400">{{ selectedIds.length }}</b> dari {{ previewItems.length }} siswa dipilih
        </div>
        <button @click="proses" :disabled="processing || validasi.length > 0"
                class="inline-flex items-center gap-2 h-10 px-5 rounded-xl text-[13px] font-bold transition shadow-lg"
                :class="validasi.length === 0 && !processing ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white shadow-emerald-900/40' : 'bg-slate-800 text-slate-500 cursor-not-allowed'">
          <component :is="mode === 'lulus' ? GraduationCap : ArrowUpCircle" class="w-4 h-4" />
          {{ processing ? 'Memproses...' : (mode === 'lulus' ? 'Luluskan' : 'Naik Kelas') + ` ${selectedIds.length} Siswa` }}
        </button>
      </div>
    </div>

    <div v-else-if="!kelasAsal" class="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-12 text-center">
      <div class="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
        <ArrowUpCircle class="w-8 h-8 text-emerald-400" />
      </div>
      <div class="text-slate-300 font-semibold mb-1">Pilih kelas asal untuk mulai</div>
      <div class="text-slate-500 text-xs">Siswa akan muncul di preview setelah kelas dipilih</div>
    </div>

    <div v-else class="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-12 text-center">
      <div class="text-slate-500 text-sm mb-1">Tidak ada siswa aktif di kelas "{{ kelasAsal }}"</div>
      <div class="text-slate-600 text-xs">Cek apakah siswa masih berstatus Aktif</div>
    </div>

  </div>
</template>