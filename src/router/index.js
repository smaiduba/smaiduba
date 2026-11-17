import { createRouter, createWebHistory } from 'vue-router'
import { userSesi } from '../stores/auth'

import LoginView from '../views/LoginView.vue'
import DashboardView from '../views/DashboardView.vue'
import SiswaView from '../views/SiswaView.vue'
import NilaiView from '../views/NilaiView.vue'
import MuadalahView from '../views/MuadalahView.vue'
import GuruView from '../views/GuruView.vue'
import KenaikanView from '../views/KenaikanView.vue'
import AbsensiView from '../views/AbsensiView.vue'
import AbsensiEkstraView from '../views/AbsensiEkstraView.vue'
import PusatCetakView from '../views/PusatCetakView.vue'
import RaportPrint from '../views/print/RaportPrint.vue'
import IjazahPrint from '../views/print/IjazahPrint.vue'
import BukuIndukPrint from '../views/print/BukuIndukPrint.vue'
import AbsensiPrint from '../views/print/AbsensiPrint.vue'
import SettingsView from '../views/SettingsView.vue'
import WorkspaceView from '../views/WorkspaceView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: LoginView },
    { path: '/', name: 'dashboard', component: DashboardView },
    { path: '/siswa', name: 'siswa', component: SiswaView },
    { path: '/nilai', name: 'nilai', component: NilaiView },
    { path: '/muadalah', name: 'muadalah', component: MuadalahView },
    { path: '/guru', name: 'guru', component: GuruView },
    { path: '/kenaikan', name: 'kenaikan', component: KenaikanView },
    { path: '/absen-kelas', name: 'absen-kelas', component: AbsensiView },
    { path: '/pusat-cetak', name: 'pusat-cetak', component: PusatCetakView },

    // === PRINT ROUTES ===
    { path: '/print/raport/:noInduk/:smt', name: 'print-raport', component: RaportPrint },
    { path: '/print/ijazah/:noInduk', name: 'print-ijazah', component: IjazahPrint },
    { path: '/print/bukuinduk/:noInduk', name: 'print-bukuinduk', component: BukuIndukPrint },
    { path: '/print/absensi/:type/:kelas', name: 'print-absensi', component: AbsensiPrint },

    // Placeholder (nanti diisi)
    { path: '/kaldik', name: 'kaldik', component: DashboardView },
    { path: '/absen-nabil', name: 'absen-nabil', component: AbsensiEkstraView },
    { path: '/absen-sorogan', name: 'absen-sorogan', component: AbsensiEkstraView },
    { path: '/jadwal', name: 'jadwal', component: DashboardView },
    { path: '/settings',  name: 'settings',  component: SettingsView },
    { path: '/workspace', name: 'workspace', component: WorkspaceView },
  ]
})

router.beforeEach((to, from, next) => {
  const butuhLogin = to.name !== 'login'
  if (butuhLogin && !userSesi.value) next('/login')
  else if (to.name === 'login' && userSesi.value) next('/')
  else next()
})

export default router
