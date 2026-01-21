// Event types
export interface BaseEvent {
  eventId: string;
  eventType: string;
  aggregateId: string;
  timestamp: string;
  version: number;
  data: Record<string, any>;
  metadata: {
    userId?: string;
    source: string;
    correlationId: string;
  };
}

// User events
export interface UserCreatedEvent extends BaseEvent {
  eventType: 'UserCreated';
  data: {
    userId: string;
    email: string;
    name: string;
    role: string;
  };
}

export interface UserAuthenticatedEvent extends BaseEvent {
  eventType: 'UserAuthenticated';
  data: {
    userId: string;
    timestamp: string;
  };
}

export interface UserProfileUpdatedEvent extends BaseEvent {
  eventType: 'UserProfileUpdated';
  data: {
    userId: string;
    changes: Record<string, any>;
  };
}

export interface UserLoggedOutEvent extends BaseEvent {
  eventType: 'UserLoggedOut';
  data: {
    userId: string;
    timestamp: string;
  };
}

export interface PoolAccessRequestedEvent extends BaseEvent {
  eventType: 'PoolAccessRequested';
  data: {
    userId: string;
    poolId: string;
    timestamp: string;
  };
}

export interface PoolAccessGrantedEvent extends BaseEvent {
  eventType: 'PoolAccessGranted';
  data: {
    userId: string;
    poolId: string;
    grantedBy: string;
    timestamp: string;
  };
}

export interface PoolAccessRevokedEvent extends BaseEvent {
  eventType: 'PoolAccessRevoked';
  data: {
    userId: string;
    poolId: string;
    revokedBy: string;
    timestamp: string;
  };
}

// Pool events
export interface PoolCreatedEvent extends BaseEvent {
  eventType: 'PoolCreated';
  data: {
    poolId: string;
    adminUserId: string;
    name: string;
    config: Record<string, any>;
  };
}

export interface PoolUpdatedEvent extends BaseEvent {
  eventType: 'PoolUpdated';
  data: {
    poolId: string;
    changes: Record<string, any>;
  };
}

export interface PoolConfigurationChangedEvent extends BaseEvent {
  eventType: 'PoolConfigurationChanged';
  data: {
    poolId: string;
    newConfig: Record<string, any>;
    changedBy: string;
  };
}

export interface UserInvitedToPoolEvent extends BaseEvent {
  eventType: 'UserInvitedToPool';
  data: {
    poolId: string;
    email: string;
    invitedBy: string;
    timestamp: string;
  };
}

// Match events
export interface MatchCreatedEvent extends BaseEvent {
  eventType: 'MatchCreated';
  data: {
    poolId: string;
    matchId: string;
    homeTeam: string;
    awayTeam: string;
    scheduledAt: string;
  };
}

export interface MatchUpdatedEvent extends BaseEvent {
  eventType: 'MatchUpdated';
  data: {
    poolId: string;
    matchId: string;
    changes: Record<string, any>;
  };
}

export interface MatchResultEnteredEvent extends BaseEvent {
  eventType: 'MatchResultEntered';
  data: {
    poolId: string;
    matchId: string;
    homeScore: number;
    awayScore: number;
    enteredBy: string;
    timestamp: string;
  };
}

export interface MatchEventOccurredEvent extends BaseEvent {
  eventType: 'MatchEventOccurred';
  data: {
    poolId: string;
    matchId: string;
    eventType: string;
    playerId: string;
    minute: number;
    details: Record<string, any>;
  };
}

export interface MatchStatusChangedEvent extends BaseEvent {
  eventType: 'MatchStatusChanged';
  data: {
    poolId: string;
    matchId: string;
    oldStatus: string;
    newStatus: string;
    timestamp: string;
  };
}

// Prediction events
export interface PredictionCreatedEvent extends BaseEvent {
  eventType: 'PredictionCreated';
  data: {
    poolId: string;
    userId: string;
    matchId: string;
    homeScore: number;
    awayScore: number;
    timestamp: string;
  };
}

export interface PredictionUpdatedEvent extends BaseEvent {
  eventType: 'PredictionUpdated';
  data: {
    poolId: string;
    userId: string;
    matchId: string;
    newHomeScore: number;
    newAwayScore: number;
    timestamp: string;
  };
}

export interface PredictionLockedEvent extends BaseEvent {
  eventType: 'PredictionLocked';
  data: {
    poolId: string;
    userId: string;
    matchId: string;
    timestamp: string;
  };
}

export interface PlayerSelectionCreatedEvent extends BaseEvent {
  eventType: 'PlayerSelectionCreated';
  data: {
    poolId: string;
    userId: string;
    playerIds: string[];
    timestamp: string;
  };
}

export interface PlayerSelectionUpdatedEvent extends BaseEvent {
  eventType: 'PlayerSelectionUpdated';
  data: {
    poolId: string;
    userId: string;
    playerIds: string[];
    timestamp: string;
  };
}

// Scoring events
export interface ScoreCalculatedEvent extends BaseEvent {
  eventType: 'ScoreCalculated';
  data: {
    poolId: string;
    userId: string;
    matchId: string;
    points: number;
    breakdown: Record<string, any>;
    calculatedAt: string;
  };
}

export interface TotalScoreUpdatedEvent extends BaseEvent {
  eventType: 'TotalScoreUpdated';
  data: {
    poolId: string;
    userId: string;
    totalPoints: number;
    previousTotalPoints: number;
    lastUpdatedAt: string;
  };
}

// Leaderboard events
export interface LeaderboardUpdatedEvent extends BaseEvent {
  eventType: 'LeaderboardUpdated';
  data: {
    poolId: string;
    updatedUserIds: string[];
    timestamp: string;
  };
}

// Notification events
export interface NotificationSentEvent extends BaseEvent {
  eventType: 'NotificationSent';
  data: {
    userId: string;
    type: string;
    channel: string;
    timestamp: string;
  };
}

// Export all event types
export type DomainEvent = 
  | UserCreatedEvent 
  | UserAuthenticatedEvent
  | UserProfileUpdatedEvent
  | UserLoggedOutEvent
  | PoolAccessRequestedEvent
  | PoolAccessGrantedEvent
  | PoolAccessRevokedEvent
  | PoolCreatedEvent
  | PoolUpdatedEvent
  | PoolConfigurationChangedEvent
  | UserInvitedToPoolEvent
  | MatchCreatedEvent
  | MatchUpdatedEvent
  | MatchResultEnteredEvent
  | MatchEventOccurredEvent
  | MatchStatusChangedEvent
  | PredictionCreatedEvent
  | PredictionUpdatedEvent
  | PredictionLockedEvent
  | PlayerSelectionCreatedEvent
  | PlayerSelectionUpdatedEvent
  | ScoreCalculatedEvent
  | TotalScoreUpdatedEvent
  | LeaderboardUpdatedEvent
  | NotificationSentEvent;

// Common types
export interface ApiResponse<T> {
  data: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// Observability exports
export * from './observability';

// Common utilities
export * from './common';
export * from './middleware';
