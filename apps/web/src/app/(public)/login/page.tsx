import type { Metadata } from 'next';
import { ArrowUpRight, Layers3, ShieldCheck } from 'lucide-react';
import { LoginForm } from '@/features/auth/login-form';
export const metadata: Metadata = { title: 'Entrar' };
export default function LoginPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-sidebar p-12 text-sidebar-foreground lg:flex xl:p-16">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex size-9 items-center justify-center rounded-md bg-primary text-xl font-bold text-primary-foreground"
          >
            c
          </span>
          <span className="text-2xl font-semibold text-surface">
            crm<span className="text-primary">.</span>
          </span>
        </div>
        <div className="max-w-lg">
          <p className="mb-5 text-caption font-medium uppercase tracking-widest text-primary">
            Pessoas. Relações. Possibilidades.
          </p>
          <p className="text-4xl font-medium leading-tight tracking-tight text-surface xl:text-5xl">
            Boas relações.
            <br />
            Novos caminhos.
          </p>
          <p className="mt-6 max-w-sm text-base leading-relaxed">
            Um espaço para aproximar sua equipe, organizar seu trabalho e construir o próximo passo.
          </p>
          <div className="mt-12 grid grid-cols-2 gap-6 border-t border-sidebar-hover pt-6">
            <div>
              <Layers3 aria-hidden="true" className="mb-3 size-5 text-primary" />
              <p className="text-body text-surface">Sua equipe conectada</p>
              <p className="mt-1 text-caption">Uma base para trabalhar juntos.</p>
            </div>
            <div>
              <ShieldCheck aria-hidden="true" className="mb-3 size-5 text-primary" />
              <p className="text-body text-surface">Cada empresa, seu espaço</p>
              <p className="mt-1 text-caption">Contexto claro para cada operação.</p>
            </div>
          </div>
        </div>
        <p className="flex items-center gap-2 text-caption">
          Seu próximo passo começa aqui.
          <ArrowUpRight aria-hidden="true" className="size-3" />
        </p>
      </section>
      <section className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="mb-10 flex items-center gap-2 lg:hidden">
            <span className="flex size-8 items-center justify-center rounded-md bg-primary font-bold">
              c
            </span>
            <span className="text-xl font-semibold">crm.</span>
          </div>
          <p className="mb-3 text-caption font-medium uppercase tracking-widest text-muted">
            Seu espaço de trabalho
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Bom ter você por aqui.</h1>
          <p className="mb-8 mt-3 text-body text-muted">Entre para continuar de onde você parou.</p>
          <LoginForm />
          <p className="mt-10 border-t pt-6 text-caption text-muted">
            Acesso seguro ao ambiente da sua organização.
          </p>
        </div>
      </section>
    </main>
  );
}
