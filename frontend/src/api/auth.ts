import client from './client';
import type { TokenResponse, AuthUser } from '../types';

export const authApi = {
  login: (username: string, password: string) =>
    client.post<TokenResponse>('/auth/login', { username, password }).then(r => r.data),

  logout: () => client.post('/auth/logout'),

  me: () => client.get<AuthUser>('/auth/me').then(r => r.data),

  refresh: (refresh_token: string) =>
    client.post<TokenResponse>('/auth/refresh', { refresh_token }).then(r => r.data),
};
