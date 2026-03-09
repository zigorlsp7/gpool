import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Role hierarchy: admin inherits all user permissions
 * - admin: level 2 (highest - has all permissions)
 * - user: level 1 (base level)
 */
const ROLE_HIERARCHY: Record<string, number> = {
  'user': 1,
  'admin': 2,
};

/**
 * Check if user role has required permission level
 * Admin automatically has all user permissions (hierarchical roles)
 */
function hasPermission(userRole: string, requiredRole: string): boolean {
  const userLevel = ROLE_HIERARCHY[userRole] || 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0;
  return userLevel >= requiredLevel;
}

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private reflector: Reflector) { }

    canActivate(context: ExecutionContext): boolean {
        const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (!requiredRoles || requiredRoles.length === 0) {
            return true; // No roles required, allow access
        }

        const request = context.switchToHttp().getRequest();
        const user = request.user;

        if (!user) {
            throw new ForbiddenException('User not authenticated');
        }

        // Check if user has any of the required roles (using hierarchy)
        // Admin automatically satisfies 'user' requirements
        const hasRequiredRole = requiredRoles.some(role => hasPermission(user.role, role));
        
        if (!hasRequiredRole) {
            throw new ForbiddenException(
                `Access denied. Required role: ${requiredRoles.join(' or ')}`
            );
        }

        return true;
    }
}

// Export helper function for use in services
export { hasPermission };
