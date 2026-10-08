import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { auth } from '../firebase'

type EmailPassword = {
  email: string
  password: string
}

export async function login({ email, password }: EmailPassword) {
  const credential = await signInWithEmailAndPassword(auth, email, password)
  return credential.user
}

export async function signUp({ email, password }: EmailPassword) {
  await createUserWithEmailAndPassword(auth, email, password)
  await signOut(auth)
}

export async function logout() {
  await signOut(auth)
}
