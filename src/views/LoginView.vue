<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../lib/supabase'
// Import ikon dari lucide-vue-next
import { 
  Check, Users, UserCheck, Award, AlertCircle, User, Lock, Eye, EyeOff, ArrowRight, ArrowLeft 
} from 'lucide-vue-next'

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
    // Trigger animasi shake pada form
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

// Cek apakah ada email yang diingat sebelumnya
const savedEmail = localStorage.getItem('simak_remember_email')
if (savedEmail) {
  email.value = savedEmail
  rememberMe.value = true
}
</script>

<template>
  <!-- SCREEN LOGIN -->
  <div id="screen-login" class="fixed inset-0 z-50 bg-slate-950 overflow-y-auto w-full h-full font-sans">
    <!-- Background Effects -->
    <div class="login-bg-mesh" aria-hidden="true"></div>
    <div class="login-bg-grid" aria-hidden="true"></div>
    <div class="login-bg-glow login-bg-glow-1" aria-hidden="true"></div>
    <div class="login-bg-glow login-bg-glow-2" aria-hidden="true"></div>

    <div class="relative z-10 min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div class="w-full max-w-6xl">
        <div class="grid lg:grid-cols-12 bg-slate-900/60 backdrop-blur-2xl rounded-[28px] border border-slate-700/60 shadow-[0_32px_80px_-24px_rgba(0,0,0,0.7)] overflow-hidden">

          <!-- Branding (kiri) -->
          <div class="lg:col-span-6 xl:col-span-7 relative p-8 lg:p-10 xl:p-12 bg-gradient-to-br from-emerald-950/60 via-slate-900/80 to-teal-950/60 border-b lg:border-b-0 lg:border-r border-slate-800 overflow-hidden">
            <div class="absolute inset-0 opacity-[0.03]" style="background-image: radial-gradient(circle, #10b981 1px, transparent 1px); background-size: 24px 24px;" aria-hidden="true"></div>
            <div class="absolute -top-32 -right-32 w-80 h-80 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" aria-hidden="true"></div>
            <div class="absolute -bottom-32 -left-32 w-80 h-80 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" aria-hidden="true"></div>

            <div class="relative flex flex-col h-full">
              <div class="flex items-center gap-4 mb-8">
                <div class="login-logo-float w-16 h-16 rounded-2xl bg-white/5 border border-emerald-400/40 flex items-center justify-center shadow-2xl shadow-emerald-950/60 backdrop-blur-sm overflow-hidden shrink-0">
                  <img src="https://res.cloudinary.com/dqzhp3lnq/image/upload/v1781580065/Copy_of_SMA_Itsbatiyah_fnnhdy.png" alt="Logo SMAI DUBA" class="w-full h-full object-contain p-1.5">
                </div>
                <div>
                  <div class="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400 mb-0.5">Portal Akademik</div>
                  <h1 class="text-2xl lg:text-3xl font-bold text-white font-heading tracking-tight leading-tight">SIMAK SMAI DUBA</h1>
                  <p class="text-xs text-slate-400 mt-1">Sistem Informasi Akademik SMAI DUBA</p>
                </div>
              </div>

              <div class="mb-8">
                <h2 class="text-xl lg:text-2xl font-bold text-white font-heading leading-snug tracking-tight mb-3">
                  Kelola Data Akademik <br>
                  <span class="text-gradient-emerald">Lebih Cerdas &amp; Cepat</span>
                </h2>
                <p class="text-sm text-slate-300 leading-relaxed max-w-md">
                  Terintegrasi penuh dengan Database Cloud. Database santri, nilai, absensi, hingga cetak raport — semua dalam satu platform.
                </p>
              </div>

              <div class="space-y-3 mb-8">
                <div class="login-feature flex items-start gap-3">
                  <div class="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0 mt-0.5"><Check class="w-3 h-3 text-emerald-400" /></div>
                  <span class="text-xs text-slate-200 leading-relaxed">Database Santri 38 Kolom Sesuai DAPODIK</span>
                </div>
                <div class="login-feature flex items-start gap-3">
                  <div class="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0 mt-0.5"><Check class="w-3 h-3 text-emerald-400" /></div>
                  <span class="text-xs text-slate-200 leading-relaxed">Transkrip Nilai 6 Semester &amp; Cetak Raport Otomatis</span>
                </div>
                <div class="login-feature flex items-start gap-3">
                  <div class="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0 mt-0.5"><Check class="w-3 h-3 text-emerald-400" /></div>
                  <span class="text-xs text-slate-200 leading-relaxed">Absensi Kelas, Nabil, &amp; Sorogan Kitab Kuning</span>
                </div>
                <div class="login-feature flex items-start gap-3">
                  <div class="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0 mt-0.5"><Check class="w-3 h-3 text-emerald-400" /></div>
                  <span class="text-xs text-slate-200 leading-relaxed">Nilai Muadalah, Ijazah &amp; Surat Keterangan Lulus</span>
                </div>
              </div>

              <div class="grid grid-cols-3 gap-3 mb-8">
                <div class="login-stat-card p-3 rounded-xl bg-white/[0.03] border border-white/10 backdrop-blur-sm">
                  <div class="flex items-center gap-1.5 mb-1">
                    <Users class="w-3 h-3 text-emerald-400" />
                    <span class="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Santri</span>
                  </div>
                  <div class="text-lg font-bold text-white font-mono-code leading-none">500+</div>
                </div>
                <div class="login-stat-card p-3 rounded-xl bg-white/[0.03] border border-white/10 backdrop-blur-sm">
                  <div class="flex items-center gap-1.5 mb-1">
                    <UserCheck class="w-3 h-3 text-teal-400" />
                    <span class="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Guru</span>
                  </div>
                  <div class="text-lg font-bold text-white font-mono-code leading-none">40+</div>
                </div>
                <div class="login-stat-card p-3 rounded-xl bg-white/[0.03] border border-white/10 backdrop-blur-sm">
                  <div class="flex items-center gap-1.5 mb-1">
                    <Award class="w-3 h-3 text-blue-400" />
                    <span class="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Lulus</span>
                  </div>
                  <div class="text-lg font-bold text-white font-mono-code leading-none">120+</div>
                </div>
              </div>

              <div class="mt-auto pt-6 border-t border-slate-800/60 flex items-center justify-between gap-4 text-[11px] text-slate-400">
                <span>SMA Al-Itsbatiyah Darul Ulum Banyuanyar</span>
                <span class="font-mono-code font-semibold text-emerald-400/80">NPSN: 20529881</span>
              </div>
            </div>
          </div>

          <!-- Form Login (kanan) -->
          <div class="lg:col-span-6 xl:col-span-5 p-8 lg:p-10 xl:p-12 flex flex-col justify-center">
            <div class="max-w-sm w-full mx-auto">
              <div class="mb-8">
                <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider text-emerald-400 mb-4">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-emerald"></span>
                  <span>Sign In</span>
                </div>
                <h2 class="text-2xl font-bold text-white font-heading tracking-tight mb-2">Selamat Datang Kembali</h2>
                <p class="text-sm text-slate-400">Masuk untuk mengakses dashboard akademik</p>
              </div>

              <!-- Pesan Error -->
              <div v-if="pesanError" class="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/40 text-red-300 text-xs flex items-start gap-2.5 login-shake">
                <AlertCircle class="w-4 h-4 shrink-0 mt-0.5" />
                <span class="flex-1 leading-relaxed">{{ pesanError }}</span>
              </div>

              <form id="form-login" @submit.prevent="handleLogin" class="space-y-5" autocomplete="on">
                <div class="form-field">
                  <label for="login-username" class="block text-xs font-semibold text-slate-300 mb-1.5">Nama Pengguna (Email)</label>
                  <div class="relative login-input-wrapper">
                    <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 transition-colors"><User class="w-4 h-4" /></div>
                    <input v-model="email" type="email" id="login-username" placeholder="admin@smai-duba.com" required autocomplete="username" spellcheck="false" class="login-input">
                  </div>
                </div>

                <div class="form-field">
                  <label for="login-password" class="block text-xs font-semibold text-slate-300 mb-1.5">Kata Sandi</label>
                  <div class="relative login-input-wrapper">
                    <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 transition-colors"><Lock class="w-4 h-4" /></div>
                    <input v-model="password" :type="showPassword ? 'text' : 'password'" id="login-password" placeholder="masukkan password" required autocomplete="current-password" spellcheck="false" class="login-input pr-11">
                    <button type="button" @click="showPassword = !showPassword" id="btn-toggle-password" class="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-emerald-400 transition-colors cursor-pointer" tabindex="-1">
                      <Eye v-if="!showPassword" class="w-4 h-4" />
                      <EyeOff v-else class="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div class="flex items-center justify-between pt-1">
                  <label class="flex items-center gap-2 cursor-pointer group">
                    <input v-model="rememberMe" type="checkbox" id="login-remember" class="login-checkbox">
                    <span class="text-xs text-slate-400 group-hover:text-slate-200 transition-colors select-none">Ingat saya</span>
                  </label>
                </div>

                <button type="submit" :disabled="isLoading" class="login-submit-btn group">
                  <span class="login-submit-text">{{ isLoading ? 'Memproses...' : 'Masuk ke Dashboard' }}</span>
                  <ArrowRight v-if="!isLoading" class="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  <div v-else class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                </button>
              </form>

              <div class="text-center pt-4 mt-4 border-t border-slate-800/60">
                <p class="text-[11px] text-slate-500">
                  Dengan masuk, Anda menyetujui <a href="#" class="text-emerald-400/80 hover:text-emerald-400 underline decoration-dotted">Kebijakan Penggunaan</a>
                </p>
                <p class="text-[10px] text-slate-600 mt-2 font-mono-code">v2.0 Premium Edition</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  </div>
