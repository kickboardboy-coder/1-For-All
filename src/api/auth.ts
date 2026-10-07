import api from './client'

type LoginRequest = {
  email: string
  password: string
}

type LoginResponse = {
  accessToken: string
}

export async function login({ email, password }: LoginRequest) {
  const { data } = await api.post<LoginResponse>('/auth/login', {
    email,
    password,
  })

  return data
}

type SignUpRequest = {
  email: string
  password: string
}

export async function signUp({ email, password }: SignUpRequest) {
  const { data } = await api.post('/auth/signup', {
    email,
    password,
  })

  return data
}
