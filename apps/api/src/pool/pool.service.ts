import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { hasPermission } from '../common/guards/roles.guard';
import { NotificationService } from '../notification/notification.service';
import { CreatePoolDto } from './dto/create-pool.dto';
import { PoolRepository } from './database/pool.repository';
import { UpdatePoolDto } from './dto/update-pool.dto';

@Injectable()
export class PoolService {
  private readonly logger = new Logger(PoolService.name);

  constructor(
    private readonly poolRepository: PoolRepository,
    private readonly notificationService: NotificationService,
  ) {}

  async createPool(
    createPoolDto: CreatePoolDto,
    adminUserId: string,
    userRole: string,
    adminName?: string,
    adminEmail?: string,
  ) {
    if (!hasPermission(userRole, 'admin')) {
      throw new ForbiddenException('Only administrators can create pools');
    }

    const poolId = uuidv4();
    const pool = await this.poolRepository.createPool({
      poolId,
      adminUserId,
      adminName: adminName || 'Pool Administrator',
      adminEmail: adminEmail || '',
      name: createPoolDto.name,
      description: createPoolDto.description,
      config: createPoolDto.config || {},
    });

    await this.poolRepository.addMember(poolId, adminUserId, 'admin', adminEmail, adminName);

    this.logger.log(`Pool created: ${poolId} by ${adminUserId}`);
    return pool;
  }

  async listPools(filters?: { userId?: string; userRole?: string }) {
    const pools =
      filters?.userId && filters?.userRole === 'admin'
        ? await this.poolRepository.listPools({ adminUserId: filters.userId })
        : await this.poolRepository.listPools();

    const userMemberships = filters?.userId
      ? await this.poolRepository.getUserPools(filters.userId)
      : [];

    const userMembershipMap = new Map(userMemberships.map((membership) => [membership.poolId, membership]));

    return Promise.all(
      pools.map(async (pool) => {
        const members = await this.poolRepository.getPoolMembers(pool.poolId);
        const userMembership = filters?.userId ? userMembershipMap.get(pool.poolId) : null;
        return {
          ...pool,
          memberCount: members.length,
          isMember: !!userMembership,
          userMembership: userMembership || null,
        };
      }),
    );
  }

  async getPool(poolId: string, userId?: string) {
    const pool = await this.poolRepository.getPool(poolId);
    if (!pool) {
      throw new NotFoundException(`Pool with ID ${poolId} not found`);
    }

    const members = await this.poolRepository.getPoolMembers(poolId);
    const userMembership = userId ? await this.poolRepository.getMembership(poolId, userId) : null;

    return {
      ...pool,
      members,
      memberCount: members.length,
      userMembership,
    };
  }

  async updatePool(poolId: string, updatePoolDto: UpdatePoolDto, userId: string, userRole: string) {
    const pool = await this.poolRepository.getPool(poolId);
    if (!pool) {
      throw new NotFoundException(`Pool with ID ${poolId} not found`);
    }

    if (!hasPermission(userRole, 'admin')) {
      throw new ForbiddenException('Only administrators can update pools');
    }

    if (pool.adminUserId !== userId) {
      throw new ForbiddenException('Only the pool administrator can update this pool');
    }

    const updates: Record<string, any> = {};
    if (updatePoolDto.name) updates.name = updatePoolDto.name;
    if (updatePoolDto.description !== undefined) updates.description = updatePoolDto.description;
    if (updatePoolDto.config) updates.config = updatePoolDto.config;

    const updatedPool = await this.poolRepository.updatePool(poolId, updates);
    this.logger.log(`Pool updated: ${poolId} by ${userId}`);
    return updatedPool;
  }

  async deletePool(poolId: string, userId: string, userRole: string) {
    const pool = await this.poolRepository.getPool(poolId);
    if (!pool) {
      throw new NotFoundException(`Pool with ID ${poolId} not found`);
    }

    if (!hasPermission(userRole, 'admin')) {
      throw new ForbiddenException('Only administrators can delete pools');
    }

    if (pool.adminUserId !== userId) {
      throw new ForbiddenException('Only the pool administrator can delete this pool');
    }

    await this.poolRepository.deletePool(poolId);
    this.logger.log(`Pool deleted: ${poolId} by ${userId}`);
    return { success: true, message: 'Pool deleted successfully' };
  }

  async requestAccess(poolId: string, userId: string, userEmail?: string, userName?: string) {
    const pool = await this.poolRepository.getPool(poolId);
    if (!pool) {
      throw new NotFoundException(`Pool with ID ${poolId} not found`);
    }

    const existingMembership = await this.poolRepository.getMembership(poolId, userId);
    if (existingMembership) {
      throw new BadRequestException('You are already a member of this pool');
    }

    const config = pool.config || {};
    const settings = config.settings || {};

    if (settings.isPublic) {
      await this.poolRepository.addMember(poolId, userId, 'member', userEmail, userName);
      this.logger.log(`User ${userId} joined public pool ${poolId}`);
      return { success: true, message: 'Successfully joined pool' };
    }

    await this.notificationService.sendPoolAccessRequest({
      to: pool.adminEmail,
      poolName: pool.name,
      poolId,
      requesterEmail: userEmail || '',
      requesterUserId: userId,
      adminUserId: pool.adminUserId,
    });

    this.logger.log(`Access requested to pool ${poolId} by ${userId}`);
    return {
      success: true,
      message: 'Access request submitted. Pool administrator will review your request.',
    };
  }

  async acceptAccessRequest(poolId: string, targetUserId: string, adminUserId: string, userRole: string) {
    if (!hasPermission(userRole, 'admin')) {
      throw new ForbiddenException('Only administrators can accept access requests');
    }

    const pool = await this.poolRepository.getPool(poolId);
    if (!pool) {
      throw new NotFoundException(`Pool with ID ${poolId} not found`);
    }

    if (pool.adminUserId !== adminUserId) {
      throw new ForbiddenException('Only the pool administrator can accept access requests');
    }

    const targetUser = await this.poolRepository.getUser(targetUserId);
    await this.poolRepository.addMember(
      poolId,
      targetUserId,
      'member',
      targetUser?.email,
      targetUser?.name,
    );

    await this.notificationService.sendPoolAccessGranted({
      to: targetUser?.email,
      poolName: pool.name,
      poolId,
      userId: targetUserId,
      userName: targetUser?.name,
    });

    this.logger.log(`Access granted to pool ${poolId} for user ${targetUserId} by ${adminUserId}`);
    return { success: true, message: 'Access granted successfully' };
  }

  async inviteUser(poolId: string, email: string, invitedBy: string, userRole: string, inviterEmail?: string) {
    if (!hasPermission(userRole, 'admin')) {
      throw new ForbiddenException('Only administrators can invite users to pools');
    }

    const pool = await this.poolRepository.getPool(poolId);
    if (!pool) {
      throw new NotFoundException(`Pool with ID ${poolId} not found`);
    }

    if (pool.adminUserId !== invitedBy) {
      throw new ForbiddenException('Only the pool administrator can invite users');
    }

    await this.notificationService.sendPoolInvitation({
      to: email,
      poolName: pool.name,
      poolId,
      inviterEmail: inviterEmail || pool.adminEmail || 'Pool Administrator',
      invitedBy,
    });

    this.logger.log(`User ${email} invited to pool ${poolId} by ${invitedBy}`);
    return { success: true, message: 'Invitation sent successfully' };
  }

  async acceptInvitation(poolId: string, userId: string, userEmail?: string, userName?: string) {
    const pool = await this.poolRepository.getPool(poolId);
    if (!pool) {
      throw new NotFoundException(`Pool with ID ${poolId} not found`);
    }

    const existingMembership = await this.poolRepository.getMembership(poolId, userId);
    if (existingMembership) {
      this.logger.log(
        `User ${userId} attempted to accept invitation but is already a member of pool ${poolId}`,
      );
      return { success: true, message: 'You are already a member of this pool' };
    }

    await this.poolRepository.addMember(poolId, userId, 'member', userEmail, userName);
    const membership = await this.poolRepository.getMembership(poolId, userId);
    if (!membership) {
      throw new BadRequestException('Failed to add user as member');
    }

    await this.notificationService.sendUserAcceptedInvitation({
      to: pool.adminEmail,
      poolName: pool.name,
      poolId,
      userId,
      userName: userName || userEmail?.split('@')[0] || 'User',
      userEmail: userEmail || '',
      adminUserId: pool.adminUserId,
      eventId: `${poolId}:${userId}:accepted_invitation`,
    });

    this.logger.log(`User ${userId} accepted invitation and joined pool ${poolId}`);
    return { success: true, message: 'You have successfully joined the pool' };
  }

  async leavePool(poolId: string, userId: string) {
    const pool = await this.poolRepository.getPool(poolId);
    if (!pool) {
      throw new NotFoundException(`Pool with ID ${poolId} not found`);
    }

    const membership = await this.poolRepository.getMembership(poolId, userId);
    if (!membership) {
      throw new BadRequestException('You are not a member of this pool');
    }

    if (pool.adminUserId === userId) {
      throw new BadRequestException(
        'Pool administrator cannot leave the pool. Transfer ownership first.',
      );
    }

    await this.poolRepository.removeMember(poolId, userId);
    this.logger.log(`User ${userId} left pool ${poolId}`);
    return { success: true, message: 'Successfully left pool' };
  }

  async removeMember(poolId: string, targetUserId: string, adminUserId: string, userRole: string) {
    if (!hasPermission(userRole, 'admin')) {
      throw new ForbiddenException('Only administrators can remove members');
    }

    const pool = await this.poolRepository.getPool(poolId);
    if (!pool) {
      throw new NotFoundException(`Pool with ID ${poolId} not found`);
    }

    if (pool.adminUserId !== adminUserId) {
      throw new ForbiddenException('Only the pool administrator can remove members');
    }

    if (pool.adminUserId === targetUserId) {
      throw new BadRequestException('Cannot remove the pool administrator');
    }

    await this.poolRepository.removeMember(poolId, targetUserId);
    this.logger.log(`Member ${targetUserId} removed from pool ${poolId} by ${adminUserId}`);
    return { success: true, message: 'Member removed successfully' };
  }

  async updatePoolConfiguration(
    poolId: string,
    newConfig: Record<string, any>,
    userId: string,
    userRole: string,
  ) {
    if (!hasPermission(userRole, 'admin')) {
      throw new ForbiddenException('Only administrators can update pool configuration');
    }

    const pool = await this.poolRepository.getPool(poolId);
    if (!pool) {
      throw new NotFoundException(`Pool with ID ${poolId} not found`);
    }

    if (pool.adminUserId !== userId) {
      throw new ForbiddenException('Only the pool administrator can update pool configuration');
    }

    const existingConfig = pool.config || {};
    const mergedConfig = { ...existingConfig, ...newConfig };
    await this.poolRepository.updatePool(poolId, { config: mergedConfig });

    this.logger.log(`Pool configuration updated: ${poolId} by ${userId}`);
    return { success: true, message: 'Pool configuration updated successfully' };
  }

  async getPoolMembers(poolId: string, userId?: string, userRole?: string) {
    const pool = await this.poolRepository.getPool(poolId);
    if (!pool) {
      throw new NotFoundException(`Pool with ID ${poolId} not found`);
    }

    if (userId && !hasPermission(userRole || 'user', 'admin')) {
      const membership = await this.poolRepository.getMembership(poolId, userId);
      if (!membership) {
        throw new ForbiddenException('You must be a member of this pool to view its members');
      }
    }

    return this.poolRepository.getPoolMembers(poolId);
  }

  async isPoolAdmin(poolId: string, userId: string): Promise<boolean> {
    const pool = await this.poolRepository.getPool(poolId);
    return !!pool && pool.adminUserId === userId;
  }
}
