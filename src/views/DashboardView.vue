<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { supabase } from '../lib/supabase'
import { userSesi } from '../stores/auth'
import Chart from 'chart.js/auto'
import { theme } from '../stores/theme'
import {
  CalendarDays, GraduationCap, ShieldCheck, Users, UserCheck, Award,
  Briefcase, School, TrendingUp, PieChart, ClipboardCheck, BarChart3, ChevronRight, Search, Plus, Printer, RefreshCw
} from 'lucide-vue-next'

watch(theme, async () => {
  await nextTick()
  if (chartStatus) chartStatus.destroy()
  if (chartMasuk) chartMasuk.destroy()
  if (chartKelas) chartKelas.destroy()
  hitungDashboard()
})

// State Data
const daftarSiswa = ref([])
const daftarGuru = ref([])
const daftarNilai = ref([])
const isLoading = ref(true)

const kpi = ref({
  total: 0, aktif: 0, lulus: 0, guru: 0, rombel: 0, rataNilai: '-',
  totalSub: '-', aktifSub: '-', lulusSub: '-', guruSub: '-', rombelSub: '-', nilaiSub: '-',
  putra: 0, putri: 0, persenLengkap: 0, lengkapCount: 0, tanpaKelas: 0, tglTakTerbaca: 0
})

const waktuSekarang = ref('')
const sapaan = ref('')
const roleUser = ref('')
const isTouch = ref(false)
onMounted(() => {
  isTouch.value = window.matchMedia('(pointer: coarse)').matches
})

let chartStatus = null
let chartMasuk = null
let chartKelas = null
const chartStatusCanvas = ref(null)
const chartMasukCanvas = ref(null)
const chartKelasCanvas = ref(null)

// Helper: nilai dianggap terisi jika bukan null, bukan string kosong, bukan '-'
const isi = (v) => v != null && String(v).trim() !== '' && String(v).trim() !== '-'

const hitungDashboard = () => {
  const total = daftarSiswa.value.length
  let aktif = 0, lulus = 0, putra = 0, putri = 0, tanpaKelas = 0, lengkap = 0
  const angkatan = {}, perKelas = {}

  daftarSiswa.value.forEach(s => {
    const st = (s.status || '').toLowerCase()
    const kl = (s.kelas || '').toLowerCase()
    const gab = st + ' ' + kl
    const isLulus = /lulus/.test(gab) && !/(belum|tidak)\s*lulus/.test(gab)
    const isBerhenti = !isLulus && /berhenti/.test(gab)
    const dd = s.detail_data || {}

    if (dd.masuk) {
      const m = String(dd.masuk).match(/\d{4}/)
      if (m) angkatan[m[0]] = true
    }

    if (isLulus) {
      lulus++
    } else if (!isBerhenti) {
      aktif++
      const jk = (s.jenis_kelamin || s.kelamin || '').toLowerCase().charAt(0)
      if (jk === 'l') putra++
      else if (jk === 'p') putri++
      if (!s.kelas || !String(s.kelas).trim()) tanpaKelas++
      else perKelas[s.kelas] = (perKelas[s.kelas] || 0) + 1
    }

    // ─── Kelengkapan data (10 field wajib, fallback ke detail_data JSONB) ───
    const wajib = [
      isi(s.nisn),
      isi(s.nama),
      isi(s.jenis_kelamin || s.kelamin),
      isi(s.tempat_lahir) || isi(dd.tetala),
      isi(s.tanggal_lahir),
      isi(s.alamat),
      isi(s.nama_ayah),
      isi(s.nama_ibu),
      isi(s.nik) || isi(dd.nik),
      isi(s.no_kk) || isi(dd.kk),
    ]
    if (wajib.every(Boolean)) lengkap++
  })

  const jumlahKelas = Object.keys(perKelas)
  let kelasTerbesar = '', terbesarN = 0
  jumlahKelas.forEach(k => { if (perKelas[k] > terbesarN) { terbesarN = perKelas[k]; kelasTerbesar = k } })

  let sumNilai = 0, countNilai = 0
  daftarNilai.value.forEach(n => {
    if (n.nilai_data && n.nilai_data.smt1 && n.nilai_data.smt1.mapel) {
      n.nilai_data.smt1.mapel.forEach(m => {
        const t = parseFloat(m.teori)
        if (!isNaN(t)) { sumNilai += t; countNilai++ }
      })
    }
  })

  kpi.value = {
    total, aktif, lulus,
    guru: daftarGuru.value.length,
    rombel: jumlahKelas.length,
    rataNilai: countNilai > 0 ? (sumNilai / countNilai).toFixed(2) : '-',
    totalSub: Object.keys(angkatan).length + ' angkatan tercatat',
    aktifSub: putra + ' putra • ' + putri + ' putri',
    lulusSub: (total ? Math.round(lulus * 100 / total) : 0) + '% dari seluruh data',
    guruSub: 'Guru & Staf',
    rombelSub: kelasTerbesar ? 'Terbesar: ' + kelasTerbesar + ' (' + terbesarN + ')' : 'Belum ada',
    nilaiSub: countNilai + ' santri bernilai',
    putra, putri,
    lengkapCount: lengkap,
    persenLengkap: total ? Math.round(lengkap * 100 / total) : 0,
    tanpaKelas,
    tglTakTerbaca: 0
  }

  renderChartStatus()
  renderChartMasuk(angkatan)
  renderChartKelas(perKelas)
}

