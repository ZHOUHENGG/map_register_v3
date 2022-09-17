import axios from 'axios'
import { get_user_token } from './auth'

const service = axios.create({
  baseURL: import.meta.env.VITE_API_BASE,
  timeout: 2000,
})

service.interceptors.request.use(
  (config) => {
    config.validateStatus = (status) => {
      return status === 400 || (status >= 200 && status < 300)
    }

    // todo: append
    if (!config.headers) {
      config.headers = {}
    }
    const token = get_user_token()
    if (token) config.headers['Authorization'] = `Bearer ${token}`
    config.headers['Content-Type'] = 'application/json'

    return config
  },
  (error) => {
    // Do something with request error
    console.error(error) // for debug
    Promise.reject(error)
  },
)

service.interceptors.response.use(
  (response) => {
    // todo: response handler
    return response.data
  },
  (error) => {
    // todo: response handler
    return Promise.reject(error)
  },
)

export { service }