</template>

<style>
/* ============================================================
   CUSTOM CSS LOGIN (Diambil 1:1 dari GAS)
   ============================================================ */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

.font-heading { font-family: 'Inter', system-ui, sans-serif; font-weight: 700; letter-spacing: -0.02em; }
.font-mono-code { font-family: 'JetBrains Mono', ui-monospace, monospace; }

.text-gradient-emerald {
  background: linear-gradient(135deg, #10b981, #14b8a6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.pulse-emerald {
  animation: pulse-emerald 2s infinite;
}
@keyframes pulse-emerald {
  0%, 100% { box-shadow: 0 0 0 0 rgba(16,185,129,.7); }
  50%      { box-shadow: 0 0 0 6px rgba(16,185,129,0); }
}

.login-bg-mesh {
  position: fixed; inset: 0;
  background:
    radial-gradient(ellipse 80% 60% at 20% 20%, rgba(16,185,129,.15), transparent 60%),
    radial-gradient(ellipse 70% 50% at 80% 30%, rgba(20,184,166,.12), transparent 60%),
    radial-gradient(ellipse 60% 70% at 50% 100%, rgba(6,182,212,.1), transparent 60%);
  animation: loginMeshMove 20s ease-in-out infinite alternate;
  z-index: 1;
}
@keyframes loginMeshMove {
  0%   { transform: scale(1) translate(0, 0); }
  50%  { transform: scale(1.08) translate(-2%, 2%); }
  100% { transform: scale(1) translate(2%, -2%); }
}

.login-bg-grid {
  position: fixed; inset: 0;
  background-image: radial-gradient(circle, rgba(148,163,184,.08) 1px, transparent 1px);
  background-size: 32px 32px;
  mask-image: radial-gradient(ellipse at center, black 40%, transparent 75%);
  -webkit-mask-image: radial-gradient(ellipse at center, black 40%, transparent 75%);
  z-index: 1; pointer-events: none;
}

.login-bg-glow { position: fixed; border-radius: 50%; filter: blur(80px); z-index: 1; pointer-events: none; }
.login-bg-glow-1 {
  top: -10%; left: -5%; width: 40vw; height: 40vw;
  background: radial-gradient(circle, rgba(16,185,129,.15), transparent 70%);
  animation: loginGlowFloat 15s ease-in-out infinite alternate;
}
.login-bg-glow-2 {
  bottom: -10%; right: -5%; width: 45vw; height: 45vw;
  background: radial-gradient(circle, rgba(20,184,166,.12), transparent 70%);
  animation: loginGlowFloat 18s ease-in-out infinite alternate-reverse;
}
@keyframes loginGlowFloat {
  0%   { transform: translate(0, 0) scale(1); }
  100% { transform: translate(5%, 5%) scale(1.1); }
}

.login-logo-float { animation: logoFloat 4s ease-in-out infinite; }
@keyframes logoFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }

.login-feature { opacity: 0; transform: translateX(-8px); animation: featureFadeIn 500ms cubic-bezier(0.16,1,0.3,1) forwards; }
.login-feature:nth-child(1) { animation-delay: 300ms; }
.login-feature:nth-child(2) { animation-delay: 400ms; }
.login-feature:nth-child(3) { animation-delay: 500ms; }
.login-feature:nth-child(4) { animation-delay: 600ms; }
@keyframes featureFadeIn { to { opacity: 1; transform: translateX(0); } }

.login-stat-card { transition: all 300ms cubic-bezier(0.16,1,0.3,1); }
.login-stat-card:hover { background: rgba(16,185,129,.08); border-color: rgba(16,185,129,.3); transform: translateY(-2px); }

.login-input-wrapper:focus-within > div:first-child { color: #10b981 !important; }

.login-input {
  width: 100%; padding: 12px 14px 12px 42px;
  background: rgba(15,23,42,.6); border: 1.5px solid rgba(51,65,85,.8);
  border-radius: 13px; font-size: 13.5px; font-family: inherit; color: #fff;
  transition: all 220ms cubic-bezier(0.16,1,0.3,1); outline: none;
  backdrop-filter: blur(4px);
}
.login-input::placeholder { color: rgba(100,116,139,.7); }
.login-input:hover { border-color: rgba(71,85,105,.9); background: rgba(15,23,42,.8); }
.login-input:focus {
  border-color: #10b981; background: rgba(15,23,42,.9);
  box-shadow: 0 0 0 4px rgba(16,185,129,.12), 0 0 20px -4px rgba(16,185,129,.3);
}

.login-checkbox {
  appearance: none; -webkit-appearance: none;
  width: 16px; height: 16px; border-radius: 5px;
  border: 1.5px solid rgba(71,85,105,.9);
  background: rgba(15,23,42,.6); cursor: pointer; position: relative;
  transition: all 200ms; flex-shrink: 0;
}
.login-checkbox:hover { border-color: #10b981; }
.login-checkbox:checked { background: linear-gradient(135deg, #10b981, #14b8a6); border-color: #10b981; }
.login-checkbox:checked::after {
  content: ''; position: absolute; top: 50%; left: 50%;
  transform: translate(-50%, -60%) rotate(45deg);
  width: 4px; height: 8px;
  border: solid #fff; border-width: 0 2px 2px 0;
}

.login-submit-btn {
  width: 100%; padding: 13px 20px; border-radius: 13px;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: #fff; font-size: 13.5px; font-weight: 700; font-family: inherit;
  border: none; cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  transition: all 250ms cubic-bezier(0.16,1,0.3,1);
  position: relative; overflow: hidden;
  box-shadow: 0 4px 16px -4px rgba(16,185,129,.5), 0 0 0 1px rgba(16,185,129,.3) inset;
  letter-spacing: .01em;
}
.login-submit-btn::before {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(135deg, #059669 0%, #047857 100%);
  opacity: 0; transition: opacity 250ms;
}
.login-submit-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 8px 24px -6px rgba(16,185,129,.6), 0 0 0 1px rgba(16,185,129,.4) inset;
}
.login-submit-btn:hover:not(:disabled)::before { opacity: 1; }
.login-submit-btn:active:not(:disabled) { transform: translateY(0) scale(.99); }
.login-submit-btn:disabled { opacity: .7; cursor: not-allowed; }
.login-submit-btn > * { position: relative; z-index: 1; }

.login-shake { animation: loginShake 400ms cubic-bezier(.36,.07,.19,.97) both; }
@keyframes loginShake {
  10%, 90%   { transform: translateX(-2px); }
  20%, 80%   { transform: translateX(4px); }
  30%, 50%, 70% { transform: translateX(-6px); }
  40%, 60%   { transform: translateX(6px); }
}

@media (max-width: 1024px) {
  .login-bg-glow-1, .login-bg-glow-2 { width: 70vw; height: 70vw; }
}

/* SHINE EFFECT */
.grid.lg\:grid-cols-12 { position: relative; overflow: hidden; }
.grid.lg\:grid-cols-12::after {
  content: ''; position: absolute; top: -50%; left: -100%;
  width: 60%; height: 200%;
  background: linear-gradient(115deg, transparent 0%, rgba(255,255,255,.02) 30%, rgba(255,255,255,.15) 50%, rgba(255,255,255,.02) 70%, transparent 100%);
  transform: rotate(15deg); pointer-events: none; z-index: 5;
  animation: shineSweep 3s ease-in-out infinite;
}
@keyframes shineSweep {
  0%   { left: -100%; opacity: 0; }
  10%  { opacity: 1; }
  50%  { left: 150%; opacity: 0; }
  100% { left: 150%; opacity: 0; }
}
</style>