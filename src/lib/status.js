export function isSiswaAktif(siswa) {
  if (!siswa) return false
  const status = String(siswa.status || '').toLowerCase().trim()
  const kelas = String(siswa.kelas || '').toLowerCase().trim()
  
  if (['lulus', 'keluar', 'mutasi', 'berhenti'].includes(status)) return false
  if (status === 'aktif') return true
  if (kelas.includes('lulus') || kelas.includes('berhenti') || kelas.includes('mutasi')) return false
  return true
}

export function isSiswaTampilDiAbsen(siswa) {
  if (!siswa) return false
  const status = String(siswa.status || '').toLowerCase().trim()
  const kelas = String(siswa.kelas || '').toLowerCase().trim()
  
  // Hanya singkirkan yang Lulus, Keluar, atau Mutasi
  // Kata "Berhenti" TIDAK disingkirkan agar tetap tampil di kertas absen
  if (['lulus', 'keluar', 'mutasi'].includes(status)) return false
  if (kelas.includes('lulus') || kelas.includes('keluar') || kelas.includes('mutasi')) return false
  
  return true
}