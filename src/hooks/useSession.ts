import { useDB, useUI } from '../services/store';
import { farmerProfile, getUser } from '../services/queries';

export function useSession() {
  const ui = useUI();
  const user = useDB((d) => getUser(d, ui.sessionUserId));
  const profile = useDB((d) => farmerProfile(d, ui.sessionUserId));
  return { user, profile };
}
