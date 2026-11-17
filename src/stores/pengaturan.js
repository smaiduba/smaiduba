import { reactive, watch } from 'vue'

const STORAGE_KEY = 'app_pengaturan_v1'

const DEFAULT = {
  sekolah: {
    namaYayasan: 'YAYASAN AL-ITSBATIYAH DARUL ULUM BANYUANYAR',
    nama: 'SMA AL-ITSBATIYAH',
    alamat: 'POTAN DAYA PALENGAAN PAMEKASAN MADURA',
    npsn: '20529881',
    akreditasi: 'A',
    kepalaSekolah: "ACH. MA'RUF TAMAM, S.Pd.",
    nipKepalaSekolah: '',
    logo: 'https://res.cloudinary.com/dqzhp3lnq/image/upload/v1781580065/Copy_of_SMA_Itsbatiyah_fnnhdy.png',
    kopSurat: 'https://res.cloudinary.com/dqzhp3lnq/image/upload/v1789040483/KOP_c2ca2x.png',
    ttdKepalaSekolah: 'https://res.cloudinary.com/dqzhp3lnq/image/upload/v1789437364/TTD_KPL_mjucef.png'
  },
  akademik: {
    tahunAktif: '2025/2026',
    semesterAktif: 'Ganjil',
    kkmDefault: 75,
    pembulatanNilai: 2
  },
  cetak: {
    ukuranKertas: 'F4',
    judulRaport: 'LAPORAN HASIL BELAJAR SISWA',
    judulIjazah: 'TRANSKIP NILAI',
    judulBukuInduk: 'BUKU INDUK SISWA'
  }
}

function clone(o) { return JSON.parse(JSON.stringify(o)) }

function deepMerge(target, src) {
  for (const k in src) {
    if (src[k] && typeof src[k] === 'object' && !Array.isArray(src[k])) {
      if (!target[k] || typeof target[k] !== 'object') target[k] = {}
      deepMerge(target[k], src[k])
    } else if (src[k] !== undefined) {
      target[k] = src[k]
    }
  }
  return target
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    const base = clone(DEFAULT)
    return saved ? deepMerge(base, saved) : base
  } catch {
    return clone(DEFAULT)
  }
}

export const pengaturan = reactive(load())

watch(pengaturan, (v) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(v)) } catch {}
}, { deep: true })

export function resetPengaturan() {
  const base = clone(DEFAULT)
  Object.assign(pengaturan, base)
}