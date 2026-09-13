import { apiRequest } from './client';
import type { EmailSettings } from '../types/domain';

export const getEmailSettings = () =>
  apiRequest<EmailSettings>('/admin/settings');

export const updateEmailSettings = (settings: EmailSettings) =>
  apiRequest<EmailSettings>('/admin/settings', {
    method: 'PUT',
    body: settings,
  });

export const sendTestEmail = () =>
  apiRequest<{ sent: boolean; to: string }>('/admin/settings/test-email', {
    method: 'POST',
  });
