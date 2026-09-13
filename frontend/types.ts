export interface AuditStats {
  total: number;
  conforming: number;
  nonConforming: number;
  pending: number;
  adherence: number | null;
}

export interface Dashboard {
  audits: number;
  finished: number;
  inProgress: number;
  averageAdherence: number | null;
  openNCs: number;
  overdueNCs: number;
  resolvedNCs: number;
}

/** Shared shape for the API's records and editable form drafts. */
export interface Row {
  [field: string]: unknown;
  id?: number;
  code?: string;
  title?: string;
  description?: string;
  actor?: string;
  priority?: string;
  origin?: string;
  name?: string;
  role?: string;
  userName?: string;
  requirementId?: number | string;
  requirementCode?: string;
  requirementTitle?: string;
  sourceType?: string;
  targetCode?: string;
  targetTitle?: string;
  documentType?: string;
  documentTitle?: string;
  documentCode?: string;
  documentVersion?: string;
  documentReference?: string;
  documentScope?: string;
  auditorId?: number | string;
  auditorName?: string;
  auditId?: number;
  checklistItemId?: number;
  result?: string;
  observation?: string;
  itemDescription?: string;
  severity?: string;
  responsibleId?: number | string;
  responsibleName?: string;
  status?: string;
  dueDate?: string;
  escalationLevel?: number;
  daysLate?: number;
  overdue?: boolean;
  correction?: string;
  reason?: string;
  createdAt?: string;
  finishedAt?: string;
  readAt?: string;
  nonConformityId?: number;
  action?: string;
  message?: string;
  recipient?: string;
  subject?: string;
  body?: string;
  error?: string;
  type?: string;
  updated?: number;
  requirementSnapshot?: Record<string, string | number>;
  documentSnapshot?: Record<string, string | number>;
  stats?: AuditStats;
  dashboard?: Dashboard;
  currentUser?: Row;
  emailMode?: string;
  answers?: Row[];
  history?: Row[];
  users?: Row[];
  requirements?: Row[];
  audits?: Row[];
  nonConformities?: Row[];
  notifications?: Row[];
  outbox?: Row[];
}
