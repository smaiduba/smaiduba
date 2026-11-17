<script setup>
import { computed, watch, onBeforeUnmount } from 'vue'
import { confirmState, resolveConfirm } from '../lib/confirm'
import { AlertTriangle, Trash2, Info, X } from 'lucide-vue-next'

const VARIANTS = {
  danger: {
    icon: Trash2,
    iconBg: 'bg-red-500/15 text-red-400 border-red-500/30',
    btnConfirm: 'bg-gradient-to-br from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 shadow-lg shadow-red-900/40'
  },
  warning: {
    icon: AlertTriangle,
    iconBg: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    btnConfirm: 'bg-gradient-to-br from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 shadow-lg shadow-amber-900/40'
  },
  info: {
    icon: Info,
    iconBg: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    btnConfirm: 'bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 shadow-lg shadow-blue-900/40'
  }
}

const cfg = computed(() => VARIANTS[confirmState.variant] || VARIANTS.danger)
const IconComp = computed(() => cfg.value.icon)

function onCancel() { resolveConfirm(false) }
function onConfirm() { resolveConfirm(true) }

function onKeydown(e) {
  if (!confirmState.show) return
  if (e.key === 'Escape') { e.preventDefault(); onCancel() }
  else if (e.key === 'Enter' && document.activeElement?.tagName !== 'BUTTON') { e.preventDefault(); onConfirm() }
}

watch(() => confirmState.show, (v) => {
  if (v) {
    document.addEventListener('keydown', onKeydown)
    document.body.style.overflow = 'hidden'
  } else {
    document.removeEventListener('keydown', onKeydown)
    document.body.style.overflow = ''
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="confirm-fade">
      <div v-if="confirmState.show"
           class="fixed inset-0 z-[9999] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4"
           @click.self="onCancel">
        <div class="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
          <div class="p-5 flex items-start gap-4">
            <div class="w-12 h-12 rounded-xl border flex items-center justify-center shrink-0" :class="cfg.iconBg">
              <component :is="IconComp" class="w-6 h-6" />
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="text-base font-bold text-white mb-1">{{ confirmState.title }}</h3>
              <p class="text-sm text-slate-400 leading-relaxed whitespace-pre-line">{{ confirmState.message }}</p>
            </div>
            <button @click="onCancel"
                    class="w-7 h-7 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-white flex items-center justify-center transition shrink-0">
              <X class="w-4 h-4" />
            </button>
          </div>
          <div class="px-5 py-3 border-t border-slate-800 bg-slate-950/50 flex justify-end gap-2">
            <button @click="onCancel"
                    class="h-10 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[13px] font-semibold transition">
              {{ confirmState.cancelText }}
            </button>
            <button @click="onConfirm"
                    class="h-10 px-5 rounded-xl text-white text-[13px] font-bold transition"
                    :class="cfg.btnConfirm">
              {{ confirmState.confirmText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.confirm-fade-enter-active, .confirm-fade-leave-active { transition: opacity 150ms ease; }
.confirm-fade-enter-from, .confirm-fade-leave-to { opacity: 0; }
</style>