import { auth } from '../firebase.js'
import { WORKER_API_URL } from '../config/constants.js'

export async function callWorkerApi(path, options = {}) {
  const user = auth?.currentUser
  const token = user ? await user.getIdToken() : null

  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  }

  const response = await fetch(`${WORKER_API_URL}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data?.error || `Request failed (${response.status})`)
    }
    return data
  }

  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`)
  }
  return response
}
