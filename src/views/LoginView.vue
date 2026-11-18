<template>
  <div class="ws-root" :data-theme="theme">
    <!-- Decorative glow -->
    <div class="ws-glow ws-glow-1" aria-hidden="true"></div>
    <div class="ws-glow ws-glow-2" aria-hidden="true"></div>

    <div class="ws-content">

      <!-- ═══ HERO ═══ -->
      <section class="ws-hero">
        <div class="ws-hero-bg" aria-hidden="true"></div>
        <div class="ws-hero-grid">
          <div>
            <span class="ws-hero-badge">
              <span class="ws-hero-dot"></span>
              Workspace
            </span>
            <h1 class="ws-hero-title">Ruang Kerja</h1>
            <p class="ws-hero-sub">
              Pantau kelengkapan data, perbaiki duplikat, dan lengkapi biodata tanpa berpindah halaman.
            </p>
            <div class="ws-hero-actions">
              <button @click="muatData" :disabled="loading" class="ws-btn ws-btn-primary">
                <RefreshCw :class="['w-4 h-4', loading ? 'animate-spin' : '']" />
                <span>{{ loading ? 'Memuat…' : 'Refresh Data' }}</span>
              </button>
            </div>
          </div>

          <div class="ws-hero-side">
            <div class="ws-hero-ring-wrap">
              <svg class="ws-hero-ring" viewBox="0 0 140 140">
                <defs>
                  <linearGradient id="wsRingGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="#34d399" />
                    <stop offset="100%" stop-color="#14b8a6" />
                  </linearGradient>
                </defs>
                <circle class="ws-hero-ring-bg" cx="70" cy="70" r="60"></circle>
                <circle class="ws-hero-ring-fg" cx="70" cy="70" r="60"
                        stroke-dasharray="376.99"
                        :stroke-dashoffset="376.99 * (1 - stats.persenLengkap / 100)"></circle>
              </svg>
              <div class="ws-hero-ring-center">
                <div class="ws-hero-ring-pct">{{ stats.persenLengkap }}<span>%</span></div>
                <div class="ws-hero-ring-label">Lengkap</div>
              </div>
            </div>
            <div class="ws-hero-ring-sub">
              {{ stats.lengkapCount }} / {{ stats.totalAktif }} siswa
            </div>
          </div>
        </div>
      </section>

      <!-- ═══ KPI ═══ -->
      <div class="ws-kpi-grid">
        <div class="ws-kpi ws-kpi-emerald">
          <div class="ws-kpi-icon"><UserCheck class="w-5 h-5" /></div>
          <div class="ws-kpi-label">Siswa Aktif</div>
          <div class="ws-kpi-val">{{ stats.totalAktif }}</div>
          <div class="ws-kpi-sub">Terdaftar aktif</div>
        </div>

        <div class="ws-kpi ws-kpi-blue">
          <div class="ws-kpi-icon"><CheckCircle2 class="w-5 h-5" /></div>
          <div class="ws-kpi-label">Sudah Lengkap</div>
          <div class="ws-kpi-val">{{ stats.lengkapCount }}</div>
          <div class="ws-kpi-sub">{{ stats.persenLengkap }}% dari total</div>
        </div>

        <div class="ws-kpi ws-kpi-amber">
          <div class="ws-kpi-icon"><FileWarning class="w-5 h-5" /></div>
          <div class="ws-kpi-label">Perlu Perhatian</div>
          <div class="ws-kpi-val">{{ stats.totalIssue }}</div>
          <div class="ws-kpi-sub">Data tidak lengkap</div>
        </div>

        <div class="ws-kpi ws-kpi-red" :class="{ 'ws-kpi-pulse': stats.kritis > 0 }">
          <div class="ws-kpi-icon"><AlertTriangle class="w-5 h-5" /></div>
          <div class="ws-kpi-label">Kritis</div>
          <div class="ws-kpi-val">{{ stats.kritis }}</div>
          <div class="ws-kpi-sub">Tanpa kelas / duplikat</div>
        </div>
      </div>

      <!-- ═══ PRIORITAS ═══ -->
      <section
        v-if="!loading && diagnosa.skorSiswa.filter(s => s.skor < 100).length > 0"
        class="ws-priority">
        <div class="ws-priority-head">
          <div class="ws-priority-title">
            <div class="ws-priority-icon"><AlertCircle class="w-4 h-4" /></div>
            <div>
              <h3>Antrean Prioritas</h3>
              <p>Kelengkapan terendah — klik Lengkapi untuk memperbaiki langsung</p>
            </div>
          </div>
          <span class="ws-priority-count">
            {{ diagnosa.skorSiswa.filter(x => x.skor < 100).length }} siswa
          </span>
        </div>
        <div class="ws-priority-list">
          <div
            v-for="(s, i) in diagnosa.skorSiswa.filter(x => x.skor < 100).slice(0, 6)"
            :key="s.no_induk"
            class="ws-priority-item">
            <div class="ws-priority-rank">{{ String(i + 1).padStart(2, '0') }}</div>
            <div class="ws-priority-score" :class="s.skor >= 50 ? 'is-warn' : 'is-danger'">
              {{ s.skor }}%
            </div>
            <div class="ws-priority-info">
              <div class="ws-priority-name">{{ s.nama }}</div>
              <div class="ws-priority-meta">
                <span class="ws-mono">{{ s.no_induk }}</span>
                <span class="ws-dot">·</span>
                <span>{{ s.kelas || 'Tanpa kelas' }}</span>
              </div>
            </div>
            <button @click="bukaEditSiswa(s)" class="ws-priority-btn">
              <Save class="w-3.5 h-3.5" />
              <span>Lengkapi</span>
            </button>
          </div>
        </div>
      </section>

      <!-- ═══ LOADING ═══ -->
      <div v-if="loading" class="ws-loading">
        <div class="ws-loading-spinner"></div>
        <p>Menganalisis data…</p>
      </div>

      <!-- ═══ ERROR ═══ -->
      <div v-else-if="siswa.length === 0" class="ws-error">
        <div class="ws-error-icon"><AlertTriangle class="w-8 h-8" /></div>
        <h3>Tidak dapat memuat data siswa</h3>
        <p>
          Kemungkinan: koneksi Supabase terputus, session expired,
          atau RLS memblokir query. Buka DevTools → Console untuk detail.
        </p>
        <button @click="muatData" class="ws-btn ws-btn-primary">
          <RefreshCw class="w-4 h-4" /> Coba Lagi
        </button>
      </div>

      <!-- ═══ KATEGORI ═══ -->
      <div v-else class="ws-sections">
        <section v-for="(grup, gi) in kategori" :key="grup.section" class="ws-section" :style="{ '--d': gi * 80 + 'ms' }">
          <header class="ws-section-head">
            <div class="ws-section-bar"></div>
            <h2>{{ grup.section }}</h2>
            <span class="ws-section-count">
              {{ grup.items.reduce((a, b) => a + b.data.length, 0) }} masalah
            </span>
          </header>
          <div class="ws-card-grid">
            <button
              v-for="kat in grup.items"
              :key="kat.id"
              @click="bukaModal(kat)"
              :disabled="kat.data.length === 0"
              :class="[
                'ws-card',
                `ws-card-${kat.color}`,
                kat.data.length === 0 ? 'is-empty' : 'has-data'
              ]">
              <div class="ws-card-top">
                <div class="ws-card-icon">
                  <component :is="kat.icon" class="w-[18px] h-[18px]" />
                </div>
                <div class="ws-card-count">{{ kat.data.length }}</div>
              </div>
              <div class="ws-card-label">{{ kat.label }}</div>
              <div class="ws-card-desc">{{ kat.desc }}</div>
              <div class="ws-card-arrow">
                <svg viewBox="0 0 16 16" fill="none" class="w-4 h-4">
                  <path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
            </button>
          </div>
        </section>
      </div>

    </div>

    <!-- ═══ MODAL LIST ═══ -->
    <div v-if="modal" class="ws-modal" @click.self="tutupModal">
      <div class="ws-modal-panel">
        <header class="ws-modal-head">
          <div class="min-w-0">
            <h3>{{ modal.title }}</h3>
            <p>{{ modal.desc }} • {{ modal.data.length }} item</p>
          </div>
          <div class="ws-modal-actions">
            <button @click="exportKategori" class="ws-modal-btn">
              <Download class="w-3.5 h-3.5" /> Export
            </button>
            <button
              v-if="modal.nav"
              @click="router.push(modal.nav); tutupModal()"
              class="ws-modal-btn ws-modal-btn-primary">
              <ExternalLink class="w-3.5 h-3.5" /> Buka
            </button>
            <button @click="tutupModal" class="ws-modal-close">
              <X class="w-4 h-4" />
            </button>
          </div>
        </header>

        <div class="ws-modal-search">
          <Search class="w-4 h-4" />
          <input v-model="searchModal" type="text" placeholder="Cari siswa…" />
        </div>

        <div class="ws-modal-body">
          <template v-if="modal.isDuplikat">
            <div v-for="d in modalItems" :key="d.value" class="ws-dup-group">
              <div class="ws-dup-head">
                <span class="ws-dup-key">
                  {{ modal.title.replace('Duplikat ', '') }}: <b>{{ d.value }}</b>
                </span>
                <span class="ws-dup-count">{{ d.siswa.length }} siswa</span>
              </div>
              <div v-for="s in d.siswa" :key="s.no_induk" class="ws-dup-row">
                <span class="ws-mono ws-dup-ni">{{ s.no_induk }}</span>
                <span class="ws-dup-name">{{ s.nama }}</span>
                <span class="ws-dup-kelas">{{ s.kelas || '—' }}</span>
                <button @click="bukaEditSiswa(s, modal.id)" class="ws-row-btn">
                  Edit
                </button>
              </div>
            </div>
          </template>
          <template v-else>
            <div v-for="(s, i) in modalItems" :key="s.no_induk" class="ws-row">
              <span class="ws-row-idx">{{ String(i + 1).padStart(2, '0') }}</span>
              <div class="ws-row-info">
                <div class="ws-row-name">{{ s.nama }}</div>
                <div class="ws-row-meta">
                  <span class="ws-mono">{{ s.no_induk }}</span>
                  <span class="ws-dot">·</span>
                  <span>{{ s.kelas || 'Tanpa kelas' }}</span>
                </div>
              </div>
              <button @click="bukaEditSiswa(s, modal.id)" class="ws-row-btn">
                <Save class="w-3 h-3" /> Edit
              </button>
            </div>
          </template>
          <div v-if="modalItems.length === 0" class="ws-modal-empty">
            {{ searchModal ? 'Tidak ada hasil pencarian' : 'Tidak ada data' }}
          </div>
        </div>
      </div>
    </div>

    <!-- ═══ MODAL EDIT ═══ -->
    <div v-if="editModal" class="ws-modal ws-modal-edit"
         @click.self="!editModal.saving && tutupEdit()">
      <div class="ws-modal-panel ws-edit-panel">
        <header class="ws-modal-head">
          <div class="min-w-0">
            <h3>Lengkapi Data</h3>
            <p>
              <b class="ws-text-1">{{ editModal.student.nama }}</b>
              <span class="ws-dot">·</span>
              <span class="ws-mono">{{ editModal.student.no_induk }}</span>
            </p>
          </div>
          <button @click="tutupEdit" :disabled="editModal.saving" class="ws-modal-close">
            <X class="w-4 h-4" />
          </button>
        </header>

        <div class="ws-edit-body">
          <div v-for="f in editModal.fields" :key="f.field" class="ws-field">
            <label :class="['ws-field-label', f.highlight === 'danger' ? 'is-danger' : f.highlight === 'primary' ? 'is-primary' : '']">
              {{ f.label }}
            </label>
            <p v-if="f.hint" class="ws-field-hint">{{ f.hint }}</p>
            <textarea
              v-if="f.type === 'textarea'"
              v-model="editModal.values[f.field]"
              rows="2"
              :class="['ws-input', 'ws-textarea', f.highlight === 'danger' ? 'is-danger' : f.highlight === 'primary' ? 'is-primary' : '']"
            />
            <input
              v-else
              v-model="editModal.values[f.field]"
              type="text"
              :class="['ws-input', f.highlight === 'danger' ? 'is-danger' : f.highlight === 'primary' ? 'is-primary' : '']"
            />
          </div>
        </div>

        <footer class="ws-edit-foot">
          <button @click="tutupEdit" :disabled="editModal.saving" class="ws-btn ws-btn-ghost">
            Batal
          </button>
          <button @click="simpanEdit" :disabled="editModal.saving" class="ws-btn ws-btn-primary">
            <Loader2 v-if="editModal.saving" class="w-4 h-4 animate-spin" />
            <Save v-else class="w-4 h-4" />
            {{ editModal.saving ? 'Menyimpan…' : 'Simpan' }}
          </button>
        </footer>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ═══ THEME VARIABLES ═══ */
