<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { userSesi, logout } from './stores/auth'
import { theme, toggleTheme } from './stores/theme'
import {
  LayoutDashboard, Users, Award, BookMarked, UserCheck, CalendarDays,
  ArrowUpCircle, ClipboardCheck, MessageSquare, BookOpen, Printer, Settings,
  LogOut, Menu, X, ChevronDown, Search, Bell, Sun, Moon, Info, User as UserIcon,
  Briefcase
} from 'lucide-vue-next'
import ConfirmDialog from './components/ConfirmDialog.vue'
import { confirm } from './lib/confirm'

const route = useRoute()
const router = useRouter()

const isSidebarOpen = ref(false)
const isSidebarCollapsed = ref(false)
const isUserMenuOpen = ref(false)
const showAbout = ref(false)
const isMenuOpen = ref(false) // ← overlay menu mobile baru

const toggleSidebar = () => { isSidebarOpen.value = !isSidebarOpen.value }
const toggleCollapse = () => { isSidebarCollapsed.value = !isSidebarCollapsed.value }
const isHalamanLogin = computed(() => route.name === 'login')
const isPrintMode = computed(() => route.meta?.print === true)

// ─── MENU BAWAH (MOBILE APP) ───
const bottomNavItems = [
  { path: '/', name: 'Home', icon: LayoutDashboard },
  { path: '/siswa', name: 'Siswa', icon: Users },
  { path: '/nilai', name: 'Nilai', icon: Award },
  { path: '/absen-kelas', name: 'Absen', icon: ClipboardCheck }
]

const handleLogout = async () => {
  const ok = await confirm({
    title: 'Keluar Aplikasi',
    message: 'Yakin ingin keluar dari akun ini?',
    variant: 'warning',
    confirmText: 'Ya, Keluar'
  })
  if (ok) {
    await logout()
    router.push('/login')
  }
}

const initial = computed(() => (userSesi.value?.email || 'A').charAt(0).toUpperCase())

const menuGroups = [
  {
    title: 'Menu Utama',
    items: [
      { path: '/', name: 'Dashboard', icon: LayoutDashboard },
      { path: '/workspace', name: 'Ruang Kerja', icon: Briefcase },
      { path: '/siswa', name: 'Data Induk Siswa', icon: Users },
      { path: '/nilai', name: 'Nilai Akademik', icon: Award },
      { path: '/muadalah', name: 'Nilai Muadalah', icon: BookMarked },
      { path: '/guru', name: 'Dewan Guru', icon: UserCheck },
    ]
  },
  {
    title: 'Akademik',
    items: [
      { path: '/kaldik', name: 'Kalender Akademik', icon: CalendarDays },
      { path: '/kenaikan', name: 'Kenaikan & Kelulusan', icon: ArrowUpCircle },
    ]
  },
  {
    title: 'Absen & Validasi',
    items: [
      { path: '/absen-kelas', name: 'Absensi Kelas', icon: ClipboardCheck },
      { path: '/absen-nabil', name: 'Absensi Nabil', icon: MessageSquare },
      { path: '/absen-sorogan', name: 'Absensi Sorogan', icon: BookOpen },
    ]
  },
  {
    title: 'Pencetakan',
    items: [
      { path: '/pusat-cetak', name: 'Pusat Cetak', icon: Printer },
      { path: '/jadwal', name: 'Jadwal Pelajaran', icon: CalendarDays },
    ]
  },
  {
    title: 'Konfigurasi',
    items: [
      { path: '/settings', name: 'Pengaturan', icon: Settings },
    ]
  }
]

const breadcrumb = computed(() => {
  const allItems = menuGroups.flatMap(g => g.items)
  const current = allItems.find(i => i.path === route.path)
  return current ? current.name : 'Dashboard'
})
</script>

