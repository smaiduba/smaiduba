import { reactive } from 'vue'

export const confirmState = reactive({
  show: false,
  title: 'Konfirmasi',
  message: '',
  confirmText: 'Ya',
  cancelText: 'Batal',
  variant: 'danger',   // 'danger' | 'warning' | 'info'
  resolve: null
})

/**
 * Konfirmasi dialog (Promise<boolean>).
 * @param {Object} [options]
 * @param {string} [options.title]
 * @param {string} [options.message]
 * @param {string} [options.confirmText]
 * @param {string} [options.cancelText]
 * @param {'danger'|'warning'|'info'} [options.variant]
 * @returns {Promise<boolean>}
 */
export function confirm(options = {}) {
  return new Promise(resolve => {
    confirmState.title = options.title || 'Konfirmasi'
    confirmState.message = options.message || ''
    confirmState.confirmText = options.confirmText || 'Ya'
    confirmState.cancelText = options.cancelText || 'Batal'
    confirmState.variant = options.variant || 'danger'
    confirmState.resolve = resolve
    confirmState.show = true
  })
}

export function resolveConfirm(ok) {
  if (confirmState.resolve) confirmState.resolve(ok)
  confirmState.show = false
  confirmState.resolve = null
}