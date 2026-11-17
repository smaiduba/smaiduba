import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router'
import { cekSesi } from './stores/auth'

// Cek sesi login sebelum aplikasi dimuat
cekSesi().then(() => {
  createApp(App).use(router).mount('#app')
})