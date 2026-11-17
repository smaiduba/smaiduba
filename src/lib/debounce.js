import { ref, watch } from 'vue'

/**
 * Debounce sebuah ref — return ref baru yang hanya berubah
 * setelah sumbernya berhenti berubah selama `delay` ms.
 */
export function useDebounced(source, delay = 200) {
  const out = ref(source.value)
  let timer = null
  watch(source, (v) => {
    clearTimeout(timer)
    timer = setTimeout(() => { out.value = v }, delay)
  })
  return out
}