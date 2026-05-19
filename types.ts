import { Timestamp } from 'firebase/firestore';

export type UserRole = 'superadmin' | 'orgadmin' | 'user';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: UserRole;
  orgId: string | null;
  verificationStatus: 'pending' | 'approved' | 'rejected' | 'none';
  lastActivity: Timestamp;
}

export interface VerificationField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'textarea' | 'file';
  required: boolean;
}

export interface VerificationSectionDef {
  id: string;
  title: string;
  description: string;
  icon: string; // Lucide icon name
  fields: VerificationField[];
}

export interface Organization {
  id: string; // Slug/Unique ID
  name: string;
  logoUrl: string | null;
  ownerId: string;
  adminEmail: string; // The primary administrator email for this org
  subscriptionTier: 'basic' | 'pro' | 'enterprise';
  verificationLimit: number;
  verificationsUsed: number;
  settings: {
    primaryColor: string;
    customFields: string[];
    mandatoryDocs: string[];
    isBiometricRequired: boolean;
    isAutoApprovalEnabled?: boolean;
    autoApprovalThreshold?: number;
  };
  customSections?: VerificationSectionDef[];
  createdAt: Timestamp;
  status: 'active' | 'suspended';
  stats?: {
    totalVerifications: number;
    approved: number;
    rejected: number;
    pending: number;
    lastSubmissionAt?: Timestamp;
  };
}

export interface OrganizationVerification {
  id: string;
  orgId: string;
  userId: string;
  email: string;
  status: 'pending' | 'approved' | 'rejected';
  data: Record<string, any>;
  riskScore: number;
  submittedAt: Timestamp;
}
