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

onMounted(async () => {
  const noInduk = route.params.noInduk
  const rSiswa = await supabase.from('siswa').select('*').eq('no_induk', noInduk).single()
  if (!rSiswa.data) { loading.value = false; return }

  const s = rSiswa.data
  const d = s.detail_data || {}
  data.value = {
    noInduk: s.no_induk,
    nama: s.nama,
    nisn: s.nisn,
    kelas: s.kelas,
    status: s.status,
    kelamin: s.kelamin || d.kelamin,
    tetala: d.tetala,
    agama: d.agama || 'Islam',
    anak_ke: d.anak_ke,
    alamat: s.alamat,
    alamat_singkat: d.alamat_singkat,
    ayah: s.nama_ayah || d.ayah,
    tetala_ayah: d.tetala_ayah,
    sekolah_ayah: d.sekolah_ayah,
    pekerjaan_ayah: d.pekerjaanayah,
    ibu: s.nama_ibu || d.ibu,
    tetala_ibu: d.tetala_ibu,
    sekolah_ibu: d.sekolah_ibu,
    no_telp: s.no_telp || d.no_telp,
    sd: d.sd, mts: d.mts, alamat_mts: d.alamat_mts, npsn: d.npsn,
    masuk: d.masuk, keluar: d.keluar,
    no_ijazah: d.no_ijazah,
    tgl_kelulusan: d.tgl_kelulusan,
    foto: d.foto
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

    <div v-if="loading" class="paper">
      <div style="text-align:center;padding:40px;color:#666;">Memuat...</div>
    </div>

    <div v-else-if="data" class="paper">
      <header class="kop">
        <img src="https://res.cloudinary.com/dqzhp3lnq/image/upload/v1781580065/Copy_of_SMA_Itsbatiyah_fnnhdy.png" alt="Logo" class="logo" />
        <div class="kop-text">
          <div class="l1">YAYASAN AL-ITSBATIYAH DARUL ULUM BANYUANYAR</div>
          <div class="l2">SEKOLAH MENENGAH ATAS (SMA)</div>
          <div class="l3">SMA AL-ITSBATIYAH DARUL ULUM BANYUANYAR</div>
          <div class="l4">NPSN: 20529881 • Terakreditasi A</div>
        </div>
      </header>
      <hr class="line-double" />

      <h1 class="judul">BUKU INDUK SISWA</h1>
      <div class="subjudul">(BIODATA LENGKAP)</div>

      <div class="bio-grid">
        <div class="bio-foto">
          <img v-if="data.foto" :src="data.foto" alt="Foto" />
          <div v-else class="bio-foto-placeholder">Foto<br>3×4</div>
        </div>
        <div class="bio-data">
          <table class="identity" style="margin:0">
            <tr><td>No Induk</td><td>:</td><td><b>{{ data.noInduk }}</b></td></tr>
            <tr><td>Nama Lengkap</td><td>:</td><td><b>{{ data.nama }}</b></td></tr>
            <tr><td>NISN</td><td>:</td><td>{{ data.nisn || '-' }}</td></tr>
            <tr><td>Jenis Kelamin</td><td>:</td><td>{{ data.kelamin || '-' }}</td></tr>
            <tr><td>Tempat, Tgl Lahir</td><td>:</td><td>{{ data.tetala || '-' }}</td></tr>
            <tr><td>Agama</td><td>:</td><td>{{ data.agama || '-' }}</td></tr>
            <tr><td>Anak Ke-</td><td>:</td><td>{{ data.anak_ke || '-' }}</td></tr>
            <tr><td>Kelas</td><td>:</td><td>{{ data.kelas || '-' }}</td></tr>
            <tr><td>Status</td><td>:</td><td>{{ data.status || '-' }}</td></tr>
            <tr><td>No. HP/WA</td><td>:</td><td>{{ data.no_telp || '-' }}</td></tr>
            <tr><td>Alamat</td><td>:</td><td>{{ data.alamat || '-' }}</td></tr>
          </table>
        </div>
      </div>

      <h2 class="section-title">Data Orang Tua</h2>
      <table class="identity">
        <tr><td style="width:140px">Nama Ayah</td><td>:</td><td>{{ data.ayah || '-' }}</td></tr>
        <tr><td>TTL Ayah</td><td>:</td><td>{{ data.tetala_ayah || '-' }}</td></tr>
        <tr><td>Pendidikan Ayah</td><td>:</td><td>{{ data.sekolah_ayah || '-' }}</td></tr>
        <tr><td>Pekerjaan Ayah</td><td>:</td><td>{{ data.pekerjaan_ayah || '-' }}</td></tr>
        <tr><td>Nama Ibu</td><td>:</td><td>{{ data.ibu || '-' }}</td></tr>
        <tr><td>TTL Ibu</td><td>:</td><td>{{ data.tetala_ibu || '-' }}</td></tr>
        <tr><td>Pendidikan Ibu</td><td>:</td><td>{{ data.sekolah_ibu || '-' }}</td></tr>
      </table>

      <h2 class="section-title">Riwayat Pendidikan</h2>
      <table class="identity">
        <tr><td style="width:140px">SD / MI Asal</td><td>:</td><td>{{ data.sd || '-' }}</td></tr>
        <tr><td>SMP / MTs Asal</td><td>:</td><td>{{ data.mts || '-' }}</td></tr>
        <tr><td>Alamat SMP/MTs</td><td>:</td><td>{{ data.alamat_mts || '-' }}</td></tr>
        <tr><td>NPSN Sekolah Asal</td><td>:</td><td>{{ data.npsn || '-' }}</td></tr>
      </table>

      <h2 class="section-title">Kelulusan</h2>
      <table class="identity">
        <tr><td style="width:140px">Tahun Masuk</td><td>:</td><td>{{ data.masuk || '-' }}</td></tr>
        <tr><td>Tahun Keluar</td><td>:</td><td>{{ data.keluar || '-' }}</td></tr>
        <tr><td>No. Ijazah</td><td>:</td><td>{{ data.no_ijazah || '-' }}</td></tr>
        <tr><td>Tanggal Kelulusan</td><td>:</td><td>{{ data.tgl_kelulusan || '-' }}</td></tr>
      </table>

      <div class="ttd-wrapper" style="margin-top:40px">
        <div class="ttd-col">
          <div>Kepala Sekolah</div>
          <div class="ttd-space"></div>
          <div class="ttd-nama">ACH. MA'RUF TAMAM, S.Pd.</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import './print.css';

.bio-grid {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
}
.bio-foto {
  width: 90px;
  flex-shrink: 0;
}
.bio-foto img {
  width: 90px;
  height: 120px;
  object-fit: cover;
  border: 1px solid #999;
}
.bio-foto-placeholder {
  width: 90px;
  height: 120px;
  border: 1px dashed #999;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: #999;
  font-size: 11px;
}
.bio-data { flex: 1; min-width: 0; }

.section-title {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 20px 0 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid #999;
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