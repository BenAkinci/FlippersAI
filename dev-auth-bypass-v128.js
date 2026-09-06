import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const supabase = createClient(
  'https://msmpigerejpxepkylkxz.supabase.co',
  'sb_publishable_PtTF2JaOtkV86zDg_Vf-bw_Vg0nCSpZ'
)

try {
  const { data } = await supabase.auth.getSession()
  if (!data.session) {
    const { error } = await supabase.auth.signInAnonymously()
    if (error) console.warn('Development auth bypass unavailable:', error.message)
  }
} catch (error) {
  console.warn('Development auth bypass failed:', error)
}
