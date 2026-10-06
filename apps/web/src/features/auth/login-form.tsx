'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema } from '@crm/contracts';
import type { Login } from '@crm/contracts';
import { Alert, Button, FormField, Input } from '@crm/ui';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useAuth } from './auth-provider';
import { errorMessage } from '@/lib/api-client';
export function LoginForm() {
  const { state, session } = useAuth();
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Login>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });
  useEffect(() => {
    if (state.status === 'authenticated') router.replace('/dashboard');
  }, [state.status, router]);
  const submit = async (input: Login) => {
    setMessage(null);
    try {
      await session.login(input);
    } catch (error) {
      setMessage(errorMessage(error, true));
    }
  };
  return (
    <form
      onSubmit={(event) => {
        void handleSubmit(submit)(event);
      }}
      noValidate
      className="space-y-5"
    >
      {(message || (state.error && state.status === 'error')) && (
        <Alert>{message ?? errorMessage(state.error)}</Alert>
      )}
      <FormField
        id="email"
        label="E-mail"
        required
        error={errors.email ? 'Informe um e-mail válido.' : undefined}
      >
        <Input
          id="email"
          type="email"
          autoComplete="username"
          placeholder="voce@empresa.com"
          required
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? 'email-error' : undefined}
          {...register('email')}
        />
      </FormField>
      <FormField
        id="password"
        label="Senha"
        required
        error={errors.password ? 'Informe sua senha.' : undefined}
      >
        <div className="relative">
          <Input
            id="password"
            type={visible ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Sua senha"
            required
            className="pr-12"
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'password-error' : undefined}
            {...register('password')}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
            aria-pressed={visible}
            className="absolute right-1 top-0.5 text-muted"
            onClick={() => setVisible(!visible)}
          >
            {visible ? <EyeOff /> : <Eye />}
          </Button>
        </div>
      </FormField>
      <Button
        type="submit"
        size="lg"
        loading={isSubmitting}
        disabled={state.status === 'loading'}
        className="w-full"
      >
        {isSubmitting ? 'Entrando' : 'Entrar no seu espaço'}
        {!isSubmitting && <ArrowRight aria-hidden="true" />}
      </Button>
      <p className="text-center text-caption text-muted">
        Precisa de acesso? Fale com o administrador da sua empresa.
      </p>
    </form>
  );
}
