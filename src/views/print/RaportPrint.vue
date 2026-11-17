<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '../../lib/supabase'
import { Printer, ArrowLeft } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
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

const data = ref(null)
const loading = ref(true)

const SEM_KEYS = ['smt1','smt2','smt3','smt4','smt5','smt6']
const SEM_ROMAWI = ['I','II','III','IV','V','VI']
const SEM_KELAS = ['X','X','XI','XI','XII','XII']
const BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']

const KKM_MAP = {
  'Pendidikan Agama Islam dan Budi Pekerti': 70, 'Pendidikan Pancasila': 70,
  'Bahasa Indonesia': 75, 'Matematika': 75, 'Ilmu Pengetahuan Alam': 75,
  'Ilmu Pengetahuan Sosial': 75, 'Bahasa Inggris': 75,
  'Pendidikan Jasmani, Olahraga, dan Kesehatan': 75, 'Informatika': 75,
  'Sejarah': 75, 'Seni, Budaya, dan Prakarya': 75,
  'Fisika': 75, 'Kimia': 70, 'Geografi': 70, 'Ekonomi': 70,
  'Bahasa Arab': 85, 'Bahasa Daerah': 80, 'Fiqih': 80
}
const MAPEL_UMUM = [
  'Pendidikan Agama Islam dan Budi Pekerti','Pendidikan Pancasila','Bahasa Indonesia',
  'Matematika','Ilmu Pengetahuan Alam','Ilmu Pengetahuan Sosial','Bahasa Inggris',
  'Pendidikan Jasmani, Olahraga, dan Kesehatan','Informatika','Sejarah',
  'Seni, Budaya, dan Prakarya'
]
const MAPEL_PILIHAN = ['Fisika','Kimia','Geografi','Ekonomi','Bahasa Arab']
const MAPEL_LOKAL = ['Bahasa Daerah','Fiqih']

function angkaTerbilang(angka) {
  if (angka === null || angka === undefined || angka === '') return '-'
  const num = Math.round(parseFloat(angka))
  if (isNaN(num)) return '-'
  if (num === 0) return 'Nol'
  const satuan = ['','Satu','Dua','Tiga','Empat','Lima','Enam','Tujuh','Delapan','Sembilan']
  const puluhan = ['','Sepuluh','Dua Puluh','Tiga Puluh','Empat Puluh','Lima Puluh','Enam Puluh','Tujuh Puluh','Delapan Puluh','Sembilan Puluh']
  if (num < 10) return satuan[num]
  if (num === 10) return 'Sepuluh'
  if (num < 20) return num === 11 ? 'Sebelas' : satuan[num - 10] + ' Belas'
  if (num < 100) {
    const puluh = Math.floor(num / 10), satu = num % 10
    return satu === 0 ? puluhan[puluh] : puluhan[puluh] + ' ' + satuan[satu]
  }
  if (num < 200) return num === 100 ? 'Seratus' : 'Seratus ' + angkaTerbilang(num - 100)
  if (num < 1000) {
    const ratus = Math.floor(num / 100), sisa = num % 100
    return sisa === 0 ? satuan[ratus] + ' Ratus' : satuan[ratus] + ' Ratus ' + angkaTerbilang(sisa)
  }
  return num.toString()
}

const fmtAngka = (v) => (v === null || v === undefined || v === '' || isNaN(parseFloat(v))) ? '-' : Math.round(parseFloat(v))

function tanggalCetak() {
  const d = new Date()
  return `Pamekasan, ${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`
}

onMounted(async () => {
  const noInduk = route.params.noInduk
  const smt = parseInt(route.params.smt, 10) || 1
  const key = SEM_KEYS[smt - 1]

  const [rSiswa, rNilai] = await Promise.all([
    supabase.from('siswa').select('*').eq('no_induk', noInduk).single(),
    supabase.from('nilai').select('nilai_data').eq('no_induk', noInduk).maybeSingle()
  ])
  if (!rSiswa.data) { loading.value = false; return }

  const s = rSiswa.data
  const nd = (rNilai.data && rNilai.data.nilai_data) || {}
  const sem = nd[key] || {}
  const mapelList = sem.mapel || []

  let jumlah = 0, count = 0
  mapelList.forEach(m => {
    const t = parseFloat(m.teori)
    if (!isNaN(t)) { jumlah += t; count++ }
  })

  const buildKelompok = (filter) => mapelList.filter(m => filter.includes(m.mapel)).map((m, i) => ({
    no: i + 1,
    nama: m.mapel,
    kkm: KKM_MAP[m.mapel] || 75,
    teori: fmtAngka(m.teori),
    teoriHuruf: angkaTerbilang(m.teori),
    praktek: fmtAngka(m.praktek),
    praktekHuruf: angkaTerbilang(m.praktek),
    sikap: 'A'
  }))

  data.value = {
    nama: s.nama || '-',
    noInduk: s.no_induk || '-',
    kelas: SEM_KELAS[smt - 1],
    semesterRomawi: SEM_ROMAWI[smt - 1],
    tahunPelajaran: sem.tahun || '-',
    kelompokUmum: buildKelompok(MAPEL_UMUM),
    kelompokPilihan: buildKelompok(MAPEL_PILIHAN),
    kelompokLokal: buildKelompok(MAPEL_LOKAL),
    jumlah: count > 0 ? Math.round(jumlah) : '-',
    rataRata: count > 0 ? (jumlah / count).toFixed(2) : '-',
    tanggalCetak: tanggalCetak()
  }
  loading.value = false
})
</script>

