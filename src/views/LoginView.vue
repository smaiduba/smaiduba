<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../lib/supabase'

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
  <div class="login-page-wrapper">
    <!-- Main Shell dengan Background Image -->
    <main class="page-shell">
      <section class="login-card" aria-label="Formulir masuk Database SMAI">
        
        <!-- Brand Header -->
        <header class="brand">
          <div class="brand-mark" aria-hidden="true">
            <img src="https://res.cloudinary.com/dqzhp3lnq/image/upload/v1781580065/Copy_of_SMA_Itsbatiyah_fnnhdy.png" alt="Logo SMAI" style="width: 100%; height: 100%; object-fit: contain; padding: 4px;" />
          </div>
          <div class="brand-copy">
            <strong>DATABASE <span>SMAI</span></strong>
            <small>LPI DARUL ULUM PP BANYUANYAR</small>
          </div>
        </header>

        <!-- Intro Text -->
        <div class="intro">
          <p class="eyebrow">PORTAL AKADEMIK</p>
          <h1>Selamat datang.</h1>
          <p class="intro-text">Masuk untuk melanjutkan ke sistem informasi sekolah.</p>
        </div>

        <!-- Form -->
        <form id="loginForm" @submit.prevent="handleLogin" novalidate>
          
          <!-- Error Message -->
          <div v-if="pesanError" class="toast-error">
            {{ pesanError }}
          </div>

          <!-- Username Field -->
          <div class="field-group">
            <label for="username">Username</label>
            <div class="input-wrap">
              <input 
                v-model="email" 
                id="username" 
                name="username" 
                type="email" 
                placeholder="Masukkan username" 
                autocomplete="username" 
                required 
              />
            </div>
          </div>

          <!-- Password Field -->
          <div class="field-group">
            <label for="password">Password</label>
            <div class="input-wrap password-wrap">
              <input 
                v-model="password" 
                id="password" 
                name="password" 
                :type="showPassword ? 'text' : 'password'" 
                placeholder="Masukkan password" 
                autocomplete="current-password" 
                required 
              />
              <button 
                class="password-toggle" 
                id="togglePassword" 
                type="button" 
                @click="showPassword = !showPassword" 
                aria-label="Tampilkan password" 
                :aria-pressed="showPassword"
              >
                <svg v-if="!showPassword" class="eye-open" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M2.8 12s3.2-6 9.2-6 9.2 6 9.2 6-3.2 6-9.2 6-9.2-6-9.2-6Z"/>
                  <circle cx="12" cy="12" r="2.7"/>
                </svg>
                <svg v-else class="eye-closed" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m3 3 18 18M10.6 6.2A9.8 9.8 0 0 1 12 6c6 0 9.2 6 9.2 6a15 15 0 0 1-3 3.6M6.2 6.3C4 7.7 2.8 12 2.8 12s3.2 6 9.2 6c1.2 0 2.3-.2 3.3-.6"/>
                  <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- Options -->
          <div class="form-options">
            <label class="remember-option">
              <input v-model="rememberMe" id="remember" type="checkbox" />
              <span class="custom-check" aria-hidden="true">
                <svg viewBox="0 0 12 12"><path d="m2 6 2.5 2.5L10 3"/></svg>
              </span>
              <span>Ingat saya</span>
            </label>
            <a class="forgot-link" href="#bantuan" id="forgotLink">Lupa password?</a>
          </div>

          <!-- Submit Button -->
          <button class="submit-button" type="submit" :disabled="isLoading">
            <span>{{ isLoading ? 'Memproses...' : 'Masuk' }}</span>
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M3.5 10h12M10 4.5 15.5 10 10 15.5"/>
            </svg>
          </button>
        </form>

        <!-- Card Footer -->
        <footer class="card-footer">
          <span class="footer-dot" aria-hidden="true"></span>
          Akses khusus pengguna terdaftar
        </footer>
      </section>

      <!-- Page Footer (Copyright) -->
      <footer class="page-footer">
        © 2026 DATABASE SMAI <span aria-hidden="true">·</span> LPI DARUL ULUM PP BANYUANYAR
      </footer>
    </main>
  </div>
</template>

<style scoped>
/* 
  IMPORT FONT SESUAI HTML
*/
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@500;600;700;800&display=swap');

/* 
  RESET & LAYOUT DASAR (Menggunakan background image yang Anda minta)
*/
.login-page-wrapper {
  color-scheme: light !important;
  font-family: 'DM Sans', system-ui, sans-serif;
  background-image: url('https://res.cloudinary.com/dqzhp3lnq/image/upload/v1794978872/IMG20261118121122_bfjmd2.jpg');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  min-height: 100vh;
  width: 100%;
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

/* Overlay gelap tipis di belakang kartu agar kartu putih menonjol */
.login-page-wrapper::before {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.4); /* Slate-900 dengan opacity 40% */
  z-index: -1;
}

.page-shell {
  width: 100%;
  max-width: 420px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* 
  KARTU LOGIN PUTIH BERSIH (1:1)
*/
.login-card {
  background: #ffffff;
  border-radius: 24px;
  padding: 40px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.8);
}

/* Brand / Header */
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 32px;
}
.brand-mark {
  width: 40px;
  height: 40px;
  background-color: #059669; /* Warna emerald/hijau */
  color: #ffffff;
  font-family: 'Manrope', sans-serif;
  font-size: 20px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
}
.brand-copy {
  display: flex;
  flex-direction: column;
}
.brand-copy strong {
  font-family: 'Manrope', sans-serif;
  font-size: 15px;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: 0.02em;
}
.brand-copy strong span {
  color: #059669;
}
.brand-copy small {
  font-size: 9px;
  font-weight: 700;
  color: #64748b;
  letter-spacing: 0.05em;
  margin-top: 2px;
}

/* Intro */
.intro {
  margin-bottom: 32px;
}
.eyebrow {
  font-size: 10px;
  font-weight: 700;
  color: #059669;
  letter-spacing: 0.1em;
  margin-bottom: 4px;
}
.intro h1 {
  font-family: 'Manrope', sans-serif;
  font-size: 28px;
  font-weight: 800;
  color: #0f172a;
  line-height: 1.2;
  margin-bottom: 8px;
  letter-spacing: -0.02em;
}
.intro-text {
  font-size: 13.5px;
  color: #64748b;
  line-height: 1.5;
}

/* Form & Inputs */
form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.field-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field-group label {
  font-size: 12px;
  font-weight: 700;
  color: #334155;
}
.input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}
.input-wrap input {
  width: 100%;
  height: 44px;
  padding: 0 16px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  font-size: 14px;
  color: #0f172a;
  outline: none;
  transition: all 0.2s ease;
}
.input-wrap input::placeholder {
  color: #94a3b8;
}
.input-wrap input:focus {
  background: #ffffff;
  border-color: #10b981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
}

/* Password Wrap */
.password-wrap input {
  padding-right: 40px;
}
.password-toggle {
  position: absolute;
  right: 12px;
  background: none;
  border: none;
  cursor: pointer;
  color: #94a3b8;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: color 0.2s;
}
.password-toggle:hover {
  color: #059669;
}
.password-toggle svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* Form Options */
.form-options {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 4px;
}
.remember-option {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}
.remember-option input {
  display: none;
}
.custom-check {
  width: 16px;
  height: 16px;
  border: 1.5px solid #cbd5e1;
  border-radius: 4px;
  background: #f8fafc;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}
.custom-check svg {
  width: 10px;
  height: 10px;
  fill: none;
  stroke: #ffffff;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  display: none;
}
.remember-option input:checked + .custom-check {
  background: #059669;
  border-color: #059669;
}
.remember-option input:checked + .custom-check svg {
  display: block;
}
.remember-option span:last-child {
  font-size: 12.5px;
  font-weight: 500;
  color: #475569;
  user-select: none;
}
.forgot-link {
  font-size: 12.5px;
  font-weight: 700;
  color: #059669;
  text-decoration: none;
}
.forgot-link:hover {
  text-decoration: underline;
}

/* Submit Button */
.submit-button {
  width: 100%;
  height: 46px;
  margin-top: 8px;
  background: #0f172a;
  color: #ffffff;
  font-size: 14px;
  font-weight: 700;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.2s ease;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.2);
}
.submit-button:hover:not(:disabled) {
  background: #1e293b;
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.3);
}
.submit-button:active:not(:disabled) {
  transform: translateY(0);
}
.submit-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}
.submit-button svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: transform 0.2s;
}
.submit-button:hover:not(:disabled) svg {
  transform: translateX(3px);
}

/* Card Footer */
.card-footer {
  margin-top: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 600;
  color: #94a3b8;
}
.footer-dot {
  width: 6px;
  height: 6px;
  background: #10b981;
  border-radius: 50%;
}

/* Page Footer (Di luar kartu) */
.page-footer {
  text-align: center;
  font-size: 10px;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: 0.05em;
  text-shadow: 0 1px 3px rgba(0,0,0,0.8);
}

/* Error Toast (Disisipkan untuk Supabase) */
.toast-error {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #b91c1c;
  padding: 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  text-align: center;
  margin-bottom: 8px;
}
</style>
