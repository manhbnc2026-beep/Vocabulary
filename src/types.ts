export interface VocabList {
  id: string;
  name: string;
  userId: string;
  createdAt: any;
  wordCount: number;
}

export interface Word {
  id: string;
  text: string;
  phonetic: string;
  partOfSpeech: string;
  meaningVi: string;
  examples: string[];
  imageUrl: string;
  imagePrompt?: string;
  listId: string;
  userId: string;
  createdAt: any;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export interface AllowedUser {
  email: string;
  role: 'admin' | 'user';
  addedAt: any;
  authorizedApps: string[];
}

export interface EcosystemApp {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  createdAt: any;
}

export interface QuizSession {
  id: string;
  userId: string;
  score: number;
  total: number;
  timestamp: any;
}

export interface AccessRequest {
  email: string;
  requestedAt: any;
  status: 'pending';
}
