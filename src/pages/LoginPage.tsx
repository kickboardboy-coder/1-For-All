import { zodResolver } from '@hookform/resolvers/zod'
import { FirebaseError } from 'firebase/app'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import { z } from 'zod'
import { login } from '../api/auth'
import LoginIntro from '../components/LoginIntro'

const loginSchema = z.object({
  email: z.email('이메일 형식으로 입력해 주세요'),
  password: z
    .string()
    .min(1, '비밀번호를 입력해 주세요')
    .min(8, '영문과 숫자를 포함해 8자 이상 입력해 주세요')
    .regex(/[A-Za-z]/, '영문과 숫자를 포함해 8자 이상 입력해 주세요')
    .regex(/\d/, '영문과 숫자를 포함해 8자 이상 입력해 주세요'),
})

type LoginForm = z.infer<typeof loginSchema>

function getLoginErrorMessage(error: unknown) {
  if (error instanceof FirebaseError && error.code === 'auth/network-request-failed') {
    return '서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.'
  }

  if (
    error instanceof FirebaseError &&
    (error.code === 'auth/invalid-credential' ||
      error.code === 'auth/user-not-found' ||
      error.code === 'auth/wrong-password' ||
      error.code === 'auth/invalid-email')
  ) {
    return '이메일 또는 비밀번호가 올바르지 않습니다.'
  }

  return '로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.'
}

function LoginPage() {
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  async function onSubmit(values: LoginForm) {
    clearErrors('root')

    try {
      await login(values)
      navigate('/plans', { replace: true })
    } catch (error) {
      setError('root', { message: getLoginErrorMessage(error) })
    }
  }

  return (
    <section className="login-panel">
      <LoginIntro />
      <div className="login-card">
      <h1>다시 만나 반가워요!</h1>
      <p className="login-lead">로그인하고 나만의 여행을 이어가세요.</p>
      <form className="login-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <label className="login-field">
          <span>이메일</span>
          <input
            type="email"
            placeholder="이메일 주소를 입력해 주세요"
            autoComplete="email"
            {...register('email')}
          />
          {errors.email && <p className="login-error">{errors.email.message}</p>}
        </label>
        <label className="login-field">
          <span>비밀번호</span>
          <span className="login-password">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="비밀번호를 입력해 주세요"
              autoComplete="current-password"
              {...register('password')}
            />
            <button
              type="button"
              className="login-password-toggle"
              aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 표시'}
              onClick={() => setShowPassword((current) => !current)}
            >
              {showPassword ? '숨김' : '표시'}
            </button>
          </span>
          {errors.password && <p className="login-error">{errors.password.message}</p>}
        </label>
        <button type="button" className="login-forgot">
          비밀번호를 잊으셨나요?
        </button>
        {errors.root && (
          <p className="login-error login-form-error" role="alert">
            {errors.root.message}
          </p>
        )}
        <button type="submit" className="login-submit" disabled={isSubmitting}>
          로그인
        </button>
      </form>
      <p className="login-signup">
        의쉬행이 처음이신가요? <Link to="/signup">회원가입</Link>
      </p>
      </div>
    </section>
  )
}

export default LoginPage
