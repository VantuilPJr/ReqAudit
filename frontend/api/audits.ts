import { apiRequest } from './client';
import type { Audit } from '../types/domain';

export function uploadAuditAttachment(auditId: number, file: File) {
  const body = new FormData();
  body.append('file', file);
  return apiRequest<Audit>(`/audits/${auditId}/attachment`, {
    method: 'POST',
    body,
  });
}

export const deleteAuditAttachment = (auditId: number) =>
  apiRequest<{ ok: boolean }>(`/audits/${auditId}/attachment`, {
    method: 'DELETE',
  });
