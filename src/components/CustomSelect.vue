<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { ChevronDown, Search, Check } from 'lucide-vue-next'

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  options: { type: Array, default: () => [] },
  placeholder: { type: String, default: 'Pilih...' },
  searchable: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  size: { type: String, default: 'md' }
})

const emit = defineEmits(['update:modelValue', 'change'])

const open = ref(false)
const searchQuery = ref('')
const wrapperRef = ref(null)
const buttonRef = ref(null)
const panelRef = ref(null)
const searchInputRef = ref(null)
const listRef = ref(null)
const highlightedIndex = ref(-1)
const panelStyle = ref({ top: '0px', bottom: 'auto', left: '0px', width: '0px', maxHeight: '320px' })

const isGrouped = computed(() => props.options.length > 0 && props.options[0].options !== undefined)
const flatOptions = computed(() =>
  isGrouped.value ? props.options.flatMap(g => g.options) : props.options
)
const selectedLabel = computed(() => {
  const found = flatOptions.value.find(o => o.value === props.modelValue)
  return found ? found.label : props.placeholder
})
const hasValue = computed(() =>
  props.modelValue !== '' && props.modelValue !== null && props.modelValue !== undefined
)
const filteredGroups = computed(() => {
  const q = searchQuery.value.toLowerCase().trim()
  if (!q) return props.options
  if (isGrouped.value) {
    return props.options
      .map(g => ({ ...g, options: g.options.filter(o => (o.label || '').toLowerCase().includes(q)) }))
      .filter(g => g.options.length > 0)
  }
  return props.options.filter(o => (o.label || '').toLowerCase().includes(q))
})
const flatFiltered = computed(() =>
  isGrouped.value ? filteredGroups.value.flatMap(g => g.options) : filteredGroups.value
)
const isEmpty = computed(() => flatFiltered.value.length === 0)

function computePosition() {
  if (!buttonRef.value) return
  const rect = buttonRef.value.getBoundingClientRect()
  const viewportH = window.visualViewport?.height || window.innerHeight
  const viewportW = window.visualViewport?.width || window.innerWidth
  const desired = 320
  const minBelow = 150

  const spaceBelow = viewportH - rect.bottom - 8
  const spaceAbove = rect.top - 8

  const openUp = spaceBelow < minBelow && spaceAbove > spaceBelow * 1.5

  // Clamp horizontal (sama untuk kedua arah)
  const left = Math.max(8, Math.min(rect.left, viewportW - rect.width - 8))

  if (openUp) {
    // ── FLIP UP: anchor dari BAWAH agar panel selalu menempel ke atas tombol,
    //    tanpa peduli tinggi isi panel.
    const maxHeight = Math.min(desired, spaceAbove)
    panelStyle.value = {
      position: 'fixed',
      left: left + 'px',
      top: 'auto',
      bottom: (viewportH - rect.top + 4) + 'px',   // ← 4px gap konsisten
      width: rect.width + 'px',
      maxHeight: maxHeight + 'px',
      zIndex: 9999
    }
  } else {
    // ── FLIP DOWN: anchor dari ATAS (sudah benar)
    let top = rect.bottom + 4
    let maxHeight = Math.min(desired, Math.max(spaceBelow, 120))
    if (top + maxHeight > viewportH - 8) {
      maxHeight = Math.max(viewportH - 8 - top, 120)
    }
    top = Math.max(8, top)
    panelStyle.value = {
      position: 'fixed',
      left: left + 'px',
      top: top + 'px',
      bottom: 'auto',
      width: rect.width + 'px',
      maxHeight: maxHeight + 'px',
      zIndex: 9999
    }
  }
}

function toggleOpen() {
  if (props.disabled) return
  open.value = !open.value
}

function closePanel() {
  open.value = false
  searchQuery.value = ''
  highlightedIndex.value = -1
}

function selectOption(opt) {
  emit('update:modelValue', opt.value)
  emit('change', opt.value)
  closePanel()
}

function onDocClick(e) {
  if (!open.value) return
  const inWrapper = wrapperRef.value && wrapperRef.value.contains(e.target)
  const inPanel = panelRef.value && panelRef.value.contains(e.target)
  if (!inWrapper && !inPanel) closePanel()
}

function onScrollResize() {
  if (open.value) computePosition()
}

function onKeydown(e) {
  if (!open.value) {
    if (['Enter', ' ', 'ArrowDown'].includes(e.key)) {
      e.preventDefault()
      open.value = true
    }
    return
  }
  if (e.key === 'Escape') {
    e.preventDefault()
    closePanel()
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    highlightedIndex.value = Math.min(highlightedIndex.value + 1, flatFiltered.value.length - 1)
    scrollToHighlighted()
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    highlightedIndex.value = Math.max(highlightedIndex.value - 1, 0)
    scrollToHighlighted()
  } else if (e.key === 'Enter' && highlightedIndex.value >= 0) {
    e.preventDefault()
    const opt = flatFiltered.value[highlightedIndex.value]
    if (opt) selectOption(opt)
  }
}