.ws-root[data-theme="light"] {
  --bg-base: #f8fafc;
  --bg-surface: #ffffff;
  --bg-elevated: #ffffff;
  --bg-muted: #f1f5f9;
  --border-1: #e2e8f0;
  --border-2: #cbd5e1;
  --text-1: #0f172a;
  --text-2: #475569;
  --text-3: #94a3b8;
  --shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 4px 12px rgba(15, 23, 42, 0.04);
  --shadow-lg: 0 20px 40px -12px rgba(15, 23, 42, 0.15);
  --hero-from: #ecfdf5;
  --hero-via: #f0fdfa;
  --hero-to: #ffffff;
  --hero-border: #a7f3d0;
  --accent-emerald: #059669; --accent-emerald-bg: #ecfdf5; --accent-emerald-border: #a7f3d0;
  --accent-blue: #2563eb;    --accent-blue-bg: #eff6ff;    --accent-blue-border: #bfdbfe;
  --accent-amber: #d97706;   --accent-amber-bg: #fffbeb;   --accent-amber-border: #fde68a;
  --accent-red: #dc2626;     --accent-red-bg: #fef2f2;     --accent-red-border: #fecaca;
  --accent-purple: #9333ea;  --accent-purple-bg: #faf5ff;  --accent-purple-border: #e9d5ff;
  --accent-slate: #475569;   --accent-slate-bg: #f1f5f9;   --accent-slate-border: #cbd5e1;
  --modal-overlay: rgba(15, 23, 42, 0.4);
  --glow-1: rgba(16, 185, 129, 0.1);
  --glow-2: rgba(59, 130, 246, 0.08);
}

