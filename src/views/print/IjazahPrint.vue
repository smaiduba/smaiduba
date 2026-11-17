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

const MAPEL_UMUM = [
  'Pendidikan Agama Islam dan Budi Pekerti','Pendidikan Pancasila','Bahasa Indonesia',
  'Matematika','Ilmu Pengetahuan Alam','Ilmu Pengetahuan Sosial','Bahasa Inggris',
  'Pendidikan Jasmani, Olahraga, dan Kesehatan','Informatika','Sejarah',
  'Seni, Budaya, dan Prakarya'
]
const MAPEL_PILIHAN = ['Fisika','Kimia','Geografi','Ekonomi','Bahasa Arab']
const MAPEL_LOKAL = ['Bahasa Daerah','Fiqih']

onMounted(async () => {
  const noInduk = route.params.noInduk
  const [rSiswa, rNilai] = await Promise.all([
    supabase.from('siswa').select('*').eq('no_induk', noInduk).single(),
    supabase.from('nilai').select('nilai_data').eq('no_induk', noInduk).maybeSingle()
  ])
  if (!rSiswa.data) { loading.value = false; return }

  const s = rSiswa.data
  const d = s.detail_data || {}
  const nd = (rNilai.data && rNilai.data.nilai_data) || {}

  // Hitung rata-rata teori per mapel dari 6 semester
  const mapelMap = {}
  SEM_KEYS.forEach(k => {
    const sem = nd[k] || {}
    ;(sem.mapel || []).forEach(m => {
      const nama = (m.mapel || '').trim()
      const t = parseFloat(m.teori)
      if (nama && !isNaN(t)) {
        if (!mapelMap[nama]) mapelMap[nama] = []
        mapelMap[nama].push(t)
      }
    })
  })
  const dkn = Object.keys(mapelMap).map(nama => {
    const arr = mapelMap[nama]
    return { nama, nilai: (arr.reduce((a,b)=>a+b,0) / arr.length).toFixed(2) }
  })
  const rataRata = dkn.length > 0
    ? (dkn.reduce((a,b)=>a+parseFloat(b.nilai),0) / dkn.length).toFixed(2)
    : '0,00'

  const buildKelompok = (filter) => dkn.filter(m => filter.includes(m.nama))

  data.value = {
    npsn: s.npsn || d.npsn || '69774631',
    nama: s.nama || '-',
    tetala: d.tetala || s.tetala || '-',
    nisn: s.nisn || '-',
    noIjazah: d.no_ijazah || '-',
    tglKelulusan: d.tgl_kelulusan || '-',
    kelompokUmum: buildKelompok(MAPEL_UMUM),
    kelompokPilihan: buildKelompok(MAPEL_PILIHAN),
    kelompokLokal: buildKelompok(MAPEL_LOKAL),
    rataRata
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

    <div v-if="loading" class="ijazah-page" style="text-align:center;padding:40px;color:#666;">Memuat...</div>

    <div v-else-if="data" class="ijazah-page">
      <div class="kop-surat">
        <img src="https://res.cloudinary.com/dqzhp3lnq/image/upload/v1789040483/KOP_c2ca2x.png" alt="Kop Surat">
      </div>

      <div class="ijazah-title">TRANSKIP NILAI</div>

      <table class="biodata-table">
        <colgroup><col style="width:35%"><col style="width:3%"><col style="width:62%"></colgroup>
        <tbody>
          <tr><td class="biodata-label">Satuan pendidikan</td><td>:</td><td>Sekolah Menengah Atas (SMA)</td></tr>
          <tr><td class="biodata-label">Nomor Pokok Sekolah Nasional</td><td>:</td><td>{{ data.npsn }}</td></tr>
          <tr><td class="biodata-label">Nama Lengkap</td><td>:</td><td><strong>{{ data.nama }}</strong></td></tr>
          <tr><td class="biodata-label">Tempat, Tanggal Lahir</td><td>:</td><td>{{ data.tetala }}</td></tr>
          <tr><td class="biodata-label">Nomor Induk Siswa Nasional</td><td>:</td><td>{{ data.nisn }}</td></tr>
          <tr><td class="biodata-label">Nomor Ijazah</td><td>:</td><td>{{ data.noIjazah }}</td></tr>
          <tr><td class="biodata-label">Tanggal Kelulusan</td><td>:</td><td>{{ data.tglKelulusan }}</td></tr>
        </tbody>
      </table>

      <table class="nilai-table">
        <colgroup><col><col><col><col><col><col></colgroup>
        <tbody>
          <tr>
            <th class="nilai-header">NO</th>
            <th colspan="3" class="nilai-header">MATA PELAJARAN</th>
            <th colspan="2" class="nilai-header">NILAI</th>
          </tr>

          <tr class="kelompok-row"><td colspan="6" class="kelompok">Kelompok Mata Pelajaran Umum</td></tr>
          <tr v-for="(m, i) in data.kelompokUmum" :key="'u'+i">
            <td class="nomor">{{ i + 1 }}</td>
            <td colspan="3" class="mapel">{{ m.nama }}</td>
            <td colspan="2" class="nilai">{{ m.nilai }}</td>
          </tr>

          <tr class="kelompok-row"><td colspan="6" class="kelompok">Kelompok Mata Pelajaran Pilihan</td></tr>
          <tr v-for="(m, i) in data.kelompokPilihan" :key="'p'+i">
            <td class="nomor">{{ i + 1 }}</td>
            <td colspan="3" class="mapel">{{ m.nama }}</td>
            <td colspan="2" class="nilai">{{ m.nilai }}</td>
          </tr>

          <tr class="kelompok-row"><td colspan="6" class="kelompok">Muatan Lokal</td></tr>
          <tr v-for="(m, i) in data.kelompokLokal" :key="'l'+i">
            <td class="nomor">{{ i + 1 }}</td>
            <td colspan="3" class="mapel">{{ m.nama }}</td>
            <td colspan="2" class="nilai">{{ m.nilai }}</td>
          </tr>

          <tr>
            <td colspan="4" class="rata-rata-label">Rata-Rata</td>
            <td colspan="2" class="rata-rata-value">{{ data.rataRata }}</td>
          </tr>
        </tbody>
      </table>

      <div class="footer-area">
        <div class="tanggal">Kabupaten Pamekasan, {{ data.tglKelulusan }}</div>
        <div class="ttd">
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

.ijazah-page {
  width: 215mm;
  min-height: 330mm;
  margin: 0 auto;
  padding: 20mm 13mm 10mm 12mm;
  background: #fff;
  color: #000;
  font-family: "Cambria", Georgia, serif;
  font-size: 12pt;
  line-height: 1.15;
  box-shadow: 0 0 0 1px #ddd, 0 5px 25px rgba(0,0,0,0.08);
}

.kop-surat { width: 100%; text-align: center; border-bottom: 3px double #000; padding-bottom: 4mm; margin-bottom: 5mm; }
.kop-surat img { width: 100%; height: auto; display: block; }

.ijazah-title { display: flex; align-items: center; justify-content: center; margin-bottom: 15px; font-size: 14pt; font-weight: bold; text-align: center; }

.biodata-table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 13px; font-size: 12pt; }
.biodata-table td { padding: 0; height: 18px; vertical-align: middle; white-space: nowrap; }
.biodata-colon { text-align: left; padding-left: 2px !important; }

.nilai-table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 12pt; }
.nilai-table col:nth-child(1) { width: 5%; }
.nilai-table col:nth-child(2) { width: 31%; }
.nilai-table col:nth-child(3) { width: 31%; }
.nilai-table col:nth-child(4) { width: 18%; }
.nilai-table col:nth-child(5) { width: 8%; }
.nilai-table col:nth-child(6) { width: 7%; }
.nilai-table th, .nilai-table td { border: 1px solid #000; }
.nilai-table th { font-weight: bold; text-align: center; vertical-align: middle; padding: 1px 3px; height: 22px; font-size: 12pt; }
.nilai-table tbody td { height: 22px; padding: 1px 3px; vertical-align: middle; }

.nomor { text-align: center; }
.mapel { text-align: left; padding-left: 6px !important; white-space: nowrap; }
.nilai { text-align: center; }

.kelompok-row td.kelompok { font-weight: bold; text-align: left; padding: 4px 6px !important; height: 22px !important; }

.rata-rata-label { font-weight: bold; text-align: left; padding-left: 6px !important; height: 22px; }
.rata-rata-value { font-weight: bold; text-align: center; }

.footer-area { width: 100%; margin-top: 12px; }
.tanggal { width: 50%; margin-left: 50%; height: 18px; text-align: left; font-size: 12pt; white-space: nowrap; }
.ttd { width: 50%; margin-left: 50%; margin-top: 5px; text-align: left; font-size: 12pt; }
.ttd-jabatan { line-height: 1.2; }
.ttd-spacer { height: 90px; }
.ttd-image { width: 200px; height: auto; display: block; margin-left: -10px; margin-top: -18px; }
.ttd-nama { font-weight: bold; text-decoration: underline; white-space: nowrap; }
.ttd-nip { margin-top: 2px; }

@media print {
  .print-wrapper { background: #fff; padding: 0; }
  .no-print { display: none !important; }
  .ijazah-page { box-shadow: none; margin: 0; page-break-after: always; }
  .ijazah-page:last-child { page-break-after: auto; }
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