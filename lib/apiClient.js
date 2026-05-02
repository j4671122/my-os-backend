import useStore from '@/store/useStore'

async function request(method, path, body) {
  const token = useStore.getState().token
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const opts = { method, headers }
  if (body !== undefined) opts.body = JSON.stringify(body)
  const res = await fetch(path, opts)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `API ${res.status}`)
  }
  return res.json()
}

export const api = {
  get:   (path)        => request('GET',    path),
  post:  (path, body)  => request('POST',   path, body),
  put:   (path, body)  => request('PUT',    path, body),
  patch: (path, body)  => request('PATCH',  path, body),
  del:   (path)        => request('DELETE', path),
}