function scrollToHighlighted() {
  nextTick(() => {
    const el = listRef.value?.querySelector(`[data-idx="${highlightedIndex.value}"]`)
    if (el) el.scrollIntoView({ block: 'nearest' })
  })
}

watch(open, (v) => {
  if (v) {
    nextTick(() => {
      computePosition()
      highlightedIndex.value = flatFiltered.value.findIndex(o => o.value === props.modelValue)
      if (props.searchable) searchInputRef.value?.focus()
    })
  }
})

onMounted(() => {
  document.addEventListener('click', onDocClick)
  window.addEventListener('resize', onScrollResize)
  window.addEventListener('scroll', onScrollResize, true)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  window.removeEventListener('resize', onScrollResize)
  window.removeEventListener('scroll', onScrollResize, true)
})
</script>

<template>
  <div ref="wrapperRef" class="relative" :class="{ 'opacity-50 pointer-events-none': disabled }">
    <button
      ref="buttonRef"
      type="button"
      @click="toggleOpen"
      @keydown="onKeydown"
      :class="[
        'w-full flex items-center justify-between gap-2 rounded-lg border bg-slate-950 text-left transition outline-none',
        'hover:border-slate-700 focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/10',
        size === 'sm' ? 'h-8 px-2.5 text-xs' : 'h-10 px-3 text-[13px]',
        open ? 'border-emerald-500/60 ring-2 ring-emerald-500/10' : 'border-slate-800'
      ]"
      :aria-expanded="open"
    >
      <span :class="['truncate', hasValue ? 'text-white' : 'text-slate-500']">{{ selectedLabel }}</span>
      <ChevronDown :class="['w-4 h-4 text-slate-500 shrink-0 transition-transform', open ? 'rotate-180' : '']" />
    </button>

    <Teleport to="body">
      <Transition name="select-fade">
        <div v-if="open"
             ref="panelRef"
             :style="panelStyle"
             class="rounded-lg border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden flex flex-col">
          <div v-if="searchable" class="p-2 border-b border-slate-800 shrink-0">
            <div class="relative">
              <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                ref="searchInputRef"
                v-model="searchQuery"
                type="text"
                placeholder="Cari..."
                class="w-full h-8 pl-8 pr-2 bg-slate-950 border border-slate-800 rounded-md text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500/60"
                @click.stop
              />
            </div>
          </div>

          <div ref="listRef" class="overflow-y-auto py-1 flex-1">
            <template v-if="isGrouped">
              <div v-for="(group, gi) in filteredGroups" :key="gi">
                <div class="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-950/50 sticky top-0 z-10">
                  {{ group.label }}
                </div>
                <button
                  v-for="opt in group.options"
                  :key="String(opt.value)"
                  :data-idx="flatFiltered.indexOf(opt)"
                  type="button"
                  @click="selectOption(opt)"
                  :class="[
                    'w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-[13px] transition',
                    opt.value === modelValue ? 'bg-emerald-500/15 text-emerald-300' : 'text-slate-200 hover:bg-slate-800/60',
                    flatFiltered.indexOf(opt) === highlightedIndex ? 'bg-slate-800/80' : ''
                  ]"
                >
                  <span class="truncate">{{ opt.label }}</span>
                  <Check v-if="opt.value === modelValue" class="w-4 h-4 shrink-0" />
                </button>
              </div>
            </template>
            <template v-else>
              <button
                v-for="opt in filteredGroups"
                :key="String(opt.value)"
                :data-idx="flatFiltered.indexOf(opt)"
                type="button"
                @click="selectOption(opt)"
                :class="[
                  'w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-[13px] transition',
                  opt.value === modelValue ? 'bg-emerald-500/15 text-emerald-300' : 'text-slate-200 hover:bg-slate-800/60',
                  flatFiltered.indexOf(opt) === highlightedIndex ? 'bg-slate-800/80' : ''
                ]"
              >
                <span class="truncate">{{ opt.label }}</span>
                <Check v-if="opt.value === modelValue" class="w-4 h-4 shrink-0" />
              </button>
            </template>

            <div v-if="isEmpty" class="px-3 py-6 text-center text-xs text-slate-500">
              {{ searchQuery ? 'Tidak ada hasil' : 'Tidak ada pilihan' }}
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.select-fade-enter-active, .select-fade-leave-active {
  transition: opacity 120ms ease, transform 120ms ease;
}
.select-fade-enter-from, .select-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
