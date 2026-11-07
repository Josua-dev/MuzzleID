import { useEffect } from 'react';
import { match, navigate, useRoute } from './lib/router';
import { useSession } from './hooks/useSession';
import { AppShell } from './components/layout/AppShell';
import { Toaster } from './components/ui/primitives';
import Landing from './pages/Landing';
import SignIn from './pages/auth/SignIn';
import SignUp from './pages/auth/SignUp';
import ForgotPassword from './pages/auth/ForgotPassword';
import FarmerDashboard from './pages/farmer/Dashboard';
import { VetHome, VerifierHome } from './pages/RoleHomes';
import AdminDashboard from './pages/admin/AdminDashboard';
import RegisterAnimal from './pages/RegisterAnimal';
import Scan from './pages/Scan';
import { VerifyBySms } from './pages/VerifyBySms';
import Livestock from './pages/Livestock';
import AnimalProfile from './pages/AnimalProfile';
import AddHealthRecord from './pages/AddHealthRecord';
import ReportMissing from './pages/ReportMissing';
import Transfer from './pages/Transfer';
import Alerts from './pages/Alerts';
import Profile from './pages/Profile';
import { can } from './lib/permissions';

function Redirect({ to }: { to: string }) {
  useEffect(() => { navigate(to, true); }, [to]);
  return null;
}

function AppRoutes({ path }: { path: string }) {
  const { user } = useSession();
  if (!user) return <Redirect to="/signin" />;
  const role = user.role;
  let p: Record<string, string> | null;

  if (path === '/app') {
    if (role === 'ADMIN') return <AppShell wide><AdminDashboard /></AppShell>;
    return <AppShell>{role === 'FARMER' ? <FarmerDashboard /> : role === 'VET' ? <VetHome /> : <VerifierHome />}</AppShell>;
  }
  if (path === '/app/scan') return <AppShell><Scan /></AppShell>;
  if (path === '/app/sms') return <AppShell><VerifyBySms /></AppShell>;
  if (path === '/app/cattle') return <AppShell wide={role === 'ADMIN'}><Livestock /></AppShell>;
  if (path === '/app/register') return can.registerAnimal(role) ? <AppShell><RegisterAnimal /></AppShell> : <Redirect to="/app" />;
  if (path === '/app/report') return can.reportTheft(role) ? <AppShell><ReportMissing /></AppShell> : <Redirect to="/app" />;
  if (path === '/app/transfer') return can.transfer(role) ? <AppShell><Transfer /></AppShell> : <Redirect to="/app" />;
  if (path === '/app/alerts') return <AppShell><Alerts /></AppShell>;
  if (path === '/app/profile') return <AppShell><Profile /></AppShell>;
  if ((p = match('/app/animal/:id/health', path))) return <AppShell><AddHealthRecord id={p.id} /></AppShell>;
  if ((p = match('/app/animal/:id', path))) return <AppShell><AnimalProfile key={p.id} id={p.id} /></AppShell>;
  return <Redirect to="/app" />;
}

export default function App() {
  const { path } = useRoute();
  const { user } = useSession();
  let page;
  if (path === '/') page = <Landing />;
  else if (path === '/signin') page = user ? <Redirect to="/app" /> : <SignIn />;
  else if (path === '/signup') page = user ? <Redirect to="/app" /> : <SignUp />;
  else if (path === '/forgot') page = <ForgotPassword />;
  else if (path.startsWith('/app')) page = <AppRoutes path={path} />;
  else page = <Redirect to="/" />;
  return (<>{page}<Toaster /></>);
}
