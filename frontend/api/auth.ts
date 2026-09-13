import { apiRequest } from './client';
import type { BootstrapData, User } from '../types/domain';

export const getBootstrap = () => apiRequest<BootstrapData>('/bootstrap');

export const login = (email: string, password: string) =>
  apiRequest<{ user: User; expiresAt: string }>('/auth/login', {
    method: 'POST',
    body: { email, password },
  });

export const logout = () =>
  apiRequest<{ ok: boolean }>('/auth/logout', { method: 'POST', body: {} });
