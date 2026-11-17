import { ref } from 'vue'
import { supabase } from '../lib/supabase'

// Menyimpan data user secara global
export const userSesi = ref(null)
export const isLoadingAuth = ref(true)

// Fungsi mengecek sesi saat aplikasi dimuat
export const cekSesi = async () => {
  const { data: { session } } = await supabase.auth.getSession()
  userSesi.value = session ? session.user : null
  isLoadingAuth.value = false
  
  // Pantau perubahan login/logout secara real-time
  supabase.auth.onAuthStateChange((_event, session) => {
    userSesi.value = session ? session.user : null
  })
}

export const logout = async () => {
  await supabase.auth.signOut()
  userSesi.value = null
}