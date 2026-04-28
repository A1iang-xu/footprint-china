import { createClient } from '@supabase/supabase-js'

// 替换为你刚才在后台看到的真实 URL 和 Key
const supabaseUrl = 'https://pgbxyayryrynqrwlsoce.supabase.co'
const supabaseKey = 'sb_publishable_WAzTgU6r5VLiiPkSTlBOvw_TIjuyfkX'

export const supabase = createClient(supabaseUrl, supabaseKey)