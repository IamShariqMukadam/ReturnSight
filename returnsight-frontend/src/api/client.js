import axios from 'axios'

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const client = axios.create({
  baseURL,
  timeout: 8000,
  headers: { 'Content-Type': 'application/json' },
})

// Retry once on 503
client.interceptors.response.use(
  (res) => res,
  async (err) => {
    const config = err.config
    if (err.response?.status === 503 && !config._retried) {
      config._retried = true
      await new Promise(r => setTimeout(r, 1000))
      return client(config)
    }
    return Promise.reject(err)
  }
)

export default client
