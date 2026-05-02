import { createClient } from '@supabase/supabase-js'

let _client = null

const supabase = new Proxy({}, {
  get(_, prop) {
    if (!_client) {
      _client = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
      )
    }
    const val = _client[prop]
    return typeof val === 'function' ? val.bind(_client) : val
  }
})

export default supabase
