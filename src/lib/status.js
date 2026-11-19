// Hanya status "aktif" yang dianggap aktif (dipakai di statistik & daftar)
export function isSiswaAktif(siswa) {
  if (!siswa) return false
  return String(siswa.status || '').toLowerCase().trim() === 'aktif'
}

// Khusus kertas absen: lebih longgar.
// Siswa dengan kelas mengandung "berhenti" (mis. "Berhenti XI A")
// tetap masuk kertas absen, meskipun statusnya "Berhenti".
export function isSiswaTampilDiAbsen(siswa) {
  if (!siswa) return false
  const status = String(siswa.status || '').toLowerCase().trim()
  const kelas  = String(siswa.kelas  || '').toLowerCase().trim()

  // Kelas berhenti → tetap tampil di kertas absen
  if (kelas.includes('berhenti')) return true

  // Selain itu ikuti definisi aktif
  return status === 'aktif'
}
