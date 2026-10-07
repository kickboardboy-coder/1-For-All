import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { auth } from '../firebase'

type LoginRequest = {
  email: string
  password: string
}

export async function login({ email, password }: LoginRequest) {
  const credential = await signInWithEmailAndPassword(auth, email, password)
  return credential.user
}

type SignUpRequest = {
  email: string
  password: string
}

export async function signUp({ email, password }: SignUpRequest) {
  await createUserWithEmailAndPassword(auth, email, password)
  await signOut(auth)
}

export async function refreshAccessToken() {
  const user = auth.currentUser

  if (!user) {
    throw new Error('로그인된 사용자가 없습니다.')
  }

  return user.getIdToken(true)
}
