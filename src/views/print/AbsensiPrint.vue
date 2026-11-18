<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '../../lib/supabase'
import { Printer, ArrowLeft } from 'lucide-vue-next'
import { isSiswaTampilDiAbsen } from '../../lib/status' 

const route = useRoute()
const router = useRouter()
const data = ref(null)
const loading = ref(true)

const BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
function tanggalCetak() {
  const d = new Date()
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`
}

const PER_HALAMAN = 50

function normalizeKelas(kelas) {
  const k = String(kelas || '').trim()
  const m = k.match(/^Berhenti\s+(.+)$/i)
  return m ? m[1].trim() : k
}
function isBerhenti(kelas) {
  return /^Berhenti\s+/i.test(String(kelas || '').trim())
}

onMounted(async () => {
  const type = route.params.type || 'kelas'
  const key = decodeURIComponent(route.params.kelas || '')
  const q = route.query

  const tanggal = q.tanggal || tanggalCetak()

  if (type === 'kelas') {
    const { data: rows } = await supabase.from('siswa').select('no_induk, nama, kelas, alamat, status').order('nama')
    const list = (rows || [])
      .filter(s => isSiswaTampilDiAbsen(s)) // <-- GUNAKAN FUNGSI BARU INI
      .filter(s => normalizeKelas(s.kelas) === normalizeKelas(key))
      .map((s, i) => ({ 
        no: i + 1, 
        noInduk: s.no_induk, 
        nama: s.nama, 
        alamat: s.alamat || '', 
        berhenti: String(s.kelas).toLowerCase().includes('berhenti') // Ini akan memberi warna merah
      }))
    data.value = {
      kelas: key, jenis: q.jenis || 'guru', semester: q.semester || 'Ganjil', tahun: q.tahun || '',
      mapel: q.mapel || '', guru: q.guru || '', waliKelas: q.waliKelas || '',
      kepalaSekolah: q.kepalaSekolah || "ACH. MA'RUF TAMAM, S.Pd.",
      judul: 'DAFTAR HADIR SISWA', tanggal, list
    }
  } else if (type === 'nabil') {
    const { data: rows } = await supabase.from('v_nabil_lengkap').select('*').eq('kelompok_nabil', key).order('nama')
    const list = (rows || [])
      .filter(s => isSiswaAktif(s))
      .map((s, i) => ({ no: i + 1, noInduk: s.no_induk, nama: s.nama, alamat: s.alamat || '', berhenti: false }))
    data.value = {
      kelas: 'Kelompok ' + key, jenis: q.jenis || 'guru', semester: q.semester || 'Ganjil', tahun: q.tahun || '',
      mapel: 'Bahtsul Masail', guru: q.guru || '',
      kepalaSekolah: q.kepalaSekolah || "ACH. MA'RUF TAMAM, S.Pd.",
      judul: 'DAFTAR HADIR KELOMPOK NABIL', tanggal, list
    }
  } else if (type === 'sorogan') {
    const { data: rows } = await supabase.from('v_sorogan_lengkap').select('*').eq('pembimbing', key).order('nama')
    const list = (rows || [])
      .filter(s => isSiswaAktif(s))
      .map((s, i) => ({ no: i + 1, noInduk: s.no_induk, nama: s.nama, alamat: s.alamat || '', berhenti: false }))
    data.value = {
      kelas: 'Kelas Sorogan', jenis: q.jenis || 'guru', semester: q.semester || 'Ganjil', tahun: q.tahun || '',
      mapel: 'Sorogan Kitab Kuning', guru: q.pembimbing || key,
      kepalaSekolah: q.kepalaSekolah || "ACH. MA'RUF TAMAM, S.Pd.",
      judul: 'DAFTAR HADIR KELAS SOROGAN', tanggal, list
    }
  } else {
    loading.value = false
    return
  }

  loading.value = false
  await nextTick()
  requestAnimationFrame(() => autoShrinkAll())
})

const halamanList = computed(() => {
  if (!data.value) return []
  const pages = []
  for (let i = 0; i < data.value.list.length; i += PER_HALAMAN) {
    pages.push(data.value.list.slice(i, i + PER_HALAMAN))
  }
  return pages.length > 0 ? pages : [[]]
})

const isMurid = computed(() => data.value?.jenis === 'murid')
const jumlahKolom = computed(() => isMurid.value ? 18 : 15)
const dateWidth = computed(() => {
  const fixed = 70
  return ((100 - fixed) / jumlahKolom.value).toFixed(3) + '%'
})

function autoShrinkAll() {
  document.querySelectorAll('.nama-cell, .alamat-cell').forEach(cell => {
    const span = cell.querySelector('span')
    if (!span) return
    const maxSize = cell.classList.contains('nama-cell') ? 14 : 13
    const available = cell.clientWidth - 6
    let low = 2, high = maxSize, best = 2
    while ((high - low) > 0.1) {
      const mid = (low + high) / 2
      span.style.fontSize = mid + 'px'
      if (span.scrollWidth <= available) { best = mid; low = mid }
      else { high = mid }
    }
    span.style.fontSize = best.toFixed(2) + 'px'
  })
}

function doPrint() {
  const wrapper = document.querySelector('.print-wrapper')
  if (!wrapper) return window.print()
  const clone = wrapper.cloneNode(true)
  clone.classList.add('print-clone')
  document.body.appendChild(clone)
  document.body.classList.add('printing')
  const cleanup = () => {
    document.querySelectorAll('.print-clone').forEach(el => el.remove())
    document.body.classList.remove('printing')
    window.removeEventListener('afterprint', cleanup)
  }
  window.addEventListener('afterprint', cleanup)
  window.print()
  setTimeout(cleanup, 1500)
}
function goBack() { router.push('/absen-kelas') }
</script>

<template>
  <div class="print-wrapper">
    <div class="no-print top-bar">
      <button @click="goBack" class="btn-back">
        <ArrowLeft class="w-4 h-4" /> Kembali
      </button>
      <button @click="doPrint" class="btn-print">
        <Printer class="w-4 h-4" /> Cetak
      </button>
    </div>

    <div v-if="loading" class="paper">
      <div style="text-align:center;padding:40px;color:#666;">Memuat...</div>
    </div>

    <div v-else-if="!data" class="paper">
      <div style="text-align:center;padding:40px;color:#666;">Tipe absensi ini belum didukung</div>
    </div>

    <div v-else class="print-container">
      <!-- HEADER -->
      <div class="header">
        <div class="header-flex">
          <img class="logo" src="https://res.cloudinary.com/dqzhp3lnq/image/upload/v1781580065/Copy_of_SMA_Itsbatiyah_fnnhdy.png" alt="Logo">
          <div class="header-text">
            <div class="title-judul">{{ data.judul }}</div>
            <div class="school-name">SMA AL-ITSBATIYAH</div>
            <div class="school-sub">DARUL ULUM BANYUANYAR PALENGAAN PAMEKASAN</div>
            <div class="school-address">POTAN DAYA PALENGAAN PAMEKASAN MADURA</div>
            <div class="school-year">Tahun Pelajaran {{ data.tahun || '............' }}</div>
          </div>
          <div></div>
        </div>
      </div>

      <!-- INFO -->
      <table class="info-table">
        <tr>
          <td class="label">Kelas</td>
          <td class="titik">:</td>
          <td class="value">{{ data.kelas }}</td>
          <td class="label">Semester</td>
          <td class="titik">:</td>
          <td class="value">{{ data.semester }}</td>
        </tr>
        <tr>
          <td class="label">Mata Pelajaran</td>
          <td class="titik">:</td>
          <td class="value">{{ data.mapel || '............' }}</td>
          <td class="label">Guru Mapel</td>
          <td class="titik">:</td>
          <td class="value">{{ data.guru || '............' }}</td>
        </tr>
      </table>

      <!-- PAGES -->
      <div class="pages-wrapper">
        <div v-for="(page, pi) in halamanList" :key="pi" class="page-break">
          <table class="absen-table" :class="{ 'guru-table': !isMurid }">
            <thead v-if="!isMurid">
              <tr>
                <th class="col-no" rowspan="2">NO</th>
                <th class="col-nis" rowspan="2">NIS</th>
                <th class="col-name" rowspan="2">NAMA</th>
                <th class="col-address" rowspan="2">ALAMAT</th>
                <th colspan="15">TANGGAL</th>
                <th colspan="3">JUMLAH</th>
              </tr>
              <tr>
                <th v-for="i in 15" :key="'d'+i" class="col-date" :style="{ width: dateWidth }"></th>
                <th class="col-total">S</th>
                <th class="col-total">I</th>
                <th class="col-total">A</th>
              </tr>
            </thead>
            <thead v-else>
              <tr>
                <th class="col-no" rowspan="3">NO</th>
                <th class="col-nis" rowspan="3">NIS</th>
                <th class="col-name" rowspan="3">NAMA</th>
                <th class="col-address" rowspan="3">ALAMAT</th>
                <th colspan="18">HARI / TANGGAL</th>
                <th colspan="3" rowspan="3">JUMLAH</th>
              </tr>
              <tr>
                <th v-for="h in ['AHAD','SENIN','SELASA','RABU','KAMIS','SABTU']" :key="h" colspan="3">{{ h }}</th>
              </tr>
              <tr>
                <th v-for="i in 18" :key="'j'+i" class="col-date" :style="{ width: dateWidth }">{{ ['I','II','III'][(i-1)%3] }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in page" :key="r.noInduk" :class="{ berhenti: r.berhenti }">
                <td>{{ r.no }}</td>
                <td>{{ r.noInduk }}</td>
                <td class="nama-cell"><span>{{ r.nama }}</span></td>
                <td class="alamat-cell"><span>{{ r.alamat }}</span></td>
                <td v-for="i in jumlahKolom" :key="'cell'+i"></td>
                <td></td><td></td><td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- FOOTER -->
      <div class="footer">
        <div class="signature">
          <div class="block">
            <div>Mengetahui,</div>
            <div style="margin-top:4mm;">Kepala Sekolah</div>
            <div class="line"><b><u>{{ data.kepalaSekolah }}</u></b></div>
          </div>
          <div class="block">
            <div style="margin-top:8mm;">Wali Kelas</div>
            <div class="line"><b><u>{{ data.waliKelas || '............' }}</u></b></div>
          </div>
          <div class="block">
            <div>Pamekasan, {{ data.tanggal }}</div>
            <div style="margin-top:4mm;">Guru Mata Pelajaran</div>
            <div class="line"><b><u>{{ data.guru || '............' }}</u></b></div>
          </div>
        </div>
        <div class="note"><b>NB: dimohon untuk tidak mencantumkan siswa baru tanpa ada keterangan dari TU sekolah</b></div>
      </div>
    </div>
  </div>
</template>

<style>
@page {
  size: 210mm 330mm;
  margin: 10mm 8mm 8mm 10mm;
}

@media print {
  html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
  body.printing > #app { display: none !important; }
  body.printing > .print-clone { display: block !important; width: 100% !important; }
  .print-clone .no-print { display: none !important; }
}
</style>

<style scoped>
.print-wrapper {
  min-height: auto;
  padding: 10px;
}

.no-print.top-bar {
  position: relative;
  max-width: 210mm;
  margin: 0 auto 16px;
  padding: 10px;
  background: rgba(43, 54, 158, 0.95);
  backdrop-filter: blur(8px);
  border-radius: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.btn-back, .btn-print {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 40px;
  padding: 0 20px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 700;
  border: none;
  cursor: pointer;
  transition: all 200ms;
  color: #fff;
}
.btn-back { background: #6b7280; }
.btn-back:hover { background: #4b5563; }
.btn-print { background: linear-gradient(135deg, #2563eb, #1d4ed8); }
.btn-print:hover { transform: translateY(-2px); box-shadow: 0 4px 15px rgba(0,0,0,0.3); }

.paper {
  width: 210mm;
  min-height: 297mm;
  margin: 0 auto;
  padding: 15mm 18mm;
  background: #fff;
  color: #000;
}

/* ===== PRINT CONTAINER ===== */
.print-container {
  font-family: 'Times New Roman', Times, serif;
  width: 210mm;
  margin: 0 auto;
  background: white;
  padding: 8mm 10mm;
  box-shadow: 0 2px 20px rgba(0,0,0,0.15);
  min-height: 310mm;
  color: #000;
}

/* ===== HEADER ===== */
.header {
  text-align: center;
  border-bottom: 3px double #000;
  padding-bottom: 4mm;
  margin-bottom: 4mm;
}
.header-flex {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}
.logo {
  width: 22mm;
  height: 22mm;
  object-fit: contain;
}
.header-text { text-align: center; line-height: 1.15; }
.header-text .title-judul { font-size: 14px; font-weight: 700; letter-spacing: 1px; }
.header-text .school-name { font-size: 18px; font-weight: 900; letter-spacing: 2px; }
.header-text .school-sub { font-size: 13px; font-weight: 600; letter-spacing: 0.5px; }
.header-text .school-address { font-size: 11px; color: #444; }
.header-text .school-year { font-size: 12px; font-weight: 600; }

/* ===== INFO ===== */
.info-table {
  width: 100%;
  border-collapse: collapse;
  margin: 2mm 0 1mm;
  font-size: 12px;
}
.info-table td {
  border: none;
  padding: 0.6mm 1mm;
  white-space: nowrap;
  vertical-align: middle;
}
.info-table .label { width: 22mm; font-weight: bold; }
.info-table .titik { width: 3mm; text-align: center; font-weight: bold; }
.info-table .value { width: 73mm; font-weight: normal; }

/* ===== TABLE ===== */
.absen-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 10px;
}
.absen-table th {
  background: #e8e8e8;
  border: 1px solid #000;
  padding: 1.4mm 0.5mm;
  text-align: center;
  vertical-align: middle;
  font-weight: 700;
  line-height: 1.15;
}
.guru-table thead tr:last-child th {
  height: 8mm;
  padding: 5mm 0.5mm;
}
.absen-table td {
  border: 1px solid #000;
  padding: 0.4mm 0.6mm;
  text-align: center;
  vertical-align: middle;
  line-height: 1.1;
  overflow: hidden;
}
.absen-table tbody tr { height: 5mm; }

.absen-table .col-no { width: 4%; }
.absen-table .col-nis { width: 8%; }
.absen-table .col-name { width: 24%; text-align: left; padding-left: 2mm; white-space: nowrap; }
.absen-table .col-address { width: 22%; text-align: left; padding-left: 2mm; white-space: nowrap; }
.absen-table .col-total { width: 4%; }
.absen-table .berhenti { background: #ffcccc; }

.absen-table td:nth-child(3),
.absen-table td:nth-child(4) {
  text-align: left;
  white-space: nowrap;
  padding-left: 2mm;
}
.nama-cell, .alamat-cell { text-align: left; padding-left: 2mm; white-space: nowrap; }
.nama-cell span, .alamat-cell span { display: inline-block; white-space: nowrap; }

/* ===== FOOTER ===== */
.footer { margin-top: 4mm; padding-top: 0; border: 0; }
.footer .signature {
  display: flex;
  justify-content: space-between;
  text-align: center;
  font-size: 12px;
}
.footer .signature .block { width: 33%; }
.footer .signature .line { margin-top: 12mm; padding-top: 0; border: 0; }
.footer .note { margin-top: 4mm; font-size: 12px; color: #555; font-style: italic; }

/* ===== PAGE BREAK ===== */
.page-break { page-break-after: always; margin-bottom: 5mm; }
.pages-wrapper > .page-break:last-child { page-break-after: auto; }

/* ===== PRINT ===== */
@media print {
  .print-wrapper { background: white; padding: 0; }
  .no-print { display: none !important; }
  .print-container { box-shadow: none; padding: 0; width: 100%; min-height: auto; }
  .page-break { margin-bottom: 0; }
  .berhenti { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .absen-table th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
</style>
