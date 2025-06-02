import { defineStore } from 'pinia';

import type { PermissionType, RoleType } from '~/types/permissions';
import { DEFAULT_ROLES } from '~/types/permissions';

interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
  roles: RoleType[];
  permissions: PermissionType[];
  metadata?: Record<string, any>;
}

interface UserState {
  user: User | null;
  loaded: boolean;
}

export const useUserStore = defineStore('user', {
  state: (): UserState => ({
    user: null,
    loaded: false,
  }),

  getters: {
    isAuthenticated: (state) => !!state.user,
    currentUser: (state) => state.user,
    isAdmin: (state) => state.user?.roles.includes(DEFAULT_ROLES.admin) ?? false,
    roles: (state) => state.user?.roles ?? [],
    permissions: (state) => state.user?.permissions ?? [],
    isLoaded: (state) => state.loaded,
  },

  actions: {
    setUser(user: Omit<User, 'roles' | 'permissions'> & { [key: string]: any }) {
      // Extract roles and permissions from Auth0 metadata
      const roles = (user['https://www.cloudless.gr/roles'] ?? []) as RoleType[];
      const permissions = (user['https://www.cloudless.gr/permissions'] ?? []) as PermissionType[];
      this.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        roles,
        permissions,
        metadata: {
          lastLogin: user['https://www.cloudless.gr/last_login'],
          loginCount: user['https://www.cloudless.gr/login_count'],
        },
      };
      this.loaded = true;
    },

    clearUser() {
      this.user = null;
      this.loaded = false;
    },

    hasRole(role: RoleType): boolean {
      return this.roles.includes(role);
    },

    hasPermission(permission: PermissionType): boolean {
      return this.permissions.includes(permission);
    },

    hasAnyRole(roles: RoleType[]): boolean {
      return roles.some((role) => this.hasRole(role));
    },

    hasAllPermissions(permissions: PermissionType[]): boolean {
      return permissions.every((permission) => this.hasPermission(permission));
    },
  },
});
