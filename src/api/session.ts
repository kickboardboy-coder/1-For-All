import { auth } from '../firebase'

export function requireUser() {
  const user = auth.currentUser

  if (!user) {
    throw new Error('로그인된 사용자가 없습니다.')
  }

  return user
}
