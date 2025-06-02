// Permission and Role Type Definitions for Cloudless.gr Platform
export type PermissionType =
  | 'read'
  | 'write'
  | 'delete'
  | 'admin'
  | 'user_management'
  | 'project_management'
  | 'system_management'
  | 'api_access'
  | 'file_upload'
  | 'file_download'
  | 'docker_access'
  | 'database_access'
  | 'agent_management'
  | 'workflow_management';

export type RoleType = 'super_admin' | 'admin' | 'developer' | 'user' | 'viewer' | 'guest';

export interface Role {
  name: RoleType;
  permissions: PermissionType[];
  description: string;
}

export interface Permission {
  name: PermissionType;
  description: string;
  category: 'system' | 'user' | 'project' | 'file' | 'api';
}

// Default role configurations
export const DEFAULT_ROLES: Record<RoleType, Role> = {
  super_admin: {
    name: 'super_admin',
    permissions: [
      'read',
      'write',
      'delete',
      'admin',
      'user_management',
      'project_management',
      'system_management',
      'api_access',
      'file_upload',
      'file_download',
      'docker_access',
      'database_access',
      'agent_management',
      'workflow_management',
    ],
    description: 'Full system access with all permissions',
  },
  admin: {
    name: 'admin',
    permissions: [
      'read',
      'write',
      'delete',
      'user_management',
      'project_management',
      'api_access',
      'file_upload',
      'file_download',
      'agent_management',
      'workflow_management',
    ],
    description: 'Administrative access with user and project management',
  },
  developer: {
    name: 'developer',
    permissions: [
      'read',
      'write',
      'project_management',
      'api_access',
      'file_upload',
      'file_download',
      'docker_access',
      'agent_management',
      'workflow_management',
    ],
    description: 'Development access with project and workflow management',
  },
  user: {
    name: 'user',
    permissions: [
      'read',
      'write',
      'api_access',
      'file_upload',
      'file_download',
      'workflow_management',
    ],
    description: 'Standard user access with basic operations',
  },
  viewer: {
    name: 'viewer',
    permissions: ['read', 'api_access'],
    description: 'Read-only access to view content',
  },
  guest: {
    name: 'guest',
    permissions: ['read'],
    description: 'Limited read-only access for guests',
  },
};

// Permission definitions with categories
export const PERMISSIONS: Record<PermissionType, Permission> = {
  read: {
    name: 'read',
    description: 'View and read content',
    category: 'system',
  },
  write: {
    name: 'write',
    description: 'Create and modify content',
    category: 'system',
  },
  delete: {
    name: 'delete',
    description: 'Delete content and resources',
    category: 'system',
  },
  admin: {
    name: 'admin',
    description: 'Administrative privileges',
    category: 'system',
  },
  user_management: {
    name: 'user_management',
    description: 'Manage user accounts and permissions',
    category: 'user',
  },
  project_management: {
    name: 'project_management',
    description: 'Create and manage projects',
    category: 'project',
  },
  system_management: {
    name: 'system_management',
    description: 'Manage system settings and configuration',
    category: 'system',
  },
  api_access: {
    name: 'api_access',
    description: 'Access to API endpoints',
    category: 'api',
  },
  file_upload: {
    name: 'file_upload',
    description: 'Upload files to the system',
    category: 'file',
  },
  file_download: {
    name: 'file_download',
    description: 'Download files from the system',
    category: 'file',
  },
  docker_access: {
    name: 'docker_access',
    description: 'Access to Docker containers and images',
    category: 'system',
  },
  database_access: {
    name: 'database_access',
    description: 'Direct database access and management',
    category: 'system',
  },
  agent_management: {
    name: 'agent_management',
    description: 'Manage AI agents and configurations',
    category: 'system',
  },
  workflow_management: {
    name: 'workflow_management',
    description: 'Create and manage workflows',
    category: 'project',
  },
};

// Helper functions for permission checking
export function hasPermission(
  userPermissions: PermissionType[],
  requiredPermission: PermissionType
): boolean {
  return userPermissions.includes(requiredPermission) || userPermissions.includes('admin');
}

export function hasAnyPermission(
  userPermissions: PermissionType[],
  requiredPermissions: PermissionType[]
): boolean {
  return requiredPermissions.some((permission) => hasPermission(userPermissions, permission));
}

export function hasAllPermissions(
  userPermissions: PermissionType[],
  requiredPermissions: PermissionType[]
): boolean {
  return requiredPermissions.every((permission) => hasPermission(userPermissions, permission));
}

export function getRolePermissions(role: RoleType): PermissionType[] {
  return DEFAULT_ROLES[role]?.permissions || [];
}

export function getUserPermissions(roles: RoleType[]): PermissionType[] {
  const permissions = new Set<PermissionType>();
  roles.forEach((role) => {
    getRolePermissions(role).forEach((permission) => permissions.add(permission));
  });
  return Array.from(permissions);
}
