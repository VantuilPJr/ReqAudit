export type UserRole = 'ADMIN' | 'AUDITOR' | 'RESPONSAVEL' | 'GESTOR';
export type AuditStatus = 'EM_ANDAMENTO' | 'FINALIZADA';
export type AuditResult = 'CONFORME' | 'NAO_CONFORME';
export type NonConformityStatus =
  | 'ABERTA'
  | 'EM_TRATAMENTO'
  | 'RESOLVIDA'
  | 'ESCALONADA';
export type Severity = 'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA';
export type AuditSource = 'REQUISITO' | 'DOCUMENTO';
export type DocumentType = 'PDF' | 'IMPRESSO' | 'JIRA' | 'OUTRO';

export interface User {
  id: number;
  name: string;
  email: string;
  notificationEmail?: string;
  role: UserRole;
  managementLevel: 'LIDER' | 'GERENTE' | null;
}

export interface Requirement {
  id: number;
  code: string;
  title: string;
  description: string;
  actor: string;
  preconditions: string;
  mainFlow: string;
  alternativeFlow: string;
  businessRules: string;
  acceptanceCriteria: string;
  priority: Severity;
  dependencies: string;
  origin: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditStats {
  total: number;
  conforming: number;
  nonConforming: number;
  pending: number;
  adherence: number | null;
}

export interface AuditAnswer {
  auditId: number;
  checklistItemId: number;
  description: string;
  result: AuditResult | null;
  observation: string;
}

export interface DocumentSnapshot {
  title?: string;
  code?: string;
  version?: string;
  type?: DocumentType;
  reference?: string;
  scope?: string;
}

export interface Audit {
  id: number;
  requirementId: number | null;
  auditorId: number;
  auditorName: string;
  sourceType: AuditSource;
  status: AuditStatus;
  createdAt: string;
  finishedAt: string | null;
  requirementCode: string;
  requirementTitle: string;
  documentTitle: string;
  documentCode: string;
  documentVersion: string;
  documentType: DocumentType | 'REQUISITO';
  documentReference: string;
  documentScope: string;
  requirementSnapshot: Partial<Requirement>;
  documentSnapshot: DocumentSnapshot;
  attachmentName?: string | null;
  stats: AuditStats;
  answers: AuditAnswer[];
  nonConformities: NonConformity[];
}

export interface NonConformity {
  id: number;
  auditId: number;
  checklistItemId: number;
  title: string;
  description: string;
  severity: Severity;
  responsibleId: number;
  responsibleName: string;
  auditorId: number;
  auditorName: string;
  status: NonConformityStatus;
  dueDate: string;
  createdAt: string;
  resolvedAt?: string | null;
  correction?: string | null;
  escalationLevel: number;
  daysLate: number;
  overdue: boolean;
  requirementCode: string;
  requirementTitle: string;
  documentTitle: string;
  documentCode: string;
  documentVersion: string;
  sourceType: AuditSource;
  requirementSnapshot: Partial<Requirement>;
  documentSnapshot: DocumentSnapshot;
  history?: NonConformityHistory[];
}

export interface NonConformityHistory {
  id: number;
  nonConformityId: number;
  userId: number | null;
  userName?: string | null;
  action: string;
  description: string;
  createdAt: string;
}

export interface Notification {
  id: number;
  userId: number;
  nonConformityId: number;
  message: string;
  createdAt: string;
  readAt: string | null;
}

export interface OutboxMessage {
  id: number;
  nonConformityId: number;
  recipient: string;
  subject: string;
  body: string;
  htmlBody: string;
  status: 'PENDENTE' | 'SIMULADO' | 'ENVIADO' | 'FALHOU';
  createdAt: string;
  sentAt: string | null;
  error: string | null;
}

export interface DashboardStats {
  audits: number;
  finished: number;
  inProgress: number;
  averageAdherence: number | null;
  openNCs: number;
  overdueNCs: number;
  resolvedNCs: number;
}

export interface BootstrapData {
  users: User[];
  requirements: Requirement[];
  audits: Audit[];
  nonConformities: NonConformity[];
  notifications: Notification[];
  outbox: OutboxMessage[];
  dashboard: DashboardStats;
  emailMode: 'SMTP' | 'SIMULADO';
  currentUser: User;
}

export interface EmailSettings {
  smtp_enabled: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_user: string;
  smtp_pass: string;
  smtp_from: string;
  notify_email: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export type FormValues = Record<string, unknown>;