<template>
  <RouterView v-if="isHalamanLogin || isPrintMode" />

  <div v-else class="h-[100dvh] bg-slate-950 flex">

    <!-- OVERLAY MOBILE (SIDEBAR) - tetap ada, tidak dipicu lagi dari bottom nav -->
    <Transition name="fade">
      <div v-if="isSidebarOpen" @click="isSidebarOpen = false"
           class="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 md:hidden"></div>
    </Transition>

    <!-- SIDEBAR -->
    <aside
      class="bg-slate-950/95 border-r border-slate-800/80 flex flex-col fixed md:sticky top-0 h-[100dvh] left-0 z-50 transform transition-all duration-300 ease-out shrink-0"
      :class="[isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0', isSidebarCollapsed ? 'md:w-[72px]' : 'w-[260px]']">

      <div class="h-16 px-5 flex items-center justify-between border-b border-slate-800/80 shrink-0">
        <RouterLink to="/" class="flex items-center gap-3 overflow-hidden min-w-0" v-if="!isSidebarCollapsed">
          <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-900/50 shrink-0 overflow-hidden">
            <img src="https://res.cloudinary.com/dqzhp3lnq/image/upload/v1781580065/Copy_of_SMA_Itsbatiyah_fnnhdy.png"
                 class="w-full h-full object-contain p-1">
          </div>
          <div class="min-w-0">
            <div class="text-sm font-bold text-white leading-tight truncate">SIMAK DUBA</div>
            <div class="text-[10px] text-slate-500 leading-tight">v2.0 Premium</div>
          </div>
        </RouterLink>
        <div v-else class="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mx-auto overflow-hidden">
          <img src="https://res.cloudinary.com/dqzhp3lnq/image/upload/v1781580065/Copy_of_SMA_Itsbatiyah_fnnhdy.png"
               class="w-full h-full object-contain p-1">
        </div>
        <button @click="isSidebarOpen = false" class="md:hidden text-slate-400 hover:text-white p-1.5 -mr-1.5">
          <X class="w-5 h-5" />
        </button>
      </div>

      <nav class="flex-1 overflow-y-auto overflow-x-hidden py-4 px-3 space-y-5">
        <div v-for="group in menuGroups" :key="group.title">
          <div v-if="!isSidebarCollapsed"
               class="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
            {{ group.title }}
          </div>
          <div class="space-y-0.5">
            <RouterLink
              v-for="m in group.items"
              :key="m.path"
              :to="m.path"
              @click="isSidebarOpen = false"
              :title="isSidebarCollapsed ? m.name : ''"
              class="group relative flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-200"
              :class="route.path === m.path
                ? 'bg-emerald-500/10 text-emerald-300'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'">

              <span
                class="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-emerald-500 transition-opacity duration-200"
                :class="route.path === m.path ? 'opacity-100' : 'opacity-0'"
              ></span>

              <component :is="m.icon" class="w-[18px] h-[18px] shrink-0" :class="route.path === m.path ? 'text-emerald-400' : ''" />
              <span v-if="!isSidebarCollapsed" class="truncate">{{ m.name }}</span>
            </RouterLink>
          </div>
        </div>
      </nav>

      <div class="p-3 border-t border-slate-800/80 shrink-0">
        <button @click="handleLogout"
                class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                :title="isSidebarCollapsed ? 'Keluar' : ''">
          <LogOut class="w-[18px] h-[18px] shrink-0" />
          <span v-if="!isSidebarCollapsed">Keluar</span>
        </button>
      </div>

      <button @click="toggleCollapse"
              class="hidden md:flex absolute top-20 -right-3 w-6 h-6 rounded-full bg-slate-800 border border-slate-700 items-center justify-center text-slate-400 hover:text-white hover:border-emerald-500 transition z-50">
        <Menu class="w-3 h-3" />
      </button>
    </aside>

    <!-- MAIN CONTENT -->
    <div class="flex-1 flex flex-col h-[100dvh] overflow-hidden min-w-0">

      <!-- HEADER -->
      <header class="h-14 md:h-16 bg-slate-950/80 border-b border-slate-800/80 flex items-center justify-between px-4 md:px-6 shrink-0 backdrop-blur-lg z-30">
        <div class="flex items-center gap-3 min-w-0">
          <div class="flex items-center gap-2 md:hidden">
            <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0 overflow-hidden">
              <img src="https://res.cloudinary.com/dqzhp3lnq/image/upload/v1781580065/Copy_of_SMA_Itsbatiyah_fnnhdy.png" class="w-full h-full object-contain p-0.5">
            </div>
            <span class="text-[15px] font-bold text-white">SIMAK DUBA</span>
          </div>

          <div class="hidden md:flex items-center gap-2 min-w-0">
            <span class="text-[13px] text-slate-500">SIMAK</span>
            <span class="text-slate-600">/</span>
            <span class="text-[13px] font-semibold text-white truncate">{{ breadcrumb }}</span>
          </div>
        </div>

        <div class="flex items-center gap-1">
          <button class="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white text-xs transition mr-1">
            <Search class="w-3.5 h-3.5" />
            <span class="hidden lg:inline">Cari...</span>
            <kbd class="hidden lg:inline px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono">⌘K</kbd>
          </button>

          <button @click="toggleTheme"
                  :title="theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'"
                  class="p-2 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800/60 transition-colors">
            <Sun v-if="theme === 'dark'" class="w-4 h-4" />
            <Moon v-else class="w-4 h-4" />
          </button>

          <button class="hidden sm:flex relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition">
            <Bell class="w-4 h-4" />
          </button>

          <!-- USER MENU -->
          <div class="relative">
            <button @click="isUserMenuOpen = !isUserMenuOpen"
                    class="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg hover:bg-slate-800/60 transition group">
              <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xs font-bold shadow-lg shadow-emerald-900/40">
                {{ initial }}
              </div>
              <ChevronDown class="w-3 h-3 text-slate-500 group-hover:text-white transition hidden sm:block" />
            </button>

            <Transition name="dropdown">
              <div v-if="isUserMenuOpen"
                   class="absolute right-0 top-full mt-2 w-64 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden z-50">
                <div class="p-4 border-b border-slate-800">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold">
                      {{ initial }}
                    </div>
                    <div class="min-w-0">
                      <div class="text-sm font-bold text-white truncate">Administrator</div>
                      <div class="text-[11px] text-emerald-400 font-mono truncate">{{ userSesi?.email }}</div>
                    </div>
                  </div>
                </div>
                <div class="p-2">
                  <RouterLink
                    to="/settings"
                    @click="isUserMenuOpen = false"
                    class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] text-slate-300 hover:bg-slate-800/60 transition text-left">
                    <UserIcon class="w-4 h-4 text-emerald-400" />
                    <span>Akun & Pengaturan</span>
                  </RouterLink>
                  <button
                    @click="showAbout = true; isUserMenuOpen = false"
                    class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] text-slate-300 hover:bg-slate-800/60 transition text-left">
                    <Info class="w-4 h-4 text-blue-400" />
                    <span>Tentang Aplikasi</span>
                  </button>

                  <!-- ← TOMBOL KELUAR DI HEADER -->
                  <div class="my-1 border-t border-slate-800"></div>
                  <button
                    @click="handleLogout(); isUserMenuOpen = false"
                    class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] text-red-400 hover:bg-red-500/10 transition text-left">
                    <LogOut class="w-4 h-4" />
                    <span>Keluar</span>
                  </button>
                </div>
              </div>
            </Transition>
          </div>
        </div>
      </header>

      <!-- MAIN AREA -->
      <main class="flex-1 overflow-y-auto bg-slate-950 pb-[calc(56px+env(safe-area-inset-bottom))] md:pb-0" @click="isUserMenuOpen = false">
        <RouterView v-slot="{ Component }">
          <Transition name="page" mode="out-in">
            <component :is="Component" />
          </Transition>
        </RouterView>
      </main>
    </div>

    <!-- ─── BOTTOM NAVIGATION (MOBILE) ─── -->
    <nav
      class="md:hidden fixed bottom-0 left-0 right-0 border-t z-50 flex items-center justify-around pb-[env(safe-area-inset-bottom)] backdrop-blur-lg"
      :class="theme === 'dark' ? 'bg-slate-950/95 border-slate-800' : 'bg-white/95 border-slate-200'">

      <RouterLink v-for="item in bottomNavItems" :key="item.path" :to="item.path"
                  class="flex flex-col items-center justify-center w-full h-[56px] gap-1 transition-colors"
                  :class="route.path === item.path
                    ? 'text-emerald-400'
                    : (theme === 'dark' ? 'text-white' : 'text-black')">
        <component :is="item.icon" class="w-5 h-5" :class="route.path === item.path ? 'fill-emerald-400/20' : ''" />
        <span class="text-[10px] font-medium">{{ item.name }}</span>
      </RouterLink>

      <!-- Tombol Menu → buka overlay full-screen -->
      <button @click="isMenuOpen = true"
              class="flex flex-col items-center justify-center w-full h-[56px] gap-1 transition-colors"
              :class="theme === 'dark' ? 'text-white' : 'text-black'">
        <Menu class="w-5 h-5" />
        <span class="text-[10px] font-medium">Menu</span>
      </button>
    </nav>

    <!-- ─── OVERLAY MENU MOBILE (slide dari kanan, grid tombol) ─── -->
    <Transition name="menu-slide">
      <div v-if="isMenuOpen"
           class="md:hidden fixed inset-0 z-[60] overflow-y-auto"
           :class="theme === 'dark' ? 'bg-slate-950' : 'bg-slate-50'">

        <!-- Header overlay -->
        <div class="sticky top-0 h-14 flex items-center justify-between px-4 backdrop-blur-lg z-10"
             :class="theme === 'dark' ? 'bg-slate-950/95 border-b border-slate-800' : 'bg-white/95 border-b border-slate-200'">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center overflow-hidden">
              <img src="https://res.cloudinary.com/dqzhp3lnq/image/upload/v1781580065/Copy_of_SMA_Itsbatiyah_fnnhdy.png" class="w-full h-full object-contain p-0.5">
            </div>
            <span class="text-[15px] font-bold" :class="theme === 'dark' ? 'text-white' : 'text-slate-900'">Semua Menu</span>
          </div>
          <button @click="isMenuOpen = false"
                  class="p-2 rounded-lg transition-colors"
                  :class="theme === 'dark' ? 'text-slate-400 hover:text-white hover:bg-slate-800/60' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'">
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- Isi grid menu -->
        <div class="p-4 pb-10 space-y-5">
          <div v-for="group in menuGroups" :key="group.title">
            <div class="px-1 mb-2 text-[11px] font-bold uppercase tracking-wider"
                 :class="theme === 'dark' ? 'text-slate-500' : 'text-slate-400'">
              {{ group.title }}
            </div>
            <div class="grid grid-cols-3 gap-2">
              <RouterLink v-for="m in group.items" :key="m.path" :to="m.path"
                          @click="isMenuOpen = false"
                          class="flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all aspect-square"
                          :class="[
                            route.path === m.path
                              ? (theme === 'dark' ? 'bg-emerald-500/10 border-emerald-500/50' : 'bg-emerald-50 border-emerald-400')
                              : (theme === 'dark' ? 'bg-slate-900/60 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 hover:border-slate-300')
                          ]">
                <component :is="m.icon" class="w-6 h-6 shrink-0"
                           :class="route.path === m.path
                             ? (theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600')
                             : (theme === 'dark' ? 'text-slate-300' : 'text-slate-700')" />
                <span class="text-[10px] font-medium text-center leading-tight line-clamp-2"
                      :class="route.path === m.path
                        ? (theme === 'dark' ? 'text-emerald-300' : 'text-emerald-700')
                        : (theme === 'dark' ? 'text-slate-400' : 'text-slate-600')">
                  {{ m.name }}
                </span>
              </RouterLink>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <ConfirmDialog />

    <!-- Modal Tentang -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="showAbout"
            class="fixed inset-0 z-[9998] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4"
            @click.self="showAbout = false">
          <div class="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div class="p-6 text-center">
              <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-900/40">
                <img src="https://res.cloudinary.com/dqzhp3lnq/image/upload/v1781580065/Copy_of_SMA_Itsbatiyah_fnnhdy.png"
                    class="w-full h-full object-contain p-2" alt="Logo" />
              </div>
              <h3 class="text-lg font-bold text-white mb-1">SIMAK SMAI DUBA</h3>
              <p class="text-xs text-slate-400 mb-4">Sistem Informasi Akademik<br>SMA Al-Itsbatiyah Darul Ulum Banyuanyar</p>
              <div class="rounded-xl bg-slate-950/60 border border-slate-800 p-3 text-left text-[11.5px] space-y-1.5">
                <div class="flex justify-between"><span class="text-slate-500">Versi</span><span class="text-white font-mono">2.0 Premium</span></div>
                <div class="flex justify-between"><span class="text-slate-500">NPSN</span><span class="text-white font-mono">20529881</span></div>
                <div class="flex justify-between"><span class="text-slate-500">Akreditasi</span><span class="text-white">A</span></div>
                <div class="flex justify-between"><span class="text-slate-500">Alamat</span><span class="text-white text-right">Ds. Banyuanyar, Kec. Banyuanyar, Pamekasan</span></div>
              </div>
            </div>
            <div class="px-6 py-3 border-t border-slate-800 bg-slate-950/50 flex justify-end">
              <button @click="showAbout = false"
                      class="h-10 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[13px] font-semibold transition">
                Tutup
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.page-enter-active, .page-leave-active { transition: opacity 180ms ease, transform 180ms ease; }
.page-enter-from { opacity: 0; transform: translateY(4px); }
.page-leave-to { opacity: 0; }

.fade-enter-active, .fade-leave-active { transition: opacity 200ms; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.dropdown-enter-active, .dropdown-leave-active { transition: all 180ms cubic-bezier(0.16, 1, 0.3, 1); }
.dropdown-enter-from, .dropdown-leave-to { opacity: 0; transform: translateY(-4px); }

.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 180ms ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }

/* Overlay menu mobile: slide dari kanan */
.menu-slide-enter-active, .menu-slide-leave-active { transition: transform 260ms cubic-bezier(0.16, 1, 0.3, 1); }
.menu-slide-enter-from, .menu-slide-leave-to { transform: translateX(100%); }
</style>
