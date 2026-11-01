import { useRouter } from 'expo-router';
import { Welcome } from '../lib/features/welcome/components/Welcome';

/** Abertura de quem não está logado; o formulário fica em /login. */
export default function WelcomeScreen() {
  const router = useRouter();
  return (
    <Welcome onEmail={() => router.push('/login')} />
  );
}
