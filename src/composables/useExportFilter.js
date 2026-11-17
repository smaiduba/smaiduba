import { ref, computed } from 'vue'

/**
 * Composable filter export bersama untuk Nilai & Siswa.
 * 
 * @param {Object}   opts
 * @param {Ref<Array>} opts.daftarItems      - array of { no_induk, nama, kelas, angkatan, status, raw }
 * @param {Ref<Array>} opts.kelasOptions     - array string
 * @param {Ref<Array>} opts.angkatanOptions  - array string
 * @param {Ref<Array>|null} opts.statusOptions - null jika view tidak punya status filter
 */
export function useExportFilter({ daftarItems, kelasOptions, angkatanOptions, statusOptions = null }) {
  const filterKelas = ref([])
  const filterAngkatan = ref([])
  const filterStatus = ref([])
  const searchSiswa = ref('')
  const selectedNoInduk = ref([])
  const searchKelas = ref('')
  const searchAngkatan = ref('')

  const kelasFiltered = computed(() => {
    const q = searchKelas.value.toLowerCase()
    return !q ? kelasOptions.value : kelasOptions.value.filter(k => k.toLowerCase().includes(q))
  })
  const angkatanFiltered = computed(() => {
    const q = searchAngkatan.value.toLowerCase()
    return !q ? angkatanOptions.value : angkatanOptions.value.filter(a => a.includes(q))
  })

  const siswaFiltered = computed(() => {
    const kw = searchSiswa.value.toLowerCase().trim()
    return daftarItems.value.filter(it => {
      if (filterKelas.value.length) {
        const k = it.kelas || ''
        if (!k || !filterKelas.value.some(fk => k === fk || k.startsWith(fk + '-') || k.startsWith(fk + ' '))) return false
      }
      if (filterAngkatan.value.length) {
        if (!it.angkatan || !filterAngkatan.value.includes(it.angkatan)) return false
      }
      if (statusOptions && statusOptions.value && statusOptions.value.length && filterStatus.value.length) {
        if (!filterStatus.value.includes(it.status || 'Aktif')) return false
      }
      if (kw) {
        if (!(it.nama || '').toLowerCase().includes(kw) &&
            !(it.no_induk || '').toLowerCase().includes(kw)) return false
      }
      return true
    })
  })

  const finalItems = computed(() => {
    if (selectedNoInduk.value.length > 0) {
      const set = new Set(selectedNoInduk.value)
      return daftarItems.value.filter(it => set.has(it.no_induk))
    }
    return siswaFiltered.value
  })

  function _toggle(arrRef, val) {
    const i = arrRef.value.indexOf(val)
    if (i >= 0) arrRef.value.splice(i, 1); else arrRef.value.push(val)
    selectedNoInduk.value = []
  }

  const toggleKelas    = (k) => _toggle(filterKelas, k)
  const toggleAngkatan = (a) => _toggle(filterAngkatan, a)
  const toggleStatus   = (s) => _toggle(filterStatus, s)

  function toggleSiswa(ni) {
    const i = selectedNoInduk.value.indexOf(ni)
    if (i >= 0) selectedNoInduk.value.splice(i, 1); else selectedNoInduk.value.push(ni)
  }
  function pilihSemua(v) {
    if (v) selectedNoInduk.value = siswaFiltered.value.map(it => it.no_induk)
    else selectedNoInduk.value = []
  }
  function resetAll() {
    filterKelas.value = []
    filterAngkatan.value = []
    filterStatus.value = []
    searchSiswa.value = ''
    selectedNoInduk.value = []
    searchKelas.value = ''
    searchAngkatan.value = ''
  }

  return {
    filterKelas, filterAngkatan, filterStatus,
    searchSiswa, selectedNoInduk,
    searchKelas, searchAngkatan,
    kelasFiltered, angkatanFiltered, siswaFiltered, finalItems,
    toggleKelas, toggleAngkatan, toggleStatus, toggleSiswa, pilihSemua, resetAll
  }
}