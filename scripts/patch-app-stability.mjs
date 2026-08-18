import fs from 'node:fs'

const path = 'public/app.js'
let source = fs.readFileSync(path, 'utf8')
const oldBlock = `  supabase.auth.onAuthStateChange((_event, session) => {\n    state.session = session\n    session ? refresh() : renderAuth()\n  })`
const newBlock = `  let lastAuthUserId = state.session?.user?.id || null\n  supabase.auth.onAuthStateChange((event, session) => {\n    const nextUserId = session?.user?.id || null\n    state.session = session\n    if (!session || event === 'SIGNED_OUT') {\n      lastAuthUserId = null\n      renderAuth()\n      return\n    }\n    const userChanged = nextUserId !== lastAuthUserId\n    lastAuthUserId = nextUserId\n    if (userChanged || event === 'USER_UPDATED') refresh()\n  })`
if (!source.includes(oldBlock)) throw new Error('Could not find website auth refresh block to patch')
source = source.replace(oldBlock, newBlock)
fs.writeFileSync(path, source)
console.log('Patched repeated auth/refocus refreshes in public/app.js')
