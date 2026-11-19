<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../lib/supabase'

const router = useRouter()
const email = ref('')
const password = ref('')
const pesanError = ref('')
const isLoading = ref(false)
const showPassword = ref(false)
const rememberMe = ref(false)
const focused = ref('')

const emailFilled = computed(() => email.value.length > 0)
const passFilled = computed(() => password.value.length > 0)

onMounted(() => {
  const saved = localStorage.getItem('simak_remember_email')
  if (saved) {
    email.value = saved
    rememberMe.value = true
  }
})

const handleLogin = async () => {
  if (isLoading.value) return
  isLoading.value = true
  pesanError.value = ''

  const { error } = await supabase.auth.signInWithPassword({
    email: email.value.trim(),
    password: password.value,
  })

  if (error) {
    pesanError.value = error.message
    isLoading.value = false
    return
  }

  if (rememberMe.value) {
    localStorage.setItem('simak_remember_email', email.value.trim())
  } else {
    localStorage.removeItem('simak_remember_email')
  }
  router.push('/')
}
</script>

<template>
  <div class="lg-root">
    <!-- ========== PANEL KIRI: BRAND ========== -->
    <aside class="lg-hero" aria-hidden="true">
      <div class="lg-hero-photo"></div>
      <div class="lg-hero-tint"></div>
      <div class="lg-grid"></div>

      <div class="lg-hero-content">
        <div class="lg-hero-logo">
          <img
            src="https://res.cloudinary.com/dqzhp3lnq/image/upload/v1781580065/Copy_of_SMA_Itsbatiyah_fnnhdy.png"
            alt=""
          />
        </div>

        <div class="lg-hero-text">
          <p class="lg-kicker">Lembaga Pendidikan Islam</p>
          <h2 class="lg-hero-title">
            Database<br />
            <span>SMAI</span>
          </h2>
          <p class="lg-hero-desc">
            Sistem informasi akademik terpadu untuk LPI Darul Ulum PP Banyuanyar.
          </p>
        </div>

        <div class="lg-hero-foot">
          <span class="lg-dot"></span>
          <span>Sistem aktif</span>
          <span class="lg-sep">/</span>
          <span>2026</span>
        </div>
      </div>
    </aside>

    <!-- ========== PANEL KANAN: FORM ========== -->
    <main class="lg-panel">
      <div class="lg-glow" aria-hidden="true"></div>

      <div class="lg-wrap">
        <!-- Brand mobile -->
        <div class="lg-mobile-brand">
          <img
            src="https://res.cloudinary.com/dqzhp3lnq/image/upload/v1781580065/Copy_of_SMA_Itsbatiyah_fnnhdy.png"
            alt="Logo SMAI"
          />
          <div>
            <p class="lg-mb-title">Database <span>SMAI</span></p>
            <p class="lg-mb-sub">LPI Darul Ulum PP Banyuanyar</p>
          </div>
        </div>

        <header class="lg-head" style="--d: 1">
          <p class="lg-eyebrow">Portal Akademik</p>
          <h1>Masuk ke akun Anda</h1>
          <p class="lg-sub">Gunakan username dan password yang terdaftar.</p>
        </header>

        <transition name="lg-err">
          <div v-if="pesanError" class="lg-error" role="alert">
            <span class="lg-error-icon">!</span>
            <span>{{ pesanError }}</span>
          </div>
        </transition>

        <form class="lg-form" @submit.prevent="handleLogin" novalidate>
          <!-- Email -->
          <div
            class="lg-field"
            :class="{ 'is-focus': focused === 'email', 'is-filled': emailFilled }"
            style="--d: 2"
          >
            <input
              id="username"
              v-model="email"
              type="email"
              autocomplete="username"
              required
              placeholder=" "
              @focus="focused = 'email'"
              @blur="focused = ''"
            />
            <label for="username">Username</label>
            <span class="lg-line"></span>
          </div>

          <!-- Password -->
          <div
            class="lg-field"
            :class="{ 'is-focus': focused === 'pass', 'is-filled': passFilled }"
            style="--d: 3"
          >
            <input
              id="password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="current-password"
              required
              placeholder=" "
              @focus="focused = 'pass'"
              @blur="focused = ''"
            />
            <label for="password">Password</label>
            <button
              type="button"
              class="lg-eye"
              :aria-label="showPassword ? 'Sembunyikan password' : 'Tampilkan password'"
              @click="showPassword = !showPassword"
            >
              <svg v-if="!showPassword" viewBox="0 0 20 20" aria-hidden="true">
                <path d="M1.8 10s3-5.5 8.2-5.5S18.2 10 18.2 10s-3 5.5-8.2 5.5S1.8 10 1.8 10Z" />
                <circle cx="10" cy="10" r="2.5" />
              </svg>
              <svg v-else viewBox="0 0 20 20" aria-hidden="true">
                <path d="m3 3 14 14M8.4 5.6A8.6 8.6 0 0 1 10 5.5c5.2 0 8.2 4.5 8.2 4.5a13 13 0 0 1-2.2 2.6M5.6 6.4C3.7 7.7 1.8 10 1.8 10s3 4.5 8.2 4.5c1.4 0 2.6-.4 3.7-1" />
              </svg>
            </button>
            <span class="lg-line"></span>
          </div>

          <div class="lg-row" style="--d: 4">
            <label class="lg-check">
              <input v-model="rememberMe" type="checkbox" />
              <span class="lg-box">
                <svg viewBox="0 0 12 12"><path d="m2.5 6.2 2.2 2.2 4.8-4.8" /></svg>
              </span>
              <span>Ingat saya</span>
            </label>
            <a href="#bantuan" class="lg-link">Lupa password?</a>
          </div>

          <button type="submit" class="lg-submit" :disabled="isLoading" style="--d: 5">
            <span class="lg-shine" aria-hidden="true"></span>
            <span v-if="isLoading" class="lg-spin" aria-hidden="true"></span>
            <span class="lg-submit-text">{{ isLoading ? 'Memverifikasi...' : 'Masuk' }}</span>
            <svg v-if="!isLoading" viewBox="0 0 20 20" aria-hidden="true">
              <path d="M4 10h11M11 5.5 15.5 10 11 14.5" />
            </svg>
          </button>
        </form>

        <p class="lg-note" style="--d: 6">
          <span class="lg-dot"></span>
          Akses khusus pengguna terdaftar
        </p>

        <p class="lg-copy">© 2026 Database SMAI · LPI Darul Ulum PP Banyuanyar</p>
      </div>
    </main>
  </div>
</template>

<style scoped>
/* ================= ROOT ================= */
.lg-root {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: grid;
  grid-template-columns: 1fr;
  background: #020617;
  color: #f1f5f9;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  color-scheme: dark;
  overflow: hidden;
}
@media (min-width: 1024px) {
  .lg-root { grid-template-columns: 1.05fr 1fr; }
}

/* ================= HERO (kiri) ================= */
.lg-hero {
  display: none;
  position: relative;
  overflow: hidden;
  isolation: isolate;
}
@media (min-width: 1024px) { .lg-hero { display: block; } }

.lg-hero-photo {
  position: absolute;
  inset: -2%;
  background: url('https://res.cloudinary.com/dqzhp3lnq/image/upload/v1794978872/IMG20261118121122_bfjmd2.jpg') center / cover no-repeat;
  animation: kenburns 24s ease-in-out infinite alternate;
  z-index: -3;
}
@keyframes kenburns {
  from { transform: scale(1.02); }
  to   { transform: scale(1.1); }
}

.lg-hero-tint {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(160deg, rgba(2, 6, 23, 0.35) 0%, rgba(2, 6, 23, 0.9) 75%),
    radial-gradient(circle at 15% 15%, rgba(16, 185, 129, 0.35), transparent 55%);
  z-index: -2;
}

.lg-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.06) 1px, transparent 1px);
  background-size: 48px 48px;
  mask-image: radial-gradient(ellipse at center, #000 30%, transparent 75%);
  -webkit-mask-image: radial-gradient(ellipse at center, #000 30%, transparent 75%);
  z-index: -1;
}

.lg-hero-content {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 56px 64px;
}

.lg-hero-logo {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.95);
  padding: 6px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
}
.lg-hero-logo img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.lg-kicker {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: #6ee7b7;
  margin-bottom: 18px;
}

.lg-hero-title {
  font-size: clamp(56px, 7vw, 96px);
  font-weight: 800;
  line-height: 0.95;
  letter-spacing: -0.04em;
  color: #ffffff;
}
.lg-hero-title span {
  background: linear-gradient(120deg, #34d399, #a7f3d0 60%, #ffffff);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.lg-hero-desc {
  margin-top: 24px;
  max-width: 420px;
  font-size: 16px;
  line-height: 1.65;
  color: rgba(226, 232, 240, 0.78);
}

.lg-hero-foot {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: rgba(226, 232, 240, 0.7);
}
.lg-sep { opacity: 0.4; }

.lg-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.2);
  animation: pulse 2s ease-in-out infinite;
}
@keyframes pulse {
  50% { box-shadow: 0 0 0 7px rgba(16, 185, 129, 0); }
}

/* ================= PANEL (kanan) ================= */
.lg-panel {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 24px;
  overflow-y: auto;
  background:
    radial-gradient(ellipse at top right, rgba(16, 185, 129, 0.08), transparent 60%),
    #020617;
}

.lg-glow {
  position: absolute;
  top: -120px;
  right: -120px;
  width: 360px;
  height: 360px;
  border-radius: 50%;
  background: rgba(16, 185, 129, 0.12);
  filter: blur(90px);
  pointer-events: none;
}

.lg-wrap {
  position: relative;
  width: 100%;
  max-width: 380px;
  display: flex;
  flex-direction: column;
}

/* Brand mobile (hanya tampil di layar kecil) */
.lg-mobile-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 40px;
}
.lg-mobile-brand img {
  width: 40px;
  height: 40px;
  object-fit: contain;
  background: #fff;
  border-radius: 10px;
  padding: 4px;
}
.lg-mb-title {
  font-size: 15px;
  font-weight: 800;
  letter-spacing: 0.01em;
}
.lg-mb-title span { color: #34d399; }
.lg-mb-sub {
  font-size: 11px;
  color: #94a3b8;
  margin-top: 2px;
}
@media (min-width: 1024px) {
  .lg-mobile-brand { display: none; }
}

/* ================= HEADER ================= */
.lg-head { margin-bottom: 36px; animation: up 0.6s cubic-bezier(0.16, 1, 0.3, 1) both; animation-delay: calc(var(--d) * 80ms); }

.lg-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #34d399;
  margin-bottom: 14px;
}
.lg-eyebrow::before {
  content: '';
  width: 22px;
  height: 1px;
  background: #34d399;
}

.lg-head h1 {
  font-size: 30px;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.15;
  color: #ffffff;
}

.lg-sub {
  margin-top: 8px;
  font-size: 14px;
  color: #94a3b8;
  line-height: 1.6;
}