<template>
  <div class="print-wrapper">
    <div class="no-print top-bar">
      <button @click="router.push('/pusat-cetak')" class="btn-back">
        <ArrowLeft class="w-4 h-4" /> Kembali
      </button>
      <button @click="doPrint" class="btn-print">
        <Printer class="w-4 h-4" /> Cetak
      </button>
    </div>

    <div v-if="loading" class="raport-page" style="text-align:center;padding:40px;color:#666;">Memuat...</div>

    <div v-else-if="data" class="raport-page">
      <div class="kop-surat">
        <img src="https://res.cloudinary.com/dqzhp3lnq/image/upload/v1789040483/KOP_c2ca2x.png" alt="Kop Surat">
      </div>

      <div class="raport-title">LAPORAN HASIL BELAJAR SISWA</div>

      <table class="identitas">
        <tbody>
          <tr>
            <td style="width:18%;">Nama Siswa</td>
            <td style="width:2%;">:</td>
            <td style="width:35%;font-weight:bold;">{{ data.nama }}</td>
            <td style="width:3%;"></td>
            <td style="width:18%;">Kelas/Semester</td>
            <td style="width:2%;">:</td>
            <td style="width:22%;font-weight:bold;">{{ data.kelas }} / {{ data.semesterRomawi }}</td>
          </tr>
          <tr>
            <td>Nomor Induk</td><td>:</td><td>{{ data.noInduk }}</td><td></td>
            <td>Tahun Pelajaran</td><td>:</td><td>{{ data.tahunPelajaran }}</td>
          </tr>
        </tbody>
      </table>

      <table class="nilai-table">
        <colgroup><col><col><col><col><col><col><col><col><col></colgroup>
        <thead>
          <tr class="header-row-1">
            <th rowspan="3">NO</th>
            <th colspan="2" rowspan="3">MATA PELAJARAN</th>
            <th rowspan="3">KKM</th>
            <th colspan="4">Nilai Hasil Belajar</th>
            <th rowspan="3">Sikap</th>
          </tr>
          <tr class="header-row-2">
            <th colspan="2">Pengetahuan</th>
            <th colspan="2">Praktek</th>
          </tr>
          <tr class="header-row-3">
            <th>Angka</th><th>Huruf</th><th>Angka</th><th>Huruf</th>
          </tr>
        </thead>
        <tbody>
          <tr class="kelompok"><td colspan="8">Kelompok Mata Pelajaran Umum</td><td></td></tr>
          <tr v-for="m in data.kelompokUmum" :key="'u'+m.no">
            <td class="nomor">{{ m.no }}</td>
            <td colspan="2" class="mata-pelajaran">{{ m.nama }}</td>
            <td class="angka">{{ m.kkm }}</td>
            <td class="angka">{{ m.teori }}</td>
            <td class="huruf">{{ m.teoriHuruf }}</td>
            <td class="angka">{{ m.praktek }}</td>
            <td class="huruf">{{ m.praktekHuruf }}</td>
            <td class="sikap">{{ m.sikap }}</td>
          </tr>

          <tr class="kelompok"><td colspan="8">Kelompok Mata Pelajaran Pilihan</td><td></td></tr>
          <tr v-for="m in data.kelompokPilihan" :key="'p'+m.no">
            <td class="nomor">{{ m.no }}</td>
            <td colspan="2" class="mata-pelajaran">{{ m.nama }}</td>
            <td class="angka">{{ m.kkm }}</td>
            <td class="angka">{{ m.teori }}</td>
            <td class="huruf">{{ m.teoriHuruf }}</td>
            <td class="angka">{{ m.praktek }}</td>
            <td class="huruf">{{ m.praktekHuruf }}</td>
            <td class="sikap">{{ m.sikap }}</td>
          </tr>

          <tr class="kelompok"><td colspan="8">Muatan Lokal</td><td></td></tr>
          <tr v-for="m in data.kelompokLokal" :key="'l'+m.no">
            <td class="nomor">{{ m.no }}</td>
            <td colspan="2" class="mata-pelajaran">{{ m.nama }}</td>
            <td class="angka">{{ m.kkm }}</td>
            <td class="angka">{{ m.teori }}</td>
            <td class="huruf">{{ m.teoriHuruf }}</td>
            <td class="angka">{{ m.praktek }}</td>
            <td class="huruf">{{ m.praktekHuruf }}</td>
            <td class="sikap">{{ m.sikap }}</td>
          </tr>

          <tr class="rekap"><td colspan="3" class="rekap-label">Jumlah</td><td colspan="5" class="rekap-value">{{ data.jumlah }}</td><td></td></tr>
          <tr class="rekap"><td colspan="3" class="rekap-label">Rata-Rata</td><td colspan="5" class="rekap-value">{{ data.rataRata }}</td><td></td></tr>
          <tr class="rekap"><td colspan="3" class="rekap-label">Peringkat</td><td colspan="3" class="rekap-value">-</td><td colspan="2" class="rekap-value">-</td><td></td></tr>
        </tbody>
      </table>

      <div class="footer-area">
        <div class="tanggal">{{ data.tanggalCetak }}</div>
        <div class="ttd">
          <div class="ttd-jabatan">Mengetahui,</div>
          <div class="ttd-jabatan">Kepala Sekolah</div>
          <div class="ttd-spacer">
            <img src="https://res.cloudinary.com/dqzhp3lnq/image/upload/v1789437364/TTD_KPL_mjucef.png"
                 alt="Tanda Tangan" class="ttd-image">
          </div>
          <div class="ttd-nama">ACH. MA'RUF TAMAM, S.Pd.</div>
          <div class="ttd-nip">NIP:</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import './print.css';

.raport-page {
  width: 215mm;
  min-height: 330mm;
  margin: 0 auto;
  padding: 10mm;
  background: #fff;
  color: #000;
  font-family: "Times New Roman", Times, serif;
  font-size: 11pt;
  line-height: 1.15;
  box-shadow: 0 0 0 1px #ddd, 0 5px 25px rgba(0,0,0,0.08);
}

.kop-surat { width: 100%; text-align: center; border-bottom: 3px double #000; padding-bottom: 4mm; margin-bottom: 5mm; }
.kop-surat img { width: 100%; height: auto; display: block; }

.raport-title { display: flex; align-items: center; justify-content: center; margin-bottom: 15px; font-size: 14pt; font-weight: bold; text-align: center; }

.identitas { width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 13px; font-size: 11pt; }
.identitas td { padding: 2px 0; height: 15px; vertical-align: middle; }

.nilai-table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 9pt; }
.nilai-table col:nth-child(1) { width: 5%; }
.nilai-table col:nth-child(4) { width: 6%; }
.nilai-table col:nth-child(5) { width: 7%; }
.nilai-table col:nth-child(6) { width: 15%; }
.nilai-table col:nth-child(7) { width: 7%; }
.nilai-table col:nth-child(8) { width: 15%; }
.nilai-table col:nth-child(9) { width: 7%; }
.nilai-table th, .nilai-table td { border: 1px solid #000; }
.nilai-table th { font-weight: bold; text-align: center; vertical-align: middle; padding: 1px 3px; height: 12px; }
.nilai-table tbody td { height: 25px; padding: 1px 3px; vertical-align: middle; }

.nomor { text-align: center; }
.mata-pelajaran { text-align: left; line-height: 1.0; }
.angka { text-align: center; }
.huruf { text-align: left; padding-left: 3px !important; font-size: 8pt; line-height: 1.0; }
.sikap { text-align: center; }

.kelompok td { height: 30px; padding: 1px 5px !important; font-weight: bold; text-align: left; }
.rekap td { height: 14px; padding: 1px 5px; }
.rekap-label { font-weight: bold; text-align: left; }
.rekap-value { text-align: center; font-weight: bold; }

.footer-area { width: 100%; margin-top: 12px; }
.tanggal { width: 50%; margin-left: 50%; text-align: left; font-size: 11pt; white-space: nowrap; }
.ttd { width: 50%; margin-left: 50%; margin-top: 5px; text-align: left; font-size: 11pt; }
.ttd-jabatan { line-height: 1.2; }
.ttd-spacer { height: 90px; }
.ttd-image { width: 200px; height: auto; display: block; margin-left: -10px; margin-top: -18px; }
.ttd-nama { font-weight: bold; text-decoration: underline; white-space: nowrap; }
.ttd-nip { margin-top: 2px; }

@media print {
  .print-wrapper { background: #fff; padding: 0; }
  .no-print { display: none !important; }
  .raport-page { box-shadow: none; margin: 0; page-break-after: always; }
  .raport-page:last-child { page-break-after: auto; }
  .nilai-table tr { page-break-inside: avoid; break-inside: avoid; }
}
</style>

<style>
@media print {
  @page { size: 215mm 330mm; margin: 0; }
  html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
  body.printing > #app { display: none !important; }
  body.printing > .print-clone { display: block !important; width: 100% !important; }
  .print-clone .no-print { display: none !important; }
}
</style>