import { getPrismaClient } from './prisma'

export interface Permission {
  id: number
  name: string
  description?: string | null
  resource: string
  action: string
}

export interface Role {
  id: number
  name: string
  description?: string | null
  permissions: Permission[]
}

export interface UserRole {
  id: number
  userId: number
  roleId: number
  role: Role
  assignedAt: Date
  expiresAt?: Date | null
  isActive: boolean
}

export class RBACService {
  // Check if user has permission
  async hasPermission(
    userId: number,
    resource: string,
    action: string
  ): Promise<boolean> {
    try {
      const prisma = getPrismaClient();
      const userPermissions = await this.getUserPermissions(userId)
      return userPermissions.some(
        p => p.resource === resource && p.action === action
      )
    } catch (error) {
      console.error('Permission check error:', error)
      return false
    }
  }

  // Check if user has any of the given permissions
  async hasAnyPermission(
    userId: number,
    permissions: Array<{ resource: string; action: string }>
  ): Promise<boolean> {
    try {
      const userPermissions = await this.getUserPermissions(userId)

      return permissions.some(required =>
        userPermissions.some(
          userPerm =>
            userPerm.resource === required.resource &&
            userPerm.action === required.action
        )
      )
    } catch (error) {
      console.error('Any permission check error:', error)
      return false
    }
  }

  // Check if user has all of the given permissions
  async hasAllPermissions(
    userId: number,
    permissions: Array<{ resource: string; action: string }>
  ): Promise<boolean> {
    try {
      const userPermissions = await this.getUserPermissions(userId)

      return permissions.every(required =>
        userPermissions.some(
          userPerm =>
            userPerm.resource === required.resource &&
            userPerm.action === required.action
        )
      )
    } catch (error) {
      console.error('All permissions check error:', error)
      return false
    }
  }

  // Get all permissions for a user
  async getUserPermissions(userId: number): Promise<Permission[]> {
    try {
      const prisma = getPrismaClient();
      const userRoles = await prisma.userRole.findMany({
        where: {
          userId,
          isActive: true,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        include: {
          role: {
            include: {
              rolePermissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      })

      const permissions = new Map<number, Permission>()

      userRoles.forEach(userRole => {
        userRole.role.rolePermissions.forEach(rp => {
          if (rp.permission.isActive) {
            permissions.set(rp.permission.id, rp.permission)
          }
        })
      })

      return Array.from(permissions.values())
    } catch (error) {
      console.error('Get user permissions error:', error)
      return []
    }
  }

  // Get all roles for a user
  async getUserRoles(userId: number): Promise<UserRole[]> {
    try {
      const prisma = getPrismaClient();
      const userRoles = await prisma.userRole.findMany({
        where: {
          userId,
          isActive: true,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        include: {
          role: {
            include: {
              rolePermissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      })

      // Transform the data to match the UserRole interface
      return userRoles.map(userRole => ({
        id: userRole.id,
        userId: userRole.userId,
        roleId: userRole.roleId,
        role: {
          id: userRole.role.id,
          name: userRole.role.name,
          description: userRole.role.description,
          permissions: userRole.role.rolePermissions.map(rp => ({
            id: rp.permission.id,
            name: rp.permission.name,
            description: rp.permission.description,
            resource: rp.permission.resource,
            action: rp.permission.action,
          })),
        },
        assignedAt: userRole.assignedAt,
        expiresAt: userRole.expiresAt,
        isActive: userRole.isActive,
      }))
    } catch (error) {
      console.error('Get user roles error:', error)
      return []
    }
  }

  // Assign role to user
  async assignRole(
    userId: number,
    roleId: number,
    expiresAt?: Date | null
  ): Promise<boolean> {
    try {
      const prisma = getPrismaClient();
      // Check if role exists and is active
      const role = await prisma.role.findFirst({
        where: { id: roleId, isActive: true },
      })

      if (!role) {
        return false
      }

      // Check if user already has this role
      const existingRole = await prisma.userRole.findUnique({
        where: { userId_roleId: { userId, roleId } },
      })

      if (existingRole) {
        // Update existing role assignment
        await prisma.userRole.update({
          where: { id: existingRole.id },
          data: {
            isActive: true,
            expiresAt,
          },
        })
      } else {
        // Create new role assignment
        await prisma.userRole.create({
          data: {
            userId,
            roleId,
            expiresAt,
          },
        })
      }

      return true
    } catch (error) {
      console.error('Assign role error:', error)
      return false
    }
  }

  // Remove role from user
  async removeRole(userId: number, roleId: number): Promise<boolean> {
    try {
      const prisma = getPrismaClient();
      await prisma.userRole.updateMany({
        where: { userId, roleId },
        data: { isActive: false },
      })
      return true
    } catch (error) {
      console.error('Remove role error:', error)
      return false
    }
  }

  // Create new role
  async createRole(
    name: string,
    description?: string,
    permissionIds?: number[]
  ): Promise<number | null> {
    try {
      const prisma = getPrismaClient();
      const role = await prisma.role.create({
        data: {
          name,
          description,
        },
      })

      if (permissionIds && permissionIds.length > 0) {
        await this.assignPermissionsToRole(role.id, permissionIds)
      }

      return role.id
    } catch (error) {
      console.error('Create role error:', error)
      return null
    }
  }

  // Update role
  async updateRole(
    roleId: number,
    name?: string,
    description?: string
  ): Promise<boolean> {
    try {
      const prisma = getPrismaClient();
      await prisma.role.update({
        where: { id: roleId },
        data: {
          ...(name && { name }),
          ...(description && { description }),
        },
      })
      return true
    } catch (error) {
      console.error('Update role error:', error)
      return false
    }
  }

  // Delete role
  async deleteRole(roleId: number): Promise<boolean> {
    try {
      const prisma = getPrismaClient();
      await prisma.role.update({
        where: { id: roleId },
        data: { isActive: false },
      })
      return true
    } catch (error) {
      console.error('Delete role error:', error)
      return false
    }
  }

  // Create new permission
  async createPermission(
    name: string,
    resource: string,
    action: string,
    description?: string
  ): Promise<number | null> {
    try {
      const prisma = getPrismaClient();
      const permission = await prisma.permission.create({
        data: {
          name,
          resource,
          action,
          description,
        },
      })
      return permission.id
    } catch (error) {
      console.error('Create permission error:', error)
      return null
    }
  }

  // Assign permissions to role
  async assignPermissionsToRole(
    roleId: number,
    permissionIds: number[]
  ): Promise<boolean> {
    try {
      const prisma = getPrismaClient();
      for (const permissionId of permissionIds) {
        try {
          await prisma.rolePermission.create({
            data: {
              roleId,
              permissionId,
            },
          })
        } catch (error: any) {
          // Ignore unique constraint violations
          if (error.code !== 'P2002') {
            throw error
          }
        }
      }

      return true
    } catch (error) {
      console.error('Assign permissions to role error:', error)
      return false
    }
  }

  // Remove permissions from role
  async removePermissionsFromRole(
    roleId: number,
    permissionIds: number[]
  ): Promise<boolean> {
    try {
      const prisma = getPrismaClient();
      await prisma.rolePermission.deleteMany({
        where: {
          roleId,
          permissionId: { in: permissionIds },
        },
      })
      return true
    } catch (error) {
      console.error('Remove permissions from role error:', error)
      return false
    }
  }

  // Get all roles
  async getAllRoles(): Promise<Role[]> {
    try {
      const prisma = getPrismaClient();
      const roles = await prisma.role.findMany({
        where: { isActive: true },
        include: {
          rolePermissions: {
            include: {
              permission: true,
            },
          },
        },
      })

      // Transform the data to match the Role interface
      return roles.map(role => ({
        id: role.id,
        name: role.name,
        description: role.description,
        permissions: role.rolePermissions.map(rp => ({
          id: rp.permission.id,
          name: rp.permission.name,
          description: rp.permission.description,
          resource: rp.permission.resource,
          action: rp.permission.action,
        })),
      }))
    } catch (error) {
      console.error('Get all roles error:', error)
      return []
    }
  }

  // Get all permissions
  async getAllPermissions(): Promise<Permission[]> {
    try {
      const prisma = getPrismaClient();
      return await prisma.permission.findMany({
        where: { isActive: true },
      })
    } catch (error) {
      console.error('Get all permissions error:', error)
      return []
    }
  }

  // Initialize default roles and permissions
  async initializeDefaultRBAC(): Promise<void> {
    try {
      const prisma = getPrismaClient();
      // Create default permissions
      const permissions = [
        // User permissions
        {
          name: 'user:read',
          resource: 'user',
          action: 'read',
          description: 'Read user information',
        },
        {
          name: 'user:create',
          resource: 'user',
          action: 'create',
          description: 'Create new users',
        },
        {
          name: 'user:update',
          resource: 'user',
          action: 'update',
          description: 'Update user information',
        },
        {
          name: 'user:delete',
          resource: 'user',
          action: 'delete',
          description: 'Delete users',
        },

        // Bot permissions
        {
          name: 'bot:read',
          resource: 'bot',
          action: 'read',
          description: 'Read bot information',
        },
        {
          name: 'bot:create',
          resource: 'bot',
          action: 'create',
          description: 'Create new bots',
        },
        {
          name: 'bot:update',
          resource: 'bot',
          action: 'update',
          description: 'Update bot information',
        },
        {
          name: 'bot:delete',
          resource: 'bot',
          action: 'delete',
          description: 'Delete bots',
        },
        {
          name: 'bot:deploy',
          resource: 'bot',
          action: 'deploy',
          description: 'Deploy bots',
        },

        // Model permissions
        {
          name: 'model:read',
          resource: 'model',
          action: 'read',
          description: 'Read model information',
        },
        {
          name: 'model:create',
          resource: 'model',
          action: 'create',
          description: 'Create new models',
        },
        {
          name: 'model:update',
          resource: 'model',
          action: 'update',
          description: 'Update model information',
        },
        {
          name: 'model:delete',
          resource: 'model',
          action: 'delete',
          description: 'Delete models',
        },
        {
          name: 'model:train',
          resource: 'model',
          action: 'train',
          description: 'Train models',
        },

        // Pipeline permissions
        {
          name: 'pipeline:read',
          resource: 'pipeline',
          action: 'read',
          description: 'Read pipeline information',
        },
        {
          name: 'pipeline:create',
          resource: 'pipeline',
          action: 'create',
          description: 'Create new pipelines',
        },
        {
          name: 'pipeline:update',
          resource: 'pipeline',
          action: 'update',
          description: 'Update pipeline information',
        },
        {
          name: 'pipeline:delete',
          resource: 'pipeline',
          action: 'delete',
          description: 'Delete pipelines',
        },
        {
          name: 'pipeline:execute',
          resource: 'pipeline',
          action: 'execute',
          description: 'Execute pipelines',
        },

        // Admin permissions
        {
          name: 'admin:all',
          resource: 'admin',
          action: 'all',
          description: 'Full administrative access',
        },
        {
          name: 'admin:users',
          resource: 'admin',
          action: 'users',
          description: 'Manage users',
        },
        {
          name: 'admin:roles',
          resource: 'admin',
          action: 'roles',
          description: 'Manage roles and permissions',
        },
        {
          name: 'admin:analytics',
          resource: 'admin',
          action: 'analytics',
          description: 'Access analytics',
        },
        {
          name: 'admin:system',
          resource: 'admin',
          action: 'system',
          description: 'System administration',
        },
      ]

      const createdPermissions = []
      for (const perm of permissions) {
        const existing = await prisma.permission.findUnique({
          where: { name: perm.name },
        })
        if (!existing) {
          const created = await prisma.permission.create({ data: perm })
          createdPermissions.push(created)
        } else {
          createdPermissions.push(existing)
        }
      }

      // Create default roles
      const roles = [
        {
          name: 'admin',
          description: 'Full system administrator',
          permissions: createdPermissions.map(p => p.id),
        },
        {
          name: 'user',
          description: 'Standard user',
          permissions: createdPermissions
            .filter(p =>
              [
                'user:read',
                'bot:read',
                'bot:create',
                'bot:update',
                'model:read',
                'pipeline:read',
              ].includes(p.name)
            )
            .map(p => p.id),
        },
        {
          name: 'developer',
          description: 'Developer with extended permissions',
          permissions: createdPermissions
            .filter(
              p =>
                !p.name.startsWith('admin:') &&
                !p.name.startsWith('user:delete')
            )
            .map(p => p.id),
        },
      ]

      for (const roleData of roles) {
        const existingRole = await prisma.role.findUnique({
          where: { name: roleData.name },
        })
        if (!existingRole) {
          const role = await prisma.role.create({
            data: {
              name: roleData.name,
              description: roleData.description,
            },
          })

          if (roleData.permissions.length > 0) {
            await this.assignPermissionsToRole(role.id, roleData.permissions)
          }
        }
      }

      console.log('Default RBAC initialized successfully')
    } catch (error) {
      console.error('Initialize default RBAC error:', error)
    }
  }
}

export const rbacService = new RBACService()
