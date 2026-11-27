import { useState } from 'react';
import { Forgot } from '../features/auth/Forgot';
import { LogIn } from '../features/auth/LogIn';
import { SignUp } from '../features/auth/SignUp';
import { Welcome } from '../features/auth/Welcome';
import { Home } from '../features/dashboard/Home';
import { BottomNav } from '../features/shell/BottomNav';
import { MeScreen, Placeholder } from '../features/shell/Placeholder';
import { Toast } from '../components/Toast';
import { Splash } from '../features/shell/Splash';
import { useApp } from './app-state';
import { useNav } from './nav';

const WITH_NAV = new Set(['home', 'chamas', 'goals', 'me']);

export function App() {
  const { t, user } = useApp();
  const nav = useNav();
  const [invite, setInvite] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  // The intro plays once each time the app is opened (not on every screen change).
  const [intro, setIntro] = useState(() => {
    try { return sessionStorage.getItem('chamaa-intro') !== '1'; } catch { return true; }
  });

  // Signed-out people can only see the sign-in screens, and signed-in people skip them.
  const authRoutes = ['welcome', 'signup', 'login', 'forgot'];
  let r = nav.route;
  if (!user && !authRoutes.includes(r)) r = 'welcome';
  if (user && authRoutes.includes(r)) r = 'home';

  let screen;
  switch (r) {
    case 'welcome': screen = <Welcome onInvite={() => { setInvite(true); nav.go('signup'); }} />; break;
    case 'signup': screen = <SignUp withInvite={invite} onDone={(e) => { setLoginEmail(e); setInvite(false); nav.go('login'); }} />; break;
    case 'login': screen = <LogIn prefillEmail={loginEmail} />; break;
    case 'forgot': screen = <Forgot />; break;
    case 'home': screen = <Home />; break;
    case 'me': screen = <MeScreen />; break;
    case 'chamas': screen = <Placeholder title={t.nav[1]} />; break;
    case 'goals': screen = <Placeholder title={t.nav[2]} />; break;
    case 'pay': screen = <Placeholder title={t.qa[0]} />; break;
    case 'invite': screen = <Placeholder title={t.qa[2]} />; break;
    case 'stmt': screen = <Placeholder title={t.qa[3]} />; break;
  }

  return (
    <div className="app">
      {screen}
      {user && WITH_NAV.has(r) ? <BottomNav /> : null}
      <Toast />
      {intro ? <Splash onDone={() => { try { sessionStorage.setItem('chamaa-intro', '1'); } catch { /* ignore */ } setIntro(false); }} /> : null}
    </div>
  );
}
