import { ref, watch } from 'vue'

const STORAGE_KEY = 'simak_theme'
const DEFAULT = 'dark'

const getInitialTheme = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
    return DEFAULT
  } catch (e) {
    return DEFAULT
  }
}

export const theme = ref(getInitialTheme())

export const applyTheme = (t) => {
  const html = document.documentElement
  if (t === 'dark') {
    html.classList.add('dark')
    html.classList.remove('light')
  } else {
    html.classList.add('light')
    html.classList.remove('dark')
  }
  try { localStorage.setItem(STORAGE_KEY, t) } catch (e) {}
}

export const toggleTheme = () => {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
}

// Apply immediately saat modul dimuat (sebelum Vue mount)
applyTheme(theme.value)

// Watch perubahan
watch(theme, (newVal) => applyTheme(newVal))