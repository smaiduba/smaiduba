<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../lib/supabase'
import { User, Lock, Eye, EyeOff, ArrowRight, AlertCircle, ShieldCheck, GraduationCap } from 'lucide-vue-next'

const router = useRouter()
const email = ref('')
const password = ref('')
const pesanError = ref('')
const isLoading = ref(false)
const showPassword = ref(false)
const rememberMe = ref(false)

const handleLogin = async () => {
  isLoading.value = true
  pesanError.value = ''
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.value,
    password: password.value,
  })

  if (error) {
    pesanError.value = error.message
    isLoading.value = false
    const formEl = document.getElementById('form-login')
    if (formEl) {
      formEl.classList.remove('login-shake')
      void formEl.offsetWidth
      formEl.classList.add('login-shake')
    }
  } else {
    if (rememberMe.value) {
      localStorage.setItem('simak_remember_email', email.value)
    } else {
      localStorage.removeItem('simak_remember_email')
    }
    router.push('/')
  }
}

const savedEmail = localStorage.getItem('simak_remember_email')
if (savedEmail) {
  email.value = savedEmail
  rememberMe.value = true
}
</script>

<template>
  <div class="fixed inset-0 z-50 w-full h-full font-sans flex items-center justify-center overflow-hidden bg-slate-950">
    
    <!-- 1. BACKGROUND GAMBAR GEDUNG -->
    <div class="absolute inset-0 bg-cover bg-center bg-no-repeat animate-bg-zoom" 
         style="background-image: url('https://res.cloudinary.com/dqzhp3lnq/image/upload/v1794978872/IMG20261118121122_bfjmd2.jpg');">
      <!-- Gradien Kiri untuk teks, Kanan dibiarkan terang agar foto terlihat -->
      <div class="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-900/50 to-transparent"></div>
    </div>

    <!-- 2. MAIN LAYOUT (SPLIT SCREEN) -->
    <div class="relative z-10 w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col lg:flex-row items-center justify-between gap-10 lg:gap-20">
      
      <!-- SISI KIRI: BRANDING -->
      <div class="hidden lg:flex flex-col flex-1 text-white space-y-6 drop-shadow-2xl">
        <div class="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-slate-900/60 border border-slate-700 backdrop-blur-md w-fit">
          <GraduationCap class="w-4 h-4 text-emerald-400" />
          <span class="text-[12px] font-bold tracking-widest text-emerald-300 uppercase">SMA Al-Itsbatiyah</span>
        </div>
        
        <!-- Judul: Teks Gradient diganti warna solid agar PASTI muncul -->
        <h1 class="text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.15] text-white drop-shadow-lg">
          Sistem Informasi <br />
          <span class="text-emerald-400">Akademik Terpadu.</span>
        </h1>
        
        <p class="text-lg text-slate-200 max-w-md leading-relaxed font-medium drop-shadow-md">
          Platform manajemen data santri, nilai akademik, absensi, dan pencetakan dokumen dalam satu genggaman.
        </p>
      </div>

      <!-- SISI KANAN: KARTU LOGIN (40% TRANSPARAN) -->
      <div class="w-full max-w-[420px] flex-shrink-0">
        
        <!-- Panel Kaca: bg-slate-900/40 (Lebih Transparan) & backdrop-blur-3xl (Blur lebih tebal) -->
        <div class="relative bg-slate-900/40 backdrop-blur-3xl border border-white/20 rounded-[2rem] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.8)] p-8 sm:p-10 overflow-hidden animate-float">
          
          <!-- Efek Glow -->
          <div class="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none"></div>
          <div class="absolute -bottom-24 -left-24 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>

          <div class="relative z-10">
            <!-- Logo & Judul -->
            <div class="text-center mb-8">
              <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center overflow-hidden shadow-lg backdrop-blur-md">
                <img src="https://res.cloudinary.com/dqzhp3lnq/image/upload/v1781580065/Copy_of_SMA_Itsbatiyah_fnnhdy.png" 
                     alt="Logo" class="w-full h-full object-contain p-2">
              </div>
              <h2 class="text-2xl font-bold text-white tracking-tight mb-1 drop-shadow-sm">Selamat Datang</h2>
              <p class="text-[13px] text-slate-300">Silakan masuk ke akun Anda</p>
            </div>

            <!-- Pesan Error -->
            <div v-if="pesanError" class="mb-6 p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-200 text-xs flex items-start gap-2 backdrop-blur-md login-shake">
              <AlertCircle class="w-4 h-4 shrink-0 mt-0.5" />
              <span class="leading-relaxed font-medium">{{ pesanError }}</span>
            </div>

            <!-- Form -->
            <form id="form-login" @submit.prevent="handleLogin" class="space-y-4">
              
              <!-- Input Email -->
              <div>
                <label class="block text-[11px] font-bold text-white uppercase tracking-wider mb-1.5 ml-1 drop-shadow-sm">Email Pengguna</label>
                <div class="relative group">
                  <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-300 group-focus-within:text-emerald-400 transition-colors">
                    <User class="w-5 h-5" />
                  </div>
                  <!-- Input dibuat semi-transparan agar menyatu dengan kaca -->
                  <input v-model="email" type="email" required placeholder="admin@smai-duba.com" 
                         class="w-full h-12 pl-12 pr-4 bg-slate-950/40 border border-white/10 rounded-xl text-[14px] text-white placeholder-slate-400 outline-none focus:border-emerald-400 focus:bg-slate-950/60 focus:ring-2 focus:ring-emerald-500/20 transition-all" />
                </div>
              </div>

              <!-- Input Password -->
              <div>
                <label class="block text-[11px] font-bold text-white uppercase tracking-wider mb-1.5 ml-1 drop-shadow-sm">Kata Sandi</label>
                <div class="relative group">
                  <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-300 group-focus-within:text-emerald-400 transition-colors">
                    <Lock class="w-5 h-5" />
                  </div>
                  <input v-model="password" :type="showPassword ? 'text' : 'password'" required placeholder="••••••••" 
                         class="w-full h-12 pl-12 pr-12 bg-slate-950/40 border border-white/10 rounded-xl text-[14px] text-white placeholder-slate-400 outline-none focus:border-emerald-400 focus:bg-slate-950/60 focus:ring-2 focus:ring-emerald-500/20 transition-all" />
                  <button type="button" @click="showPassword = !showPassword" 
                          class="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-300 hover:text-white transition-colors">
                    <Eye v-if="!showPassword" class="w-5 h-5" />
                    <EyeOff v-else class="w-5 h-5" />
                  </button>
                </div>
              </div>

              <!-- Remember Me -->
              <div class="flex items-center justify-between pt-1">
                <label class="flex items-center gap-2 cursor-pointer group">
                  <input v-model="rememberMe" type="checkbox" class="w-4 h-4 rounded border-white/20 bg-slate-950/40 text-emerald-500 focus:ring-emerald-500/20 focus:ring-offset-0">
                  <span class="text-[13px] text-slate-300 group-hover:text-white transition-colors">Ingat saya</span>
                </label>
              </div>

              <!-- Tombol Submit -->
              <button type="submit" :disabled="isLoading" 
                      class="w-full h-12 mt-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white text-[14px] font-bold shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] transition-all flex items-center justify-center gap-2 group disabled:opacity-70">
                <span v-if="isLoading" class="flex items-center gap-2">
                  <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Memverifikasi...
                </span>
                <template v-else>
                  Masuk ke Dashboard
                  <ArrowRight class="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </template>
              </button>
            </form>

            <!-- Footer Copyright -->
            <div class="mt-8 pt-5 border-t border-white/10 flex flex-col items-center justify-center gap-1 text-[11px] text-slate-400">
              <div class="flex items-center gap-1.5 font-semibold text-slate-300">
                <ShieldCheck class="w-3.5 h-3.5 text-emerald-400" />
                <span>Sistem Terenkripsi & Aman</span>
              </div>
              <span class="mt-1">© 2026 SIMAK SMAI DUBA. All Rights Reserved.</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<style>
/* 1. Animasi Goyang (Shake) saat Error */
.login-shake {
  animation: shake 400ms cubic-bezier(.36,.07,.19,.97) both;
}
@keyframes shake {
  10%, 90% { transform: translateX(-1px); }
  20%, 80% { transform: translateX(2px); }
  30%, 50%, 70% { transform: translateX(-4px); }
  40%, 60% { transform: translateX(4px); }
}

/* 2. Animasi Background Zoom Halus (Bernapas) */
.animate-bg-zoom {
  animation: zoomBg 40s ease-in-out infinite alternate;
}
@keyframes zoomBg {
  0% { transform: scale(1); }
  100% { transform: scale(1.05); }
}

/* 3. Animasi Panel Kaca Melayang (Floating) */
.animate-float {
  animation: floatPanel 6s ease-in-out infinite;
}
@keyframes floatPanel {
  0% { transform: translateY(0px); }
  50% { transform: translateY(-6px); }
  100% { transform: translateY(0px); }
}
</style>