const renderChartStatus = () => {
  if (!chartStatusCanvas.value) return
  let aktif = 0, lulus = 0, berhenti = 0
  daftarSiswa.value.forEach(s => {
    const gab = (s.status || '').toLowerCase() + ' ' + (s.kelas || '').toLowerCase()
    if (/lulus/.test(gab) && !/(belum|tidak)\s*lulus/.test(gab)) lulus++
    else if (/berhenti/.test(gab)) berhenti++
    else aktif++
  })
  if (chartStatus) chartStatus.destroy()
  chartStatus = new Chart(chartStatusCanvas.value, {
    type: 'doughnut',
    data: {
      labels: ['Aktif', 'Lulus', 'Berhenti'],
      datasets: [{
        data: [aktif, lulus, berhenti],
        backgroundColor: ['#10b981', '#3b82f6', '#ef4444'],
        hoverBackgroundColor: ['#6ee7b7', '#93c5fd', '#fca5a5'],
        borderColor: '#0f172a', borderWidth: 3, hoverOffset: 14
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: true, aspectRatio: 1, cutout: '75%',
      plugins: { legend: { display: false } }
    }
  })
}

const renderChartMasuk = (angkatanObj) => {
  if (!chartMasukCanvas.value) return
  const tahunArr = Object.keys(angkatanObj).sort((a, b) => b - a).slice(0, 3).reverse()
  const labels = tahunArr.map(t => 'Angkatan ' + t)
  const values = tahunArr.map(t => daftarSiswa.value.filter(s => String((s.detail_data || {}).masuk || '').includes(t)).length)
  if (chartMasuk) chartMasuk.destroy()
  chartMasuk = new Chart(chartMasukCanvas.value, {
    type: 'doughnut',
    data: {
      labels: labels.length ? labels : ['Belum Ada'],
      datasets: [{
        data: values.length ? values : [1],
        backgroundColor: ['#f59e0b', '#3b82f6', '#8b5cf6'],
        hoverBackgroundColor: ['#fcd34d', '#93c5fd', '#c4b5fd'],
        borderColor: '#0f172a', borderWidth: 3, hoverOffset: 14
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: true, aspectRatio: 1, cutout: '75%',
      plugins: { legend: { display: false } }
    }
  })
}

const renderChartKelas = (perKelasObj) => {
  if (!chartKelasCanvas.value) return
  const kelasArr = Object.keys(perKelasObj).sort()
  const values = kelasArr.map(k => perKelasObj[k])
  if (chartKelas) chartKelas.destroy()
  chartKelas = new Chart(chartKelasCanvas.value, {
    type: 'bar',
    data: {
      labels: kelasArr,
      datasets: [{
        label: 'Jumlah Siswa',
        data: values,
        backgroundColor: '#10b981',
        hoverBackgroundColor: '#047857',
        borderRadius: 8, barThickness: 20
      }]
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      scales: {
        x: { beginAtZero: true, grid: { color: 'rgba(51, 65, 85, 0.4)' }, ticks: { color: '#94a3b8' } },
        y: { grid: { display: false }, ticks: { color: theme.value === 'dark' ? '#f1f5f9' : '#0f172a', font: { weight: 'bold' } } }
      },
      plugins: { legend: { display: false } }
    }
  })
}

const muatData = async () => {
  isLoading.value = true
  const now = new Date()
  const jam = now.getHours()
  sapaan.value = jam < 11 ? 'Selamat pagi' : (jam < 15 ? 'Selamat siang' : (jam < 18 ? 'Selamat sore' : 'Selamat malam'))
  waktuSekarang.value = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  roleUser.value = (userSesi.value?.email || 'Admin').toUpperCase()

  const [resSiswa, resGuru, resNilai] = await Promise.all([
    supabase.from('siswa').select('*'),
    supabase.from('guru').select('*'),
    supabase.from('nilai').select('*')
  ])

  if (resSiswa.data) daftarSiswa.value = resSiswa.data
  if (resGuru.data) daftarGuru.value = resGuru.data
  if (resNilai.data) daftarNilai.value = resNilai.data

  isLoading.value = false
  await nextTick()
  hitungDashboard()
}

onMounted(() => { muatData() })
onBeforeUnmount(() => {
  if (chartStatus) chartStatus.destroy()
  if (chartMasuk) chartMasuk.destroy()
  if (chartKelas) chartKelas.destroy()
})
</script>

<template>
  <div
    class="p-3 md:p-6 max-w-7xl mx-auto space-y-4 md:space-y-6"
    :class="theme === 'dark' ? 'dsh-dark' : 'dsh-light'">

    <!-- HERO SECTION -->
    <div class="dsh-hero dsh-in">
      <div class="dsh-hero-bg" aria-hidden="true"></div>
      <div class="dsh-hero-grid">
        <div>
          <div class="dsh-chips">
            <span class="dsh-chip"><CalendarDays class="w-3.5 h-3.5" /><span>{{ waktuSekarang }}</span></span>
            <span class="dsh-chip"><GraduationCap class="w-3.5 h-3.5" /><span>TP 2025/2026 • Ganjil</span></span>
            <span class="dsh-chip"><ShieldCheck class="w-3.5 h-3.5" /><span>{{ roleUser }}</span></span>
          </div>
          <h2 class="dsh-hero-title">{{ sapaan }}, {{ userSesi?.email || 'Administrator' }}</h2>
          <p class="dsh-hero-sub">Data akademik SMA Al-Itsbatiyah Darul Ulum Banyuanyar — siswa/santri, nilai, dan kelengkapan data lainnya.</p>
          <div class="dsh-hero-actions">
            <button type="button" class="dsh-btn dsh-btn-light" @click="$router.push('/siswa?spmb=true')"><Plus class="w-4 h-4" /><span>SPMB</span></button>
            <button type="button" class="dsh-btn dsh-btn-glass"><Printer class="w-4 h-4" /><span>Pusat Cetak</span></button>
            <button type="button" class="dsh-btn dsh-btn-glass" @click="muatData"><RefreshCw class="w-4 h-4" /><span>Sinkron Data</span></button>
          </div>
        </div>
        <div class="dsh-status">
          <div class="dsh-status-label">Status Sistem</div>
          <div class="dsh-status-row"><span class="dsh-dot"></span><span>Terhubung ke Supabase</span></div>
          <div class="dsh-status-sub">Sinkronisasi otomatis</div>
          <button type="button" class="dsh-search"><Search class="w-4 h-4" /><span>Cari menu atau santri…</span><kbd>Ctrl K</kbd></button>
        </div>
      </div>
    </div>

    <!-- KPI CARDS -->
    <div class="dsh-kpis">
      <div class="dsh-kpi dsh-in" style="--accent:16,185,129;--accent-d:4,120,87;--accent-l:110,231,183;--d:60ms">
        <div class="dsh-kpi-top"><span class="dsh-kpi-label">Total Santri</span><span class="dsh-ic"><Users class="w-5 h-5" /></span></div>
        <div class="dsh-kpi-val">{{ isLoading ? '...' : kpi.total }}</div>
        <div class="dsh-kpi-sub">{{ kpi.totalSub }}</div>
      </div>
      <div class="dsh-kpi dsh-in" style="--accent:59,130,246;--accent-d:29,78,216;--accent-l:147,197,253;--d:110ms">
        <div class="dsh-kpi-top"><span class="dsh-kpi-label">Santri Aktif</span><span class="dsh-ic"><UserCheck class="w-5 h-5" /></span></div>
        <div class="dsh-kpi-val">{{ isLoading ? '...' : kpi.aktif }}</div>
        <div class="dsh-kpi-sub">{{ kpi.aktifSub }}</div>
        <div class="dsh-split"><span :style="{ width: (kpi.putra / (kpi.putra + kpi.putri || 1) * 100) + '%' }"></span><span :style="{ width: (kpi.putri / (kpi.putra + kpi.putri || 1) * 100) + '%' }"></span></div>
      </div>
      <div class="dsh-kpi dsh-in" style="--accent:139,92,246;--accent-d:109,40,217;--accent-l:196,181,253;--d:160ms">
        <div class="dsh-kpi-top"><span class="dsh-kpi-label">Alumni (Lulus)</span><span class="dsh-ic"><Award class="w-5 h-5" /></span></div>
        <div class="dsh-kpi-val">{{ isLoading ? '...' : kpi.lulus }}</div>
        <div class="dsh-kpi-sub">{{ kpi.lulusSub }}</div>
      </div>
      <div class="dsh-kpi dsh-in" style="--accent:20,184,166;--accent-d:15,118,110;--accent-l:94,234,212;--d:210ms">
        <div class="dsh-kpi-top"><span class="dsh-kpi-label">Dewan Guru</span><span class="dsh-ic"><Briefcase class="w-5 h-5" /></span></div>
        <div class="dsh-kpi-val">{{ isLoading ? '...' : kpi.guru }}</div>
        <div class="dsh-kpi-sub">{{ kpi.guruSub }}</div>
      </div>
      <div class="dsh-kpi dsh-in" style="--accent:245,158,11;--accent-d:180,83,9;--accent-l:252,211,77;--d:260ms">
        <div class="dsh-kpi-top"><span class="dsh-kpi-label">Rombel Aktif</span><span class="dsh-ic"><School class="w-5 h-5" /></span></div>
        <div class="dsh-kpi-val">{{ isLoading ? '...' : kpi.rombel }}</div>
        <div class="dsh-kpi-sub">{{ kpi.rombelSub }}</div>
      </div>
      <div class="dsh-kpi dsh-in" style="--accent:244,63,94;--accent-d:190,18,60;--accent-l:253,164,175;--d:310ms">
        <div class="dsh-kpi-top"><span class="dsh-kpi-label">Rata-rata Nilai</span><span class="dsh-ic"><TrendingUp class="w-5 h-5" /></span></div>
        <div class="dsh-kpi-val">{{ isLoading ? '...' : kpi.rataNilai }}</div>
        <div class="dsh-kpi-sub">{{ kpi.nilaiSub }}</div>
      </div>
    </div>

    <!-- CHARTS (4 card dalam satu grid → HP 2×2) -->
    <div class="dsh-grid">
      <!-- 1. Status Santri -->
      <div class="dsh-card dsh-span-6 dsh-in" style="--accent:59,130,246;--accent-d:29,78,216;--accent-l:147,197,253;--d:120ms">
        <div class="dsh-card-head">
          <div class="dsh-card-head-l"><span class="dsh-ic"><PieChart class="w-5 h-5" /></span><div><div class="dsh-card-title">Status Santri</div><div class="dsh-card-sub">Keseluruhan database</div></div></div>
          <span class="dsh-pill">Total <span>{{ kpi.total }}</span></span>
        </div>
        <div class="dsh-donut">
          <div class="dsh-donut-canvas">
            <canvas ref="chartStatusCanvas"></canvas>
            <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div class="dsh-donut-cap">TOTAL</div>
              <div class="dsh-donut-num">{{ kpi.total }}</div>
              <div class="dsh-donut-cap blue">SANTRI</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. Santri Masuk -->
      <div class="dsh-card dsh-span-6 dsh-in" style="--accent:16,185,129;--accent-d:4,120,87;--accent-l:110,231,183;--d:180ms">
        <div class="dsh-card-head">
          <div class="dsh-card-head-l"><span class="dsh-ic"><TrendingUp class="w-5 h-5" /></span><div><div class="dsh-card-title">Santri Masuk</div><div class="dsh-card-sub">3 angkatan terakhir</div></div></div>
        </div>
        <div class="dsh-donut">
          <div class="dsh-donut-canvas">
            <canvas ref="chartMasukCanvas"></canvas>
            <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div class="dsh-donut-cap">TOTAL</div>
              <div class="dsh-donut-num">{{ kpi.total }}</div>
              <div class="dsh-donut-cap green">SANTRI</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 3. Kelengkapan Data -->
      <div class="dsh-card dsh-span-6 dsh-in" style="--accent:20,184,166;--accent-d:15,118,110;--accent-l:94,234,212;--d:240ms">
        <div class="dsh-card-head">
          <div class="dsh-card-head-l"><span class="dsh-ic"><ClipboardCheck class="w-5 h-5" /></span><div><div class="dsh-card-title">Kelengkapan Data</div><div class="dsh-card-sub">Kualitas database santri</div></div></div>
        </div>

        <div class="dsh-ring-wrap">
          <svg class="dsh-ring" viewBox="0 0 120 120">
            <defs><linearGradient id="dshRingGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#34d399"/><stop offset="100%" stop-color="#14b8a6"/></linearGradient></defs>
            <circle class="dsh-ring-bg" cx="60" cy="60" r="52"></circle>
            <circle class="dsh-ring-fg" cx="60" cy="60" r="52" stroke-dasharray="326.73" :stroke-dashoffset="326.73 * (1 - kpi.persenLengkap / 100)" transform="rotate(-90 60 60)"></circle>
          </svg>
          <div class="dsh-ring-center">
            <div class="dsh-ring-pct">{{ kpi.persenLengkap }}%</div>
            <div class="dsh-ring-cap">lengkap</div>
          </div>
        </div>
        <div class="dsh-ring-sub">{{ kpi.lengkapCount }} dari {{ kpi.total }} data ditandai lengkap</div>

        <div class="dsh-att-title">Perlu perhatian</div>
        <div class="dsh-att-list">
          <button type="button" class="dsh-att">
            <span class="dsh-att-dot warn"></span><span><b>{{ kpi.tanpaKelas }}</b> santri aktif belum punya kelas</span><ChevronRight class="w-4 h-4" />
          </button>
          <button type="button" class="dsh-att">
            <span class="dsh-att-dot bad"></span><span><b>{{ kpi.total - kpi.lengkapCount }}</b> data belum ditandai lengkap</span><ChevronRight class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- 4. Santri per Kelas -->
      <div class="dsh-card dsh-span-6 dsh-in" style="--accent:245,158,11;--accent-d:180,83,9;--accent-l:252,211,77;--d:140ms">
        <div class="dsh-card-head">
          <div class="dsh-card-head-l"><span class="dsh-ic"><BarChart3 class="w-5 h-5" /></span><div><div class="dsh-card-title">Santri per Kelas</div><div class="dsh-card-sub">Distribusi seluruh santri aktif</div></div></div>
          <span class="dsh-pill"><span>{{ kpi.rombel }}</span> Kelas • <span>{{ kpi.aktif }}</span> Santri</span>
        </div>
        <div class="dsh-bar-wrap">
          <canvas ref="chartKelasCanvas"></canvas>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

.font-heading { font-family: 'Inter', system-ui, sans-serif; font-weight: 700; letter-spacing: -0.02em; }
.font-mono-code { font-family: 'JetBrains Mono', ui-monospace, monospace; }

/* ============ TEMA (CSS VARIABLES) ============ */
.dsh-dark {
  --card-bg: #111827;
  --card-border: #1e293b;
  --card-text: #f8fafc;
  --card-sub: #64748b;
  --card-label: #94a3b8;
  --split-bg: #1e293b;
}
.dsh-light {
  --card-bg: #ffffff;
  --card-border: #e2e8f0;
  --card-text: #0f172a;
  --card-sub: #64748b;
  --card-label: #64748b;
  --split-bg: #e2e8f0;
}

@keyframes dshIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
@keyframes dshPulse { 0% { box-shadow: 0 0 0 0 rgba(52,211,153,.65); } 70% { box-shadow: 0 0 0 9px rgba(52,211,153,0); } 100% { box-shadow: 0 0 0 0 rgba(52,211,153,0); } }
.dsh-in { animation: dshIn 620ms cubic-bezier(0.16,1,0.3,1) backwards; animation-delay: var(--d, 0ms); }

/* HERO */
.dsh-hero {
  position: relative; overflow: hidden; border-radius: 26px; padding: 28px 30px; color: #fff;
  background: linear-gradient(135deg, #047857 0%, #0f766e 48%, #115e59 100%);
  box-shadow: 0 18px 40px -18px rgba(4,120,87,.55), 0 0 0 1px rgba(255,255,255,.08) inset;
}
.dsh-hero-bg {
  position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(520px 260px at 88% -10%, rgba(255,255,255,.22), transparent 60%), radial-gradient(420px 220px at 0% 110%, rgba(110,231,183,.28), transparent 60%), radial-gradient(circle, rgba(255,255,255,.10) 1px, transparent 1px);
  background-size: auto, auto, 26px 26px;
}
.dsh-hero-grid { position: relative; display: grid; gap: 24px; align-items: center; grid-template-columns: minmax(0,1fr) 300px; }
@media (max-width: 900px) { .dsh-hero-grid { grid-template-columns: minmax(0,1fr); } .dsh-hero { padding: 22px 20px; } }

.dsh-chips {
  display: flex; flex-wrap: nowrap; gap: 8px;
  min-width: 0;
}
.dsh-chip {
  display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 999px;
  flex: 0 1 auto; min-width: 0;
  font-size: 11.5px; font-weight: 600; color: #fff; background: rgba(255,255,255,.14); border: 1px solid rgba(255,255,255,.2);
  backdrop-filter: blur(6px);
}
.dsh-chip svg { flex-shrink: 0; }
.dsh-chip > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.dsh-hero-title { margin: 16px 0 6px; font-size: clamp(22px, 3vw, 32px); font-weight: 800; letter-spacing: -.03em; line-height: 1.15; color: #fff; }
.dsh-hero-sub { margin: 0; max-width: 520px; font-size: 13px; line-height: 1.6; color: rgba(255,255,255,.82); }
.dsh-hero-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 20px; }

.dsh-btn {
  display: inline-flex; align-items: center; gap: 8px; padding: 10px 16px; border-radius: 12px;
  font-size: 12.5px; font-weight: 700; line-height: 1; cursor: pointer; border: 1px solid transparent;
  transition: transform 200ms, background-color 200ms, box-shadow 200ms;
}
.dsh-btn-light { background: #fff; color: #065f46; box-shadow: 0 6px 16px -6px rgba(0,0,0,.35); }
.dsh-btn-glass { background: rgba(255,255,255,.14); color: #fff; border-color: rgba(255,255,255,.25); backdrop-filter: blur(6px); }
@media (hover: hover) {
  .dsh-btn-glass:hover { background: rgba(255,255,255,.24); }
}

.dsh-status {
  border-radius: 18px; padding: 16px; color: #fff; background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.2); backdrop-filter: blur(10px);
}
.dsh-status-label { font-size: 10px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: rgba(255,255,255,.7); }
.dsh-status-row { display: flex; align-items: center; gap: 10px; margin-top: 10px; font-size: 13.5px; font-weight: 700; }
.dsh-dot { width: 9px; height: 9px; border-radius: 50%; background: #34d399; flex-shrink: 0; animation: dshPulse 2s infinite; }
.dsh-status-sub { margin-top: 4px; font-size: 11.5px; color: rgba(255,255,255,.75); }
.dsh-search {
  display: flex; align-items: center; gap: 10px; width: 100%; margin-top: 14px; padding: 10px 12px; border-radius: 12px;
  cursor: pointer; font-size: 12px; text-align: left; color: rgba(255,255,255,.88); background: rgba(2,6,23,.28); border: 1px solid rgba(255,255,255,.18);
}
.dsh-search kbd { padding: 2px 7px; border-radius: 6px; font-size: 10px; background: rgba(255,255,255,.16); border: 1px solid rgba(255,255,255,.22); }

/* KPI CARDS */
.dsh-kpis { display: grid; gap: 16px; grid-template-columns: repeat(2, minmax(0,1fr)); }
@media (min-width: 1100px) { .dsh-kpis { grid-template-columns: repeat(3, minmax(0,1fr)); } }
@media (min-width: 1500px) { .dsh-kpis { grid-template-columns: repeat(6, minmax(0,1fr)); } }

.dsh-kpi {
  position: relative; overflow: hidden; min-width: 0; cursor: pointer; padding: 18px 18px 16px; border-radius: 20px;
  background: var(--card-bg); border: 1px solid var(--card-border);
  box-shadow: 0 1px 3px rgba(0,0,0,.1);
  transition: transform 300ms, box-shadow 300ms, border-color 300ms;
}
.dsh-kpi::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 3px; background: linear-gradient(90deg, rgb(var(--accent)), rgba(var(--accent),.15)); }
.dsh-kpi::after { content: ''; position: absolute; right: -34px; top: -34px; width: 120px; height: 120px; border-radius: 50%; background: radial-gradient(circle, rgba(var(--accent),.2), transparent 70%); pointer-events: none; }
@media (hover: hover) {
  .dsh-kpi:hover { transform: translateY(-3px); box-shadow: 0 10px 15px -3px rgba(0,0,0,.2); border-color: rgba(var(--accent),.5); }
}
.dsh-kpi-top { position: relative; z-index: 1; display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.dsh-kpi-label { font-size: 11.5px; font-weight: 700; color: var(--card-label); }
.dsh-ic { width: 38px; height: 38px; border-radius: 12px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: rgba(var(--accent),.18); color: rgb(var(--accent-l, var(--accent))); }
.dsh-kpi-val { position: relative; z-index: 1; margin-top: 14px; font-size: 30px; font-weight: 800; line-height: 1.05; letter-spacing: -.035em; color: var(--card-text); font-variant-numeric: tabular-nums; }
.dsh-kpi-sub { position: relative; z-index: 1; margin-top: 6px; font-size: 11.5px; color: var(--card-sub); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dsh-split { position: relative; z-index: 1; display: flex; height: 6px; margin-top: 10px; border-radius: 999px; overflow: hidden; background: var(--split-bg); }
.dsh-split span { display: block; height: 100%; transition: width 900ms cubic-bezier(0.16,1,0.3,1); }
.dsh-split span:first-child { background: #3b82f6; }
.dsh-split span:last-child  { background: #ec4899; }

/* GRID & CARD */
.dsh-grid { display: grid; gap: 20px; grid-template-columns: repeat(12, minmax(0,1fr)); }
.dsh-span-6 { grid-column: span 6; }
@media (max-width: 767px) { .dsh-span-6 { grid-column: span 6; } }

.dsh-card {
  position: relative; min-width: 0; overflow: hidden; padding: 22px;
  background: var(--card-bg); border: 1px solid var(--card-border);
  border-radius: 22px; box-shadow: 0 1px 3px rgba(0,0,0,.1); transition: border-color 300ms, box-shadow 300ms;
}
@media (hover: hover) {
  .dsh-card:hover { border-color: rgba(var(--accent),.4); box-shadow: 0 4px 6px rgba(0,0,0,.1); }
}
.dsh-card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 18px; padding-bottom: 16px; border-bottom: 1px solid var(--card-border); }
.dsh-card-head-l { display: flex; align-items: center; gap: 12px; min-width: 0; }
.dsh-card-title { font-size: 14.5px; font-weight: 700; letter-spacing: -.01em; color: var(--card-text); }
.dsh-card-sub   { margin-top: 2px; font-size: 11.5px; color: var(--card-sub); }
.dsh-pill { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 999px; font-size: 11.5px; font-weight: 700; color: rgb(var(--accent-l, var(--accent))); background: rgba(var(--accent),.12); border: 1px solid rgba(var(--accent),.28); }
@media (max-width: 520px) { .dsh-pill { display: none; } }

.dsh-donut { display: flex; flex-direction: column; align-items: center; gap: 20px; }
.dsh-donut-canvas { position: relative; width: 100%; max-width: 240px; aspect-ratio: 1 / 1; }

.dsh-donut-cap { font-size: 10px; text-transform: uppercase; letter-spacing: .12em; font-weight: 700; color: var(--card-sub); margin-bottom: 2px; }
.dsh-donut-cap.blue { color: #60a5fa; margin-top: 4px; margin-bottom: 0; }
.dsh-donut-cap.green { color: #34d399; margin-top: 4px; margin-bottom: 0; }
.dsh-donut-num { font-size: 30px; font-weight: 800; color: var(--card-text); line-height: 1; font-family: 'JetBrains Mono', ui-monospace, monospace; }

/* RING & ATT */
.dsh-ring-wrap { position: relative; width: 148px; height: 148px; margin: 0 auto 18px; }
.dsh-ring { width: 100%; height: 100%; display: block; }
.dsh-ring-bg { fill: none; stroke: var(--card-border); stroke-width: 10; }
.dsh-ring-fg { fill: none; stroke: url(#dshRingGrad); stroke-width: 10; stroke-linecap: round; transition: stroke-dashoffset 1.1s cubic-bezier(0.16,1,0.3,1); }
.dsh-ring-center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.dsh-ring-pct { font-size: 28px; font-weight: 800; color: var(--card-text); }
.dsh-ring-cap { font-size: 10px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--card-sub); }
.dsh-ring-sub { margin: -6px 0 16px; text-align: center; font-size: 11.5px; color: var(--card-sub); }
.dsh-att-title { margin: 0 0 10px; font-size: 10.5px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--card-sub); }
.dsh-att-list { display: flex; flex-direction: column; gap: 8px; }
.dsh-att {
  display: flex; align-items: center; gap: 12px; width: 100%; padding: 11px 12px; border-radius: 14px; cursor: pointer;
  text-align: left; font-size: 12.5px; line-height: 1.35; color: var(--card-sub);
  background: var(--card-bg); border: 1px solid var(--card-border);
  transition: transform 200ms, border-color 200ms;
}
@media (hover: hover) {
  .dsh-att:hover { transform: translateX(3px); border-color: rgba(16,185,129,.5); }
}
.dsh-att b { font-size: 15px; font-weight: 800; color: var(--card-text); }
.dsh-att > span:nth-child(2) { flex: 1; min-width: 0; }
.dsh-att-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
.dsh-att-dot.warn { background: #f59e0b; box-shadow: 0 0 0 4px rgba(245,158,11,.18); }
.dsh-att-dot.bad  { background: #ef4444; box-shadow: 0 0 0 4px rgba(239,68,68,.18); }

.dsh-bar-wrap { position: relative; width: 100%; height: 280px; }

/* Polish desktop */
.dsh-hero { border-radius: 24px !important; padding: 32px !important; }
.dsh-card { border-radius: 20px !important; padding: 24px !important; }
.dsh-kpi { padding: 20px !important; border-radius: 18px !important; }
.dsh-kpi-val { font-size: 32px !important; }

/* ============ MOBILE ============ */
@media (max-width: 767px) {
  .dsh-grid { gap: 12px !important; }

  .dsh-hero { padding: 18px !important; border-radius: 20px !important; }
  .dsh-hero-title { font-size: 19px !important; margin: 12px 0 4px; line-height: 1.2; }
  .dsh-hero-sub { font-size: 11.5px; line-height: 1.5; }
  .dsh-chips { gap: 6px; }
  .dsh-chip { font-size: 10px; padding: 5px 9px; gap: 4px; }
  .dsh-chip svg { width: 12px; height: 12px; }
  .dsh-hero-actions { gap: 8px; margin-top: 14px; }
  .dsh-btn { padding: 9px 13px; font-size: 11.5px; gap: 6px; border-radius: 10px; }
  .dsh-btn svg { width: 14px; height: 14px; }
  .dsh-status { display: none; }

  .dsh-kpis { grid-template-columns: repeat(2, minmax(0,1fr)) !important; gap: 10px; }
  .dsh-kpi { padding: 13px !important; border-radius: 16px !important; }
  .dsh-kpi-top { gap: 6px; }
  .dsh-kpi-label { font-size: 10px; line-height: 1.2; }
  .dsh-ic { width: 30px; height: 30px; border-radius: 10px; }
  .dsh-ic svg { width: 15px; height: 15px; }
  .dsh-kpi-val { font-size: 22px !important; margin-top: 10px; }
  .dsh-kpi-sub {
    font-size: 10px; line-height: 1.3; margin-top: 4px;
    white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
  .dsh-split { height: 5px; margin-top: 8px; }

  .dsh-card { padding: 16px !important; border-radius: 16px !important; }
  .dsh-card-head { margin-bottom: 14px; padding-bottom: 12px; gap: 8px; }
  .dsh-card-head-l { gap: 10px; }
  .dsh-card-title { font-size: 13px; }
  .dsh-card-sub { font-size: 10.5px; }
  .dsh-card .dsh-ic { width: 32px; height: 32px; }
  .dsh-card .dsh-ic svg { width: 16px; height: 16px; }

  .dsh-donut { gap: 14px; }
  .dsh-donut-canvas { max-width: 200px; }
  .dsh-donut-num { font-size: 24px; }
  .dsh-donut-cap { font-size: 9px; }

  .dsh-ring-wrap { width: 120px; height: 120px; margin-bottom: 14px; }
  .dsh-ring-pct { font-size: 22px; }
  .dsh-ring-sub { font-size: 11px; margin-bottom: 14px; }

  .dsh-att { padding: 9px 11px; font-size: 11.5px; gap: 10px; border-radius: 12px; }
  .dsh-att b { font-size: 14px; }
  .dsh-att svg { width: 14px; height: 14px; }

  .dsh-bar-wrap { height: 260px; }
}

@media (max-width: 380px) {
  .dsh-kpi-val { font-size: 20px !important; }
  .dsh-kpi-label { font-size: 9.5px; }
  .dsh-kpi-sub { font-size: 9.5px; }
  .dsh-hero-title { font-size: 17px !important; }
  .dsh-btn { padding: 8px 11px; font-size: 11px; }
  .dsh-donut-num { font-size: 22px; }
}
</style>
