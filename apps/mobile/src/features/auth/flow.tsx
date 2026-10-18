import { createContext, useContext, useState, type ReactNode } from 'react';

export type AuthMode = 'login' | 'signUp';

interface AuthFlow {
  mode: AuthMode;
  setMode: (mode: AuthMode) => void;
  /** Email já validado na primeira etapa; vazio até lá. */
  email: string;
  setEmail: (email: string) => void;
  /** Primeiro nome da conta encontrada pelo email, para o "Bem-vindo de volta". */
  firstName: string | null;
  setFirstName: (name: string | null) => void;
}

const Context = createContext<AuthFlow | null>(null);

/** Estado do fluxo de entrar/criar conta, compartilhado entre as etapas de /login. */
export function AuthFlowProvider({ children }: { children: ReactNode }) {
  // Quem decide é a etapa do email: conta existente entra, email novo cria conta.
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState<string | null>(null);
  return <Context value={{ mode, setMode, email, setEmail, firstName, setFirstName }}>{children}</Context>;
}

export function useAuthFlow(): AuthFlow {
  const flow = useContext(Context);
  if (!flow) throw new Error('useAuthFlow fora do AuthFlowProvider (app/login/_layout.tsx)');
  return flow;
}
