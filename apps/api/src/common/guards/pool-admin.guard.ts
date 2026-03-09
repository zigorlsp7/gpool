import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, forwardRef } from '@nestjs/common';
import { PoolService } from '../../pool/pool.service';

@Injectable()
export class PoolAdminGuard implements CanActivate {
    constructor(
        @Inject(forwardRef(() => PoolService))
        private poolService: PoolService
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const user = request.user;
        const poolId = request.params.poolId || request.params.id;

        if (!user) {
            throw new ForbiddenException('User not authenticated');
        }

        // System admins can manage any pool
        if (user.role === 'admin') {
            return true;
        }

        // Check if user is admin of this specific pool
        const isPoolAdmin = await this.poolService.isPoolAdmin(poolId, user.userId);
        if (!isPoolAdmin) {
            throw new ForbiddenException('Only pool administrators can perform this action');
        }

        return true;
    }
}
