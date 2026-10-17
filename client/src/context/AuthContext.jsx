import { useState, useCallback } from 'react';
import { AuthContext } from './authContext';
import * as endpoints from '../api/endpoints';


// AuthResponse doesn't carry orgId/accountId, but every org- and customer-scoped
// route needs it, and the JWT payload already has it (see JwtUtil#generateToken).
// Decoding client-side avoids trusting anything the user could tamper with — the
// server still re-derives scope from the verified token on every request.
function decodeTokenClaims(token) {
  try {
    const payload = token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decodeURIComponent(escape(json)));
  } catch {
    return {};
  }
}

function readStoredUser() {
  try {
    const raw = localStorage.getItem('clearar_user');
    if (!raw) return null;
    const u = JSON.parse(raw);
    const resolvedId = u.userId ?? u.id ?? null;
    if (resolvedId != null) {
      u.id = resolvedId;
      u.userId = resolvedId;
    }
    return u;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser());

  const applySession = useCallback((data) => {
    // AuthResponse: { accessToken, role, userId, name, orgName, accountName }
    localStorage.setItem('clearar_token', data.accessToken);
    const claims = decodeTokenClaims(data.accessToken);
    const resolvedId = data.userId ?? claims.userId ?? claims.id ?? null;
    const stored = {
      id: resolvedId,
      userId: resolvedId,
      role: data.role,
      name: data.name,
      orgId: claims.orgId ?? null,
      accountId: claims.accountId ?? null,
      orgName: data.orgName ?? claims.orgName ?? (claims.orgId ? `Demo Collections Org` : null),
      accountName: data.accountName ?? claims.accountName ?? null,
    };
    localStorage.setItem('clearar_user', JSON.stringify(stored));
    setUser(stored);
    return stored;
  }, []);

  const doLogin = useCallback(
    async (email, password) => {
      const { data } = await endpoints.login(email, password);
      return applySession(data);
    },
    [applySession]
  );

  const doSignup = useCallback(
    async (payload) => {
      const { data } = await endpoints.signup(payload);
      return applySession(data);
    },
    [applySession]
  );

  const logout = useCallback(() => {
    localStorage.removeItem('clearar_token');
    localStorage.removeItem('clearar_user');
    // Clear splash guard so the animation fires again on next login/signup
    sessionStorage.removeItem('clearar_splash_shown');
    setUser(null);
  }, []);


  const updateUserName = useCallback((name) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, name };
      localStorage.setItem('clearar_user', JSON.stringify(updated));
      return updated;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, login: doLogin, signup: doSignup, logout, updateUserName }}>
      {children}
    </AuthContext.Provider>
  );
}