@keyframes up {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ================= ERROR ================= */
.lg-error {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  margin-bottom: 24px;
  border-radius: 12px;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #fca5a5;
  font-size: 13px;
  line-height: 1.5;
}
.lg-error-icon {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: rgba(239, 68, 68, 0.2);
  color: #fca5a5;
  font-size: 12px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
}

.lg-err-enter-active,
.lg-err-leave-active { transition: all 0.3s ease; }
.lg-err-enter-from,
.lg-err-leave-to { opacity: 0; transform: translateY(-6px); }

/* ================= FORM FIELD (underline) ================= */
.lg-form {
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.lg-field {
  position: relative;
  animation: up 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
  animation-delay: calc(var(--d) * 80ms);
}

.lg-field input {
  width: 100%;
  height: 52px;
  padding: 18px 44px 6px 0;
  background: transparent;
  border: none;
  border-bottom: 1px solid rgba(148, 163, 184, 0.25);
  color: #f8fafc;
  font-size: 15px;
  outline: none;
  transition: border-color 0.3s;
}

.lg-field label {
  position: absolute;
  left: 0;
  top: 16px;
  font-size: 15px;
  color: #64748b;
  pointer-events: none;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  transform-origin: left center;
}

/* Label naik saat fokus atau terisi */
.lg-field.is-focus label,
.lg-field.is-filled label {
  top: 2px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #34d399;
}
.lg-field.is-filled:not(.is-focus) label { color: #94a3b8; }

/* Garis bawah animasi */
.lg-line {
  position: absolute;
  left: 0;
  bottom: -1px;
  width: 100%;
  height: 2px;
  background: linear-gradient(90deg, #10b981, #6ee7b7);
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 0 12px rgba(16, 185, 129, 0.6);
}
.lg-field.is-focus .lg-line { transform: scaleX(1); }

/* Tombol mata */
.lg-eye {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: #64748b;
  cursor: pointer;
  border-radius: 8px;
  transition: color 0.2s, background 0.2s;
}
.lg-eye:hover { color: #34d399; background: rgba(16, 185, 129, 0.08); }
.lg-eye svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* ================= ROW (ingat saya & lupa) ================= */
.lg-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: -8px;
  animation: up 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
  animation-delay: calc(var(--d) * 80ms);
}

.lg-check {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
  font-size: 13px;
  color: #94a3b8;
}
.lg-check input { display: none; }

.lg-box {
  width: 18px;
  height: 18px;
  border-radius: 6px;
  border: 1.5px solid #334155;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}
.lg-box svg {
  width: 11px;
  height: 11px;
  fill: none;
  stroke: #022c22;
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: 0;
  transform: scale(0.5);
  transition: all 0.2s;
}
.lg-check input:checked + .lg-box {
  background: #10b981;
  border-color: #10b981;
}
.lg-check input:checked + .lg-box svg {
  opacity: 1;
  transform: scale(1);
}

.lg-link {
  font-size: 13px;
  font-weight: 500;
  color: #34d399;
  text-decoration: none;
  transition: color 0.2s;
}
.lg-link:hover { color: #6ee7b7; }

/* ================= SUBMIT ================= */
.lg-submit {
  position: relative;
  overflow: hidden;
  width: 100%;
  height: 54px;
  margin-top: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border: none;
  border-radius: 14px;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: #ffffff;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.01em;
  cursor: pointer;
  box-shadow: 0 10px 30px -8px rgba(16, 185, 129, 0.55);
  transition: transform 0.2s, box-shadow 0.3s, opacity 0.2s;
  animation: up 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
  animation-delay: calc(var(--d) * 80ms);
}
.lg-submit:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 16px 36px -8px rgba(16, 185, 129, 0.7);
}
.lg-submit:active:not(:disabled) { transform: translateY(0) scale(0.99); }
.lg-submit:disabled { opacity: 0.7; cursor: not-allowed; }
.lg-submit:focus-visible { outline: 3px solid rgba(110, 231, 183, 0.5); outline-offset: 3px; }

.lg-submit svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: transform 0.25s;
}
.lg-submit:hover:not(:disabled) svg { transform: translateX(4px); }

/* Efek kilau */
.lg-shine {
  position: absolute;
  top: 0;
  left: -75%;
  width: 50%;
  height: 100%;
  background: linear-gradient(120deg, transparent, rgba(255, 255, 255, 0.35), transparent);
  transform: skewX(-20deg);
  pointer-events: none;
}
.lg-submit:hover:not(:disabled) .lg-shine {
  animation: shine 0.9s ease;
}
@keyframes shine {
  to { left: 130%; }
}

.lg-spin {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.35);
  border-top-color: #ffffff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ================= FOOTER ================= */
.lg-note {
  margin-top: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font-size: 12px;
  color: #64748b;
  animation: up 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
  animation-delay: calc(var(--d) * 80ms);
}

.lg-copy {
  margin-top: 28px;
  text-align: center;
  font-size: 11px;
  color: #475569;
}

/* ================= RESPONSIVE & A11Y ================= */
@media (max-width: 480px) {
  .lg-head h1 { font-size: 26px; }
  .lg-field input { font-size: 16px; } /* cegah auto-zoom iOS */
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation: none !important;
    transition: none !important;
  }
}
</style>
