import { zodResolver } from '@hookform/resolvers/zod'
import { FirebaseError } from 'firebase/app'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import { z } from 'zod'
import { signUp } from '../api/auth'
import arrowRight from '../assets/arrow-right.svg'
import eyeOff from '../assets/eye-off.svg'
import LoginIntro from '../components/LoginIntro'

const signUpSchema = z
  .object({
    email: z.email('이메일 형식으로 입력해 주세요'),
    password: z
      .string()
      .min(1, '비밀번호를 입력해 주세요')
      .min(8, '영문, 숫자를 포함해 8자 이상 입력해 주세요.')
      .regex(/[A-Za-z]/, '영문, 숫자를 포함해 8자 이상 입력해 주세요.')
      .regex(/\d/, '영문, 숫자를 포함해 8자 이상 입력해 주세요.'),
    passwordConfirm: z.string().min(1, '비밀번호를 한 번 더 입력해 주세요'),
    agreed: z.boolean(),
  })
  .refine((values) => values.password === values.passwordConfirm, {
    path: ['passwordConfirm'],
    message: '비밀번호가 일치하지 않습니다.',
  })
  .refine((values) => values.agreed, {
    path: ['agreed'],
    message: '이용약관 및 개인정보 수집·이용에 동의해 주세요.',
  })

type SignUpForm = z.infer<typeof signUpSchema>

function getSignUpErrorMessage(error: unknown) {
  if (error instanceof FirebaseError && error.code === 'auth/network-request-failed') {
    return '서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.'
  }

  if (error instanceof FirebaseError && error.code === 'auth/email-already-in-use') {
    return '이미 가입된 이메일입니다.'
  }

  return '회원가입에 실패했습니다. 잠시 후 다시 시도해 주세요.'
}

function SignUpPage() {
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false)
  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<SignUpForm>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { agreed: false },
  })

  async function onSubmit(values: SignUpForm) {
    clearErrors('root')

    try {
      await signUp({ email: values.email, password: values.password })
      navigate('/login', { replace: true })
    } catch (error) {
      setError('root', { message: getSignUpErrorMessage(error) })
    }
  }

  return (
    <section className="login-panel">
      <LoginIntro
        title={
          <>
            처음 떠나는 여행도,
            <br />
            의외로 쉽게.
          </>
        }
      />
      <div className="login-card">
        <h1>쉬운 여행, 함께 시작해요</h1>
        <p className="login-lead">이메일과 비밀번호만 있으면 준비 끝이에요.</p>
        <form className="login-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="login-field">
            <label htmlFor="signup-email">이메일</label>
            <input
              id="signup-email"
              type="email"
              placeholder="이메일 주소를 입력해 주세요"
              autoComplete="email"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'signup-email-error' : undefined}
              {...register('email')}
            />
            {errors.email && (
              <p id="signup-email-error" className="login-error" role="alert">
                {errors.email.message}
              </p>
            )}
          </div>
          <div className="login-field">
            <label htmlFor="signup-password">비밀번호</label>
            <span className="login-password">
              <input
                id="signup-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="비밀번호를 만들어 주세요"
                autoComplete="new-password"
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? 'signup-password-error signup-password-hint' : 'signup-password-hint'}
                {...register('password')}
              />
              <button
                type="button"
                className="login-password-toggle"
                aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 표시'}
                onClick={() => setShowPassword((current) => !current)}
              >
                <img src={eyeOff} alt="" />
              </button>
            </span>
            <p id="signup-password-hint" className="signup-hint">
              영문, 숫자를 포함해 8자 이상 입력해 주세요.
            </p>
            {errors.password && (
              <p id="signup-password-error" className="login-error" role="alert">
                {errors.password.message}
              </p>
            )}
          </div>
          <div className="login-field">
            <label htmlFor="signup-password-confirm">비밀번호 확인</label>
            <span className="login-password">
              <input
                id="signup-password-confirm"
                type={showPasswordConfirm ? 'text' : 'password'}
                placeholder="비밀번호를 한 번 더 입력해 주세요"
                autoComplete="new-password"
                aria-invalid={Boolean(errors.passwordConfirm)}
                aria-describedby={errors.passwordConfirm ? 'signup-password-confirm-error' : undefined}
                {...register('passwordConfirm')}
              />
              <button
                type="button"
                className="login-password-toggle"
                aria-label={showPasswordConfirm ? '비밀번호 숨기기' : '비밀번호 표시'}
                onClick={() => setShowPasswordConfirm((current) => !current)}
              >
                <img src={eyeOff} alt="" />
              </button>
            </span>
            {errors.passwordConfirm && (
              <p id="signup-password-confirm-error" className="login-error" role="alert">
                {errors.passwordConfirm.message}
              </p>
            )}
          </div>
          <label className="signup-agree">
            <input
              type="checkbox"
              aria-invalid={Boolean(errors.agreed)}
              aria-describedby={errors.agreed ? 'signup-agreed-error' : undefined}
              {...register('agreed')}
            />
            <span>
              <Link className="signup-agree-link" to="/terms">
                이용약관
              </Link>{' '}
              및{' '}
              <Link className="signup-agree-link" to="/privacy">
                개인정보 수집·이용
              </Link>
              에 동의해요. (필수)
            </span>
          </label>
          {errors.agreed && (
            <p id="signup-agreed-error" className="login-error" role="alert">
              {errors.agreed.message}
            </p>
          )}
          {errors.root && (
            <p className="login-error login-form-error" role="alert">
              {errors.root.message}
            </p>
          )}
          <button type="submit" className="login-submit" disabled={isSubmitting}>
            회원가입
          </button>
        </form>
        <p className="login-signup signup-login">
          이미 의쉬행 회원이신가요?{' '}
          <Link to="/login">
            로그인 <img src={arrowRight} alt="" />
          </Link>
        </p>
      </div>
    </section>
  )
}

export default SignUpPage