.ws-root[data-theme="dark"] {
  --bg-base: #020617;
  --bg-surface: #111827;
  --bg-elevated: #0f172a;
  --bg-muted: #1e293b;
  --border-1: #1e293b;
  --border-2: #334155;
  --text-1: #f8fafc;
  --text-2: #94a3b8;
  --text-3: #64748b;
  --shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 24px 60px -12px rgba(0, 0, 0, 0.8);
  --hero-from: #0f172a;
  --hero-via: #111827;
  --hero-to: #020617;
  --hero-border: #334155;
  --accent-emerald: #34d399; --accent-emerald-bg: rgba(52, 211, 153, 0.1); --accent-emerald-border: rgba(52, 211, 153, 0.3);
  --accent-blue: #60a5fa;    --accent-blue-bg: rgba(96, 165, 250, 0.1);    --accent-blue-border: rgba(96, 165, 250, 0.3);
  --accent-amber: #fbbf24;   --accent-amber-bg: rgba(251, 191, 36, 0.1);   --accent-amber-border: rgba(251, 191, 36, 0.3);
  --accent-red: #f87171;     --accent-red-bg: rgba(248, 113, 113, 0.1);    --accent-red-border: rgba(248, 113, 113, 0.3);
  --accent-purple: #c084fc;  --accent-purple-bg: rgba(192, 132, 252, 0.1); --accent-purple-border: rgba(192, 132, 252, 0.3);
  --accent-slate: #94a3b8;   --accent-slate-bg: rgba(148, 163, 184, 0.1);  --accent-slate-border: rgba(148, 163, 184, 0.3);
  --modal-overlay: rgba(2, 6, 23, 0.75);
  --glow-1: rgba(16, 185, 129, 0.15);
  --glow-2: rgba(59, 130, 246, 0.1);
}

/* ═══ BASE ═══ */
.ws-root {
  position: relative;
  min-height: 100%;
  padding: 1.5rem 1rem;
  background: var(--bg-base);
  overflow: hidden;
  transition: background 200ms;
}
@media (min-width: 768px) { .ws-root { padding: 2rem 1.5rem; } }
@media (min-width: 1024px) { .ws-root { padding: 2.5rem 2rem; } }

.ws-content {
  position: relative;
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  z-index: 1;
}

/* Utilities */
.ws-text-1 { color: var(--text-1); }
.ws-text-2 { color: var(--text-2); }
.ws-text-3 { color: var(--text-3); }
.ws-mono { font-family: ui-monospace, monospace; letter-spacing: -0.01em; }
.ws-dot { color: var(--text-3); }

/* ═══ GLOW ═══ */
.ws-glow {
  position: fixed;
  border-radius: 50%;
  filter: blur(120px);
  pointer-events: none;
  z-index: 0;
  opacity: 0.7;
}
.ws-glow-1 {
  width: 400px; height: 400px;
  top: -120px; right: -120px;
  background: radial-gradient(circle, var(--glow-1), transparent 70%);
}
.ws-glow-2 {
  width: 500px; height: 500px;
  bottom: -200px; left: -150px;
  background: radial-gradient(circle, var(--glow-2), transparent 70%);
}

/* ═══ HERO ═══ */
.ws-hero {
  position: relative;
  border-radius: 24px;
  padding: 28px;
  overflow: hidden;
  background: linear-gradient(135deg, var(--hero-from) 0%, var(--hero-via) 50%, var(--hero-to) 100%);
  border: 1px solid var(--hero-border);
  box-shadow: var(--shadow-lg);
}
@media (max-width: 640px) { .ws-hero { padding: 20px; border-radius: 20px; } }

.ws-hero-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(500px 300px at 90% -10%, var(--glow-1), transparent 65%);
  opacity: 0.8;
}

.ws-hero-grid {
  position: relative;
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
  align-items: center;
}
@media (min-width: 900px) {
  .ws-hero-grid { grid-template-columns: 1fr auto; }
}

.ws-hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 12px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  color: var(--accent-emerald);
  background: var(--accent-emerald-bg);
  border: 1px solid var(--accent-emerald-border);
  letter-spacing: 0.03em;
  text-transform: uppercase;
  margin-bottom: 14px;
}
.ws-hero-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--accent-emerald);
  animation: ws-pulse 2s ease-in-out infinite;
}
@keyframes ws-pulse {
  0%, 100% { box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent-emerald) 20%, transparent); }
  50% { box-shadow: 0 0 0 8px transparent; }
}

.ws-hero-title {
  font-size: clamp(24px, 4vw, 34px);
  font-weight: 800;
  letter-spacing: -0.035em;
  color: var(--text-1);
  line-height: 1.1;
  margin: 0 0 10px;
}
.ws-hero-sub {
  font-size: 13.5px;
  line-height: 1.6;
  color: var(--text-2);
  max-width: 480px;
  margin: 0 0 20px;
}
.ws-hero-actions { display: flex; gap: 10px; flex-wrap: wrap; }

.ws-hero-side {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.ws-hero-ring-wrap { position: relative; width: 160px; height: 160px; }
.ws-hero-ring { width: 100%; height: 100%; transform: rotate(-90deg); }
.ws-hero-ring-bg {
  fill: none;
  stroke: var(--border-1);
  stroke-width: 10;
}
.ws-hero-ring-fg {
  fill: none;
  stroke: url(#wsRingGrad);
  stroke-width: 10;
  stroke-linecap: round;
  transition: stroke-dashoffset 1.2s cubic-bezier(0.16, 1, 0.3, 1);
  filter: drop-shadow(0 0 8px color-mix(in srgb, var(--accent-emerald) 50%, transparent));
}
.ws-hero-ring-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}
.ws-hero-ring-pct {
  font-size: 32px;
  font-weight: 800;
  color: var(--text-1);
  letter-spacing: -0.04em;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.ws-hero-ring-pct span { font-size: 18px; color: var(--accent-emerald); margin-left: 1px; }
.ws-hero-ring-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-3);
  margin-top: 4px;
}
.ws-hero-ring-sub {
  font-size: 12px;
  color: var(--text-2);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

/* ═══ BUTTONS ═══ */
.ws-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 18px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 700;
  border: none;
  cursor: pointer;
  transition: all 200ms;
}
.ws-btn-primary {
  background: linear-gradient(135deg, #10b981, #059669);
  color: #fff;
  box-shadow: 0 8px 20px -8px rgba(16, 185, 129, 0.6);
}
.ws-btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 12px 24px -8px rgba(16, 185, 129, 0.8);
}
.ws-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.ws-btn-ghost {
  background: var(--bg-muted);
  color: var(--text-2);
  border: 1px solid var(--border-1);
}
.ws-btn-ghost:hover:not(:disabled) { background: var(--border-1); color: var(--text-1); }

/* ═══ KPI ═══ */
.ws-kpi-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
@media (min-width: 900px) {
  .ws-kpi-grid { grid-template-columns: repeat(4, 1fr); }
}

.ws-kpi {
  position: relative;
  padding: 18px;
  border-radius: 18px;
  background: var(--bg-surface);
  border: 1px solid var(--border-1);
  overflow: hidden;
  transition: all 250ms;
}
.ws-kpi::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
  background: var(--accent);
  opacity: 0.85;
}
.ws-kpi::after {
  content: '';
  position: absolute;
  top: -40px; right: -40px;
  width: 100px; height: 100px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--accent-bg), transparent 70%);
  pointer-events: none;
}
.ws-kpi:hover {
  transform: translateY(-2px);
  border-color: var(--accent);
  box-shadow: 0 10px 30px -12px color-mix(in srgb, var(--accent) 40%, transparent);
}
.ws-kpi-emerald { --accent: var(--accent-emerald); --accent-bg: var(--accent-emerald-bg); }
.ws-kpi-blue { --accent: var(--accent-blue); --accent-bg: var(--accent-blue-bg); }
.ws-kpi-amber { --accent: var(--accent-amber); --accent-bg: var(--accent-amber-bg); }
.ws-kpi-red { --accent: var(--accent-red); --accent-bg: var(--accent-red-bg); }

.ws-kpi-icon {
  position: relative;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-bg);
  color: var(--accent);
  margin-bottom: 12px;
}
.ws-kpi-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-3);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 4px;
}
.ws-kpi-val {
  font-size: 28px;
  font-weight: 800;
  color: var(--text-1);
  line-height: 1;
  letter-spacing: -0.035em;
  font-variant-numeric: tabular-nums;
  margin-bottom: 6px;
}
.ws-kpi-sub { font-size: 11px; color: var(--text-3); }
.ws-kpi-pulse { animation: ws-kpi-pulse 2.5s ease-in-out infinite; }
@keyframes ws-kpi-pulse {
  0%, 100% { box-shadow: 0 0 0 0 transparent; }
  50% { box-shadow: 0 0 0 6px color-mix(in srgb, var(--accent-red) 12%, transparent); }
}

/* ═══ PRIORITY ═══ */
.ws-priority {
  border-radius: 20px;
  background: var(--bg-surface);
  border: 1px solid var(--border-1);
  overflow: hidden;
}
.ws-priority-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-1);
  background: linear-gradient(90deg, var(--accent-amber-bg), transparent);
}
.ws-priority-title { display: flex; align-items: center; gap: 12px; min-width: 0; }
.ws-priority-icon {
  width: 34px; height: 34px;
  border-radius: 10px;
  background: var(--accent-amber-bg);
  color: var(--accent-amber);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.ws-priority-title h3 {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-1);
  margin: 0;
  line-height: 1.2;
}
.ws-priority-title p {
  font-size: 11px;
  color: var(--text-3);
  margin: 2px 0 0;
}
.ws-priority-count {
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--accent-amber-bg);
  color: var(--accent-amber);
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}
.ws-priority-list { padding: 8px; }

.ws-priority-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 12px;
  border-radius: 12px;
  transition: background 150ms;
}
.ws-priority-item:hover { background: var(--bg-muted); }

.ws-priority-rank {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-3);
  font-variant-numeric: tabular-nums;
  width: 20px;
}
.ws-priority-score {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 32px;
  border-radius: 8px;
  font-size: 11.5px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.ws-priority-score.is-warn {
  background: var(--accent-amber-bg);
  color: var(--accent-amber);
  border: 1px solid var(--accent-amber-border);
}
.ws-priority-score.is-danger {
  background: var(--accent-red-bg);
  color: var(--accent-red);
  border: 1px solid var(--accent-red-border);
}
.ws-priority-info { flex: 1; min-width: 0; }
.ws-priority-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ws-priority-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--text-3);
  margin-top: 2px;
}
.ws-priority-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border-radius: 8px;
  background: var(--accent-emerald-bg);
  color: var(--accent-emerald);
  border: 1px solid var(--accent-emerald-border);
  font-size: 11.5px;
  font-weight: 700;
  transition: all 150ms;
  white-space: nowrap;
}
.ws-priority-btn:hover {
  background: var(--accent-emerald);
  color: #fff;
  border-color: var(--accent-emerald);
}

/* ═══ LOADING / ERROR ═══ */
.ws-loading, .ws-error {
  border-radius: 20px;
  background: var(--bg-surface);
  border: 1px solid var(--border-1);
  padding: 60px 20px;
  text-align: center;
}
.ws-loading-spinner {
  width: 40px; height: 40px;
  margin: 0 auto 16px;
  border-radius: 50%;
  border: 3px solid var(--border-1);
  border-top-color: var(--accent-emerald);
  animation: ws-spin 800ms linear infinite;
}
@keyframes ws-spin { to { transform: rotate(360deg); } }
.ws-loading p { color: var(--text-3); font-size: 13px; margin: 0; }

.ws-error { border-color: var(--accent-red-border); background: var(--accent-red-bg); }
.ws-error-icon {
  width: 56px; height: 56px;
  margin: 0 auto 16px;
  border-radius: 16px;
  background: var(--accent-red-bg);
  color: var(--accent-red);
  display: flex;
  align-items: center;
  justify-content: center;
}
.ws-error h3 { font-size: 15px; font-weight: 700; color: var(--accent-red); margin: 0 0 8px; }
.ws-error p { font-size: 12.5px; color: var(--text-2); max-width: 420px; margin: 0 auto 20px; line-height: 1.6; }

/* ═══ SECTIONS ═══ */
.ws-sections { display: flex; flex-direction: column; gap: 24px; }
.ws-section {
  opacity: 0;
  animation: ws-fade-up 600ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
  animation-delay: var(--d, 0ms);
}
@keyframes ws-fade-up {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.ws-section-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 4px 12px;
}
.ws-section-bar {
  width: 3px;
  height: 18px;
  border-radius: 2px;
  background: linear-gradient(180deg, #34d399, #14b8a6);
}
.ws-section-head h2 {
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-2);
  margin: 0;
}
.ws-section-count {
  margin-left: auto;
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--bg-muted);
  color: var(--text-3);
  font-size: 10.5px;
  font-weight: 700;
}

/* ═══ CARDS ═══ */
.ws-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
}

.ws-card {
  position: relative;
  padding: 16px;
  border-radius: 16px;
  background: var(--bg-surface);
  border: 1px solid var(--border-1);
  text-align: left;
  cursor: pointer;
  transition: all 220ms cubic-bezier(0.16, 1, 0.3, 1);
  overflow: hidden;
}
.ws-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0;
  width: 100%;
  height: 2px;
  background: var(--card-accent);
  opacity: 0;
  transition: opacity 220ms;
}
.ws-card.has-data:hover {
  transform: translateY(-3px);
  border-color: var(--card-accent);
  box-shadow: 0 12px 28px -12px color-mix(in srgb, var(--card-accent) 40%, transparent);
}
.ws-card.has-data:hover::before { opacity: 1; }
.ws-card.is-empty { opacity: 0.55; cursor: not-allowed; }

.ws-card-red    { --card-accent: var(--accent-red); }
.ws-card-amber  { --card-accent: var(--accent-amber); }
.ws-card-blue   { --card-accent: var(--accent-blue); }
.ws-card-purple { --card-accent: var(--accent-purple); }
.ws-card-slate  { --card-accent: var(--accent-slate); }

.ws-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.ws-card-icon {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--card-accent);
  background: color-mix(in srgb, var(--card-accent) 12%, transparent);
  transition: all 200ms;
}
.ws-card.has-data:hover .ws-card-icon {
  background: var(--card-accent);
  color: #fff;
  transform: scale(1.05);
}
.ws-card-count {
  font-size: 22px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.04em;
  color: var(--card-accent);
  line-height: 1;
}
.ws-card.is-empty .ws-card-count { color: var(--text-3); }
.ws-card-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-1);
  margin-bottom: 3px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ws-card-desc {
  font-size: 11px;
  color: var(--text-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding-right: 24px;
}
.ws-card-arrow {
  position: absolute;
  bottom: 16px;
  right: 14px;
  color: var(--text-3);
  transition: all 220ms;
  opacity: 0;
}
.ws-card.has-data:hover .ws-card-arrow {
  color: var(--card-accent);
  transform: translateX(3px);
  opacity: 1;
}

/* ═══ MODAL ═══ */
.ws-modal {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: var(--modal-overlay);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  animation: ws-modal-in 200ms ease-out;
}
@keyframes ws-modal-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
.ws-modal-edit { z-index: 60; backdrop-filter: blur(10px); }

.ws-modal-panel {
  width: 100%;
  max-width: 640px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-surface);
  border: 1px solid var(--border-1);
  border-radius: 20px;
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  animation: ws-panel-in 250ms cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes ws-panel-in {
  from { opacity: 0; transform: scale(0.96) translateY(8px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

.ws-modal-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 20px;
  border-bottom: 1px solid var(--border-1);
  flex-shrink: 0;
}
.ws-modal-head h3 {
  font-size: 15px;
  font-weight: 800;
  color: var(--text-1);
  margin: 0 0 3px;
  letter-spacing: -0.01em;
}
.ws-modal-head p {
  font-size: 11.5px;
  color: var(--text-3);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.ws-modal-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.ws-modal-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 32px;
  padding: 0 12px;
  border-radius: 8px;
  background: var(--bg-muted);
  color: var(--text-2);
  border: 1px solid var(--border-1);
  font-size: 11.5px;
  font-weight: 600;
  transition: all 150ms;
}
.ws-modal-btn:hover { background: var(--border-1); color: var(--text-1); }
.ws-modal-btn-primary {
  background: var(--accent-emerald-bg);
  color: var(--accent-emerald);
  border-color: var(--accent-emerald-border);
}
.ws-modal-btn-primary:hover { background: var(--accent-emerald); color: #fff; border-color: var(--accent-emerald); }
.ws-modal-close {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: transparent;
  color: var(--text-3);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 150ms;
}
.ws-modal-close:hover { background: var(--bg-muted); color: var(--text-1); }

.ws-modal-search {
  position: relative;
  padding: 12px 20px;
  border-bottom: 1px solid var(--border-1);
  flex-shrink: 0;
}
.ws-modal-search svg {
  position: absolute;
  left: 32px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-3);
  pointer-events: none;
}
.ws-modal-search input {
  width: 100%;
  height: 36px;
  padding: 0 12px 0 36px;
  border-radius: 10px;
  background: var(--bg-base);
  border: 1px solid var(--border-1);
  color: var(--text-1);
  font-size: 12.5px;
  outline: none;
  transition: border-color 150ms;
}
.ws-modal-search input::placeholder { color: var(--text-3); }
.ws-modal-search input:focus { border-color: var(--accent-emerald); }

.ws-modal-body { padding: 8px; overflow-y: auto; flex: 1; }

/* Duplikat group */
.ws-dup-group {
  margin: 6px 4px;
  border-radius: 14px;
  background: var(--bg-muted);
  border: 1px solid var(--accent-red-border);
  overflow: hidden;
}
.ws-dup-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--accent-red-bg);
  border-bottom: 1px solid var(--accent-red-border);
  font-size: 11.5px;
  color: var(--accent-red);
}
.ws-dup-key b { color: var(--text-1); font-family: ui-monospace, monospace; }
.ws-dup-count { font-size: 10.5px; opacity: 0.75; font-weight: 600; }
.ws-dup-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-1);
  font-size: 12px;
}
.ws-dup-row:last-child { border-bottom: none; }
.ws-dup-ni { color: var(--text-3); width: 78px; flex-shrink: 0; }
.ws-dup-name { color: var(--text-1); font-weight: 600; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ws-dup-kelas { color: var(--text-2); flex-shrink: 0; font-size: 11px; }

/* Row biasa */
.ws-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  transition: background 120ms;
}
.ws-row:hover { background: var(--bg-muted); }
.ws-row-idx {
  font-size: 11px;
  color: var(--text-3);
  font-variant-numeric: tabular-nums;
  width: 20px;
  font-weight: 600;
}
.ws-row-info { flex: 1; min-width: 0; }
.ws-row-name {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ws-row-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10.5px;
  color: var(--text-3);
  margin-top: 2px;
}
.ws-row-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 28px;
  padding: 0 10px;
  border-radius: 7px;
  background: var(--accent-emerald-bg);
  color: var(--accent-emerald);
  border: 1px solid var(--accent-emerald-border);
  font-size: 11px;
  font-weight: 700;
  transition: all 150ms;
}
.ws-row-btn:hover { background: var(--accent-emerald); color: #fff; border-color: var(--accent-emerald); }

.ws-modal-empty {
  padding: 40px 16px;
  text-align: center;
  color: var(--text-3);
  font-size: 12.5px;
}

/* ═══ EDIT ═══ */
.ws-edit-panel { max-width: 520px; }
.ws-edit-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.ws-field { display: flex; flex-direction: column; gap: 6px; }
.ws-field-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-2);
}
.ws-field-label.is-danger { color: var(--accent-red); }
.ws-field-label.is-primary { color: var(--accent-emerald); }
.ws-field-hint {
  font-size: 10.5px;
  color: var(--accent-amber);
  margin: 0 0 2px;
  padding: 6px 10px;
  background: var(--accent-amber-bg);
  border-left: 2px solid var(--accent-amber);
  border-radius: 4px;
}
.ws-input {
  width: 100%;
  height: 40px;
  padding: 0 12px;
  border-radius: 10px;
  background: var(--bg-base);
  border: 1px solid var(--border-1);
  color: var(--text-1);
  font-size: 13px;
  outline: none;
  transition: all 150ms;
}
.ws-input::placeholder { color: var(--text-3); }
.ws-input:focus { border-color: var(--accent-emerald); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-emerald) 15%, transparent); }
.ws-input.is-danger { border-color: var(--accent-red-border); }
.ws-input.is-danger:focus { border-color: var(--accent-red); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-red) 15%, transparent); }
.ws-input.is-primary { border-color: var(--accent-emerald-border); }
.ws-input.is-primary:focus { border-color: var(--accent-emerald); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-emerald) 15%, transparent); }
.ws-textarea { height: auto; padding: 10px 12px; resize: none; min-height: 60px; line-height: 1.5; }

.ws-edit-foot {
  padding: 14px 20px;
  border-top: 1px solid var(--border-1);
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  flex-shrink: 0;
}

/* ═══ RESPONSIVE ═══ */
@media (max-width: 640px) {
  .ws-modal-head { padding: 14px 16px; flex-direction: column; }
  .ws-modal-actions { width: 100%; justify-content: flex-end; }
  .ws-priority-head { padding: 14px 16px; flex-direction: column; align-items: flex-start; gap: 8px; }
  .ws-priority-count { margin-left: auto; }
  .ws-card-grid { grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); }
  .ws-kpi { padding: 14px; }
  .ws-kpi-val { font-size: 24px; }
  .ws-hero-side { flex-direction: row; align-items: center; justify-content: center; }
  .ws-hero-ring-wrap { width: 110px; height: 110px; }
  .ws-hero-ring-pct { font-size: 22px; }
  .ws-hero-ring-pct span { font-size: 13px; }
}
</style>
