export function defaultRouteFor(role) {
  if (role === 'customer') return '/portal';
  if (role === 'platform_admin') return '/platform-admin';
  if (role === 'manager') return '/dashboard';
  return '/worklist';
}

