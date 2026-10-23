import { zodResolver } from '@hookform/resolvers/zod';
import { FirebaseError } from 'firebase/app';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import { z } from 'zod';
import { login, sendPasswordReset } from '../api/auth';
import LoginIntro from '../components/LoginIntro';

const loginSchema = z.object({
  email: z.email('이메일 형식으로 입력해 주세요'),
  password: z
    .string()
    .min(1, '비밀번호를 입력해 주세요')
    .min(8, '영문과 숫자를 포함해 8자 이상 입력해 주세요')
    .regex(/[A-Za-z]/, '영문과 숫자를 포함해 8자 이상 입력해 주세요')
    .regex(/\d/, '영문과 숫자를 포함해 8자 이상 입력해 주세요'),
});

type LoginForm = z.infer<typeof loginSchema>;

function getResetErrorMessage(error: unknown) {
  if (error instanceof FirebaseError && error.code === 'auth/network-request-failed') {
    return '서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.';
  }

  if (error instanceof FirebaseError && error.code === 'auth/too-many-requests') {
    return '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.';
  }

  if (error instanceof FirebaseError && error.code === 'auth/invalid-email') {
    return '이메일 형식으로 입력해 주세요';
  }

  return '재설정 메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.';
}

function getLoginErrorMessage(error: unknown) {
  if (error instanceof FirebaseError && error.code === 'auth/network-request-failed') {
    return '서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.';
  }

  if (
    error instanceof FirebaseError &&
    (error.code === 'auth/invalid-credential' ||
      error.code === 'auth/user-not-found' ||
      error.code === 'auth/wrong-password' ||
      error.code === 'auth/invalid-email')
  ) {
    return '이메일 또는 비밀번호가 올바르지 않습니다.';
  }

  return '로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.';
}

function LoginPage() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [resetNote, setResetNote] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    getValues,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });
  const [isResetting, setIsResetting] = useState(false);

  async function onForgotPassword() {
    const parsed = z.email('이메일 형식으로 입력해 주세요').safeParse(getValues('email'));

    if (!parsed.success) {
      setResetNote(null);
      setError('email', { message: '이메일 형식으로 입력해 주세요' });
      return;
    }

    clearErrors('email');
    clearErrors('root');
    setResetNote(null);
    setIsResetting(true);

    try {
      await sendPasswordReset(parsed.data);
      setResetNote('비밀번호 재설정 메일을 보냈어요. 메일함을 확인해 주세요.');
    } catch (error) {
      setError('root', { message: getResetErrorMessage(error) });
    } finally {
      setIsResetting(false);
    }
  }

  async function onSubmit(values: LoginForm) {
    clearErrors('root');
    setResetNote(null);

    try {
      await login(values);
      navigate('/plans', { replace: true });
    } catch (error) {
      setError('root', { message: getLoginErrorMessage(error) });
    }
  }

  return (
    <section className="login-panel">
      <LoginIntro />
      <div className="login-card">
        <h1>다시 만나 반가워요!</h1>
        <p className="login-lead">로그인하고 나만의 여행을 이어가세요.</p>
        <form className="login-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="login-field">
            <label htmlFor="login-email">이메일</label>
            <input
              id="login-email"
              type="email"
              placeholder="이메일 주소를 입력해 주세요"
              autoComplete="email"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'login-email-error' : undefined}
              {...register('email')}
            />
            {errors.email && (
              <p id="login-email-error" className="login-error" role="alert">
                {errors.email.message}
              </p>
            )}
          </div>
          <div className="login-field">
            <label htmlFor="login-password">비밀번호</label>
            <span className="login-password">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="비밀번호를 입력해 주세요"
                autoComplete="current-password"
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? 'login-password-error' : undefined}
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
            {errors.password && (
              <p id="login-password-error" className="login-error" role="alert">
                {errors.password.message}
              </p>
            )}
          </div>
          <button type="button" className="login-forgot" onClick={() => void onForgotPassword()} disabled={isResetting}>
            비밀번호를 잊으셨나요?
          </button>
          {resetNote && (
            <p className="login-reset-note" role="status">
              {resetNote}
            </p>
          )}
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
  );
}

export default LoginPage;
