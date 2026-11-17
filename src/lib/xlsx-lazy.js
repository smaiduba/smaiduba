// ============================================================
// Lazy loader XLSX + helper write
// XLSX hanya di-load saat user klik Import/Export
// Menghemat ~200-400 KB dari initial bundle
// ============================================================

let _cache = null

export function ensureXLSX() {
  if (!_cache) {
    _cache = import('xlsx').then(m => m.default || m)
  }
  return _cache
}

/**
 * Tulis XLSX ke file.
 * @param {Array<Array>} aoa           - 2D array (data)
 * @param {Array}        [merges]      - array of {s:{r,c}, e:{r,c}}
 * @param {Array}        [cols]        - array of {wch: number}
 * @param {Object}       [autofilterRange] - {s:{r,c}, e:{r,c}}
 * @param {string}       [sheetName]
 * @param {string}       filename
 */
export async function writeXlsx({ aoa, merges, cols, autofilterRange, sheetName = 'Data', filename }) {
  const XLSX = await ensureXLSX()
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  if (merges) ws['!merges'] = merges
  if (cols) ws['!cols'] = cols
  if (autofilterRange) ws['!autofilter'] = { ref: XLSX.utils.encode_range(autofilterRange) }
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, filename)
}