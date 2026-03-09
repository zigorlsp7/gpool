'use client';

import { useAuth } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { useI18n } from '@/i18n/client';
import toast from 'react-hot-toast';
import { rum } from '@/lib/rum';

interface Pool {
  poolId: string;
  name: string;
  description?: string;
  adminUserId: string;
  adminName?: string;
  adminEmail?: string;
  memberCount?: number;
  createdAt: number;
  isMember?: boolean;
  userMembership?: any;
}

function PoolsContent() {
  const { user } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [poolName, setPoolName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editingPool, setEditingPool] = useState<Pool | null>(null);
  const [editName, setEditName] = useState('');
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [invitingPool, setInvitingPool] = useState<Pool | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [requestingAccess, setRequestingAccess] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  useEffect(() => {
    fetchPools();
  }, []);

  const fetchPools = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/pools');
      setPools(response.data);
      setError(null);
    } catch (err: any) {
      console.error('Failed to fetch pools:', err);
      const errorMessage = err.response?.data?.message || t('pools.errors.loadPools');
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePool = () => {
    setShowCreateModal(true);
    setPoolName('');
    setCreateError(null);
  };

  const handleCloseModal = () => {
    setShowCreateModal(false);
    setPoolName('');
    setCreateError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!poolName.trim() || poolName.trim().length < 3) {
      setCreateError(t('pools.validation.nameMin'));
      return;
    }

    if (poolName.trim().length > 100) {
      setCreateError(t('pools.validation.nameMax'));
      return;
    }

    try {
      setCreating(true);
      setCreateError(null);
      
      const response = await apiClient.post('/pools', {
        name: poolName.trim(),
      });

      // Refresh pools list
      await fetchPools();
      
      // Track custom event
      rum?.trackCustomEvent('Pool Created', { poolId: response.data.poolId, poolName: poolName.trim() });
      
      // Show success toast
      toast.success(t('pools.toast.created'));
      
      // Close modal and reset
      handleCloseModal();
    } catch (err: any) {
      console.error('Failed to create pool:', err);
      const errorMessage = err.response?.data?.message || t('pools.errors.create');
      setCreateError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setCreating(false);
    }
  };

  const handleEditPool = (pool: Pool) => {
    setEditingPool(pool);
    setEditName(pool.name);
    setUpdateError(null);
  };

  const handleCloseEditModal = () => {
    setEditingPool(null);
    setEditName('');
    setUpdateError(null);
  };

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingPool) return;

    if (!editName.trim() || editName.trim().length < 3) {
      setUpdateError(t('pools.validation.nameMin'));
      return;
    }

    if (editName.trim().length > 100) {
      setUpdateError(t('pools.validation.nameMax'));
      return;
    }

    try {
      setUpdating(true);
      setUpdateError(null);
      
      await apiClient.put(`/pools/${editingPool.poolId}`, {
        name: editName.trim(),
      });

      // Refresh pools list
      await fetchPools();
      
      // Track custom event
      rum?.trackCustomEvent('Pool Updated', { poolId: editingPool.poolId, newName: editName.trim() });
      
      // Show success toast
      toast.success(t('pools.toast.updated'));
      
      // Close modal and reset
      handleCloseEditModal();
    } catch (err: any) {
      console.error('Failed to update pool:', err);
      const errorMessage = err.response?.data?.message || t('pools.errors.update');
      setUpdateError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setUpdating(false);
    }
  };

  const handleInviteUser = (pool: Pool) => {
    setInvitingPool(pool);
    setInviteEmail('');
    setInviteError(null);
  };

  const handleCloseInviteModal = () => {
    setInvitingPool(null);
    setInviteEmail('');
    setInviteError(null);
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!invitingPool) return;

    if (!inviteEmail.trim()) {
      setInviteError(t('pools.validation.emailRequired'));
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail.trim())) {
      setInviteError(t('pools.validation.emailInvalid'));
      return;
    }

    try {
      setInviting(true);
      setInviteError(null);
      
      await apiClient.post(`/pools/${invitingPool.poolId}/invite`, {
        email: inviteEmail.trim(),
      });

      // Refresh pools list to update member count
      await fetchPools();
      
      // Track custom event
      rum?.trackCustomEvent('User Invited', { poolId: invitingPool.poolId, email: inviteEmail.trim() });
      
      // Show success toast
      toast.success(t('pools.toast.invitationSent', { email: inviteEmail.trim() }));
      
      // Close modal and reset
      handleCloseInviteModal();
    } catch (err: any) {
      console.error('Failed to invite user:', err);
      const errorMessage = err.response?.data?.message || t('pools.errors.invite');
      setInviteError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setInviting(false);
    }
  };

  const handleRequestAccess = async (poolId: string) => {
    try {
      setRequestingAccess(poolId);
      setRequestError(null);
      
      await apiClient.post(`/pools/${poolId}/request-access`);

      // Refresh pools list to update membership status
      await fetchPools();
      
      // Track custom event
      rum?.trackCustomEvent('Access Requested', { poolId });
      
      // Show success toast
      toast.success(t('pools.toast.requestSubmitted'));
    } catch (err: any) {
      console.error('Failed to request access:', err);
      const errorMessage = err.response?.data?.message || t('pools.errors.requestAccess');
      setRequestError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setRequestingAccess(null);
    }
  };

  if (loading) {
    return (
      <div style={{ 
        padding: 'var(--spacing-2xl)', 
        display: 'flex', 
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '50vh',
      }}>
        <p style={{ color: 'var(--text-primary)' }}>{t('pools.loading')}</p>
      </div>
    );
  }

  return (
    <main style={{ padding: 'var(--spacing-2xl)', width: '100%' }}>
      <div style={{ 
        marginBottom: 'var(--spacing-xl)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: 'var(--spacing-md)',
      }}>
        <div>
          <h1 style={{ 
            fontSize: '2rem', 
            fontWeight: 'bold', 
            color: 'var(--text-primary)',
            marginBottom: 'var(--spacing-sm)',
          }}>
            {t('pools.title')}
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            {t('pools.subtitle')}
          </p>
        </div>
        {user?.role === 'admin' && (
          <button
            onClick={handleCreatePool}
            style={{
              padding: 'var(--spacing-sm) var(--spacing-lg)',
              backgroundColor: 'var(--accent-primary)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '600',
              transition: 'all 0.2s ease',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-xs)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--accent-secondary)';
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = 'var(--shadow-md)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--accent-primary)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
            }}
          >
            <span>+</span>
            {t('pools.actions.create')}
          </button>
        )}
      </div>

      {error && (
        <div style={{
          padding: 'var(--spacing-md)',
          backgroundColor: '#ffebee',
          color: '#c62828',
          borderRadius: 'var(--radius-md)',
          marginBottom: 'var(--spacing-lg)',
          border: '1px solid #ef9a9a',
        }}>
          <strong>{t('common.errorLabel')}</strong> {error}
        </div>
      )}

      {pools.length === 0 && !loading && (
        <div style={{
          padding: 'var(--spacing-2xl)',
          textAlign: 'center',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)',
          border: `1px solid var(--border-color)`,
        }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-md)' }}>
            {t('pools.empty.title')}
          </p>
          {user?.role === 'admin' && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              {t('pools.empty.adminHint')}
            </p>
          )}
        </div>
      )}

      {pools.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 'var(--spacing-lg)',
        }}>
          {pools.map((pool) => {
            const isPoolAdmin = user?.role === 'admin' && user.userId === pool.adminUserId;
            const isMember = pool.isMember || false;
            const isDisabled = !isMember && user?.role === 'user';
            
            return (
            <div
              key={pool.poolId}
              onClick={() => {
                if (!isDisabled) {
                  router.push(`/pools/${pool.poolId}`);
                }
              }}
              style={{
                padding: 'var(--spacing-lg)',
                backgroundColor: isDisabled ? 'var(--bg-primary)' : 'var(--bg-secondary)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-sm)',
                border: `1px solid ${isDisabled ? 'var(--border-color)' : 'var(--border-color)'}`,
                transition: 'all 0.2s ease',
                position: 'relative',
                opacity: isDisabled ? 0.7 : 1,
                cursor: isDisabled ? 'default' : 'pointer',
              }}
              onMouseEnter={(e) => {
                if (!isDisabled) {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                  e.currentTarget.style.borderColor = 'var(--accent-primary)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                e.currentTarget.style.borderColor = 'var(--border-color)';
              }}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 'var(--spacing-sm)',
              }}>
                <h3 style={{
                  fontSize: '1.25rem',
                  fontWeight: '600',
                  color: 'var(--text-primary)',
                  margin: 0,
                  flex: 1,
                }}>
                  {pool.name}
                </h3>
                {isPoolAdmin && (
                  <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleInviteUser(pool);
                      }}
                      style={{
                        padding: 'var(--spacing-xs)',
                        backgroundColor: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-secondary)',
                        fontSize: '0.875rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 'var(--radius-sm)',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = 'var(--accent-primary)';
                        e.currentTarget.style.backgroundColor = 'rgba(67, 86, 99, 0.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'var(--text-secondary)';
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                      title={t('pools.actions.inviteTitle')}
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M8 9a3 3 0 100-6 3 3 0 000 6zm0 2a6 6 0 00-6 1 1 1 0 001 1h10a1 1 0 001-1 6 6 0 00-6-1zm8-4a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z"/>
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditPool(pool);
                      }}
                      style={{
                        padding: 'var(--spacing-xs)',
                        backgroundColor: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-secondary)',
                        fontSize: '0.875rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 'var(--radius-sm)',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = 'var(--accent-primary)';
                        e.currentTarget.style.backgroundColor = 'rgba(67, 86, 99, 0.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'var(--text-secondary)';
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                      title={t('pools.actions.editTitle')}
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M11.013 1.427a1.75 1.75 0 012.474 0l1.086 1.086a1.75 1.75 0 010 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 01-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61zm1.414 1.06a.25.25 0 00-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 000-.354l-1.086-1.086zM11.189 6.25L9.75 4.81l-6.286 6.287a.25.25 0 00-.064.108l-.558 1.953 1.953-.558a.249.249 0 00.108-.064l6.286-6.286z"/>
                      </svg>
                    </button>
                  </div>
                )}
              </div>
              {pool.description && (
                <p style={{
                  color: 'var(--text-secondary)',
                  fontSize: '0.875rem',
                  marginBottom: 'var(--spacing-md)',
                }}>
                  {pool.description}
                </p>
              )}
              <div style={{
                marginBottom: 'var(--spacing-md)',
                padding: 'var(--spacing-sm)',
                backgroundColor: 'rgba(67, 86, 99, 0.05)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid rgba(67, 86, 99, 0.2)',
              }}>
                <p style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  margin: 0,
                  marginBottom: 'var(--spacing-xs)',
                }}>
                  {t('pools.card.owner')}
                </p>
                <p style={{
                  fontSize: '0.875rem',
                  color: 'var(--text-primary)',
                  margin: 0,
                  fontWeight: '500',
                }}>
                  {pool.adminName || pool.adminEmail || t('pools.card.unknownOwner')}
                </p>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: 'var(--spacing-md)',
                paddingTop: 'var(--spacing-md)',
                borderTop: `1px solid var(--border-color)`,
                gap: 'var(--spacing-md)',
              }}>
                <span style={{
                  fontSize: '0.875rem',
                  color: 'var(--text-primary)',
                  fontWeight: '500',
                }}>
                  {t('pools.card.members', { count: pool.memberCount || 0 })}
                </span>
                {isDisabled && user?.role === 'user' && (
                  <button
                    onClick={() => handleRequestAccess(pool.poolId)}
                    disabled={requestingAccess === pool.poolId}
                    style={{
                      padding: 'var(--spacing-xs) var(--spacing-md)',
                      backgroundColor: requestingAccess === pool.poolId ? 'var(--text-secondary)' : 'var(--accent-primary)',
                      color: 'white',
                      border: 'none',
                      borderRadius: 'var(--radius-md)',
                      cursor: requestingAccess === pool.poolId ? 'not-allowed' : 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      transition: 'all 0.2s ease',
                      opacity: requestingAccess === pool.poolId ? 0.6 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (requestingAccess !== pool.poolId) {
                        e.currentTarget.style.backgroundColor = 'var(--accent-secondary)';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = requestingAccess === pool.poolId ? 'var(--text-secondary)' : 'var(--accent-primary)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    {requestingAccess === pool.poolId ? t('pools.actions.requesting') : t('pools.actions.requestAccess')}
                  </button>
                )}
                {isMember && (
                  <span style={{
                    fontSize: '0.75rem',
                    color: 'var(--accent-primary)',
                    fontWeight: '600',
                    padding: 'var(--spacing-xs) var(--spacing-sm)',
                    backgroundColor: 'rgba(67, 86, 99, 0.1)',
                    borderRadius: 'var(--radius-sm)',
                  }}>
                    {t('pools.card.member')}
                  </span>
                )}
              </div>
            </div>
          )})}
        </div>
      )}

      {/* Create Pool Modal */}
      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
          }}
          onClick={handleCloseModal}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-primary)',
              padding: 'var(--spacing-xl)',
              borderRadius: 'var(--radius-lg)',
              maxWidth: '500px',
              width: '90%',
              boxShadow: 'var(--shadow-lg)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: 'bold',
              color: 'var(--text-primary)',
              marginBottom: 'var(--spacing-lg)',
            }}>
              {t('pools.modal.createTitle')}
            </h2>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                <label
                  htmlFor="poolName"
                  style={{
                    display: 'block',
                    marginBottom: 'var(--spacing-sm)',
                    color: 'var(--text-primary)',
                    fontWeight: '500',
                  }}
                >
                  {t('pools.modal.poolNameLabel')}
                </label>
                <input
                  id="poolName"
                  type="text"
                  value={poolName}
                  onChange={(e) => setPoolName(e.target.value)}
                  placeholder={t('pools.modal.poolNamePlaceholder')}
                  disabled={creating}
                  style={{
                    width: '100%',
                    padding: 'var(--spacing-sm) var(--spacing-md)',
                    border: `1px solid var(--border-color)`,
                    borderRadius: 'var(--radius-md)',
                    fontSize: '1rem',
                    color: 'var(--text-primary)',
                    backgroundColor: 'var(--bg-primary)',
                    boxSizing: 'border-box',
                  }}
                  autoFocus
                />
                {createError && (
                  <p style={{
                    color: '#c62828',
                    fontSize: '0.875rem',
                    marginTop: 'var(--spacing-xs)',
                  }}>
                    {createError}
                  </p>
                )}
              </div>

              <div style={{
                display: 'flex',
                gap: 'var(--spacing-md)',
                justifyContent: 'flex-end',
              }}>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={creating}
                  style={{
                    padding: 'var(--spacing-sm) var(--spacing-lg)',
                    backgroundColor: 'transparent',
                    color: 'var(--text-primary)',
                    border: `1px solid var(--border-color)`,
                    borderRadius: 'var(--radius-md)',
                    cursor: creating ? 'not-allowed' : 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    opacity: creating ? 0.6 : 1,
                  }}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={creating || !poolName.trim()}
                  style={{
                    padding: 'var(--spacing-sm) var(--spacing-lg)',
                    backgroundColor: creating || !poolName.trim() ? 'var(--text-secondary)' : 'var(--accent-primary)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    cursor: creating || !poolName.trim() ? 'not-allowed' : 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {creating ? t('pools.actions.creating') : t('pools.actions.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Pool Modal */}
      {editingPool && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
          }}
          onClick={handleCloseEditModal}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-primary)',
              padding: 'var(--spacing-xl)',
              borderRadius: 'var(--radius-lg)',
              maxWidth: '500px',
              width: '90%',
              boxShadow: 'var(--shadow-lg)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: 'bold',
              color: 'var(--text-primary)',
              marginBottom: 'var(--spacing-lg)',
            }}>
              {t('pools.modal.editTitle')}
            </h2>

            <form onSubmit={handleUpdateSubmit}>
              <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                <label
                  htmlFor="editPoolName"
                  style={{
                    display: 'block',
                    marginBottom: 'var(--spacing-sm)',
                    color: 'var(--text-primary)',
                    fontWeight: '500',
                  }}
                >
                  {t('pools.modal.poolNameLabel')}
                </label>
                <input
                  id="editPoolName"
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder={t('pools.modal.poolNamePlaceholder')}
                  disabled={updating}
                  style={{
                    width: '100%',
                    padding: 'var(--spacing-sm) var(--spacing-md)',
                    border: `1px solid var(--border-color)`,
                    borderRadius: 'var(--radius-md)',
                    fontSize: '1rem',
                    color: 'var(--text-primary)',
                    backgroundColor: 'var(--bg-primary)',
                    boxSizing: 'border-box',
                  }}
                  autoFocus
                />
                {updateError && (
                  <p style={{
                    color: '#c62828',
                    fontSize: '0.875rem',
                    marginTop: 'var(--spacing-xs)',
                  }}>
                    {updateError}
                  </p>
                )}
              </div>

              <div style={{
                display: 'flex',
                gap: 'var(--spacing-md)',
                justifyContent: 'flex-end',
              }}>
                <button
                  type="button"
                  onClick={handleCloseEditModal}
                  disabled={updating}
                  style={{
                    padding: 'var(--spacing-sm) var(--spacing-lg)',
                    backgroundColor: 'transparent',
                    color: 'var(--text-primary)',
                    border: `1px solid var(--border-color)`,
                    borderRadius: 'var(--radius-md)',
                    cursor: updating ? 'not-allowed' : 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    opacity: updating ? 0.6 : 1,
                  }}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={updating || !editName.trim() || editName.trim() === editingPool.name}
                  style={{
                    padding: 'var(--spacing-sm) var(--spacing-lg)',
                    backgroundColor: updating || !editName.trim() || editName.trim() === editingPool.name ? 'var(--text-secondary)' : 'var(--accent-primary)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    cursor: updating || !editName.trim() || editName.trim() === editingPool.name ? 'not-allowed' : 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {updating ? t('pools.actions.updating') : t('pools.actions.update')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invite User Modal */}
      {invitingPool && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
          }}
          onClick={handleCloseInviteModal}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-primary)',
              padding: 'var(--spacing-xl)',
              borderRadius: 'var(--radius-lg)',
              maxWidth: '500px',
              width: '90%',
              boxShadow: 'var(--shadow-lg)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: 'bold',
              color: 'var(--text-primary)',
              marginBottom: 'var(--spacing-lg)',
            }}>
              {t('pools.modal.inviteTitle', { poolName: invitingPool.name })}
            </h2>

            <form onSubmit={handleInviteSubmit}>
              <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                <label
                  htmlFor="inviteEmail"
                  style={{
                    display: 'block',
                    marginBottom: 'var(--spacing-sm)',
                    color: 'var(--text-primary)',
                    fontWeight: '500',
                  }}
                >
                  {t('pools.modal.inviteEmailLabel')}
                </label>
                <input
                  id="inviteEmail"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder={t('pools.modal.inviteEmailPlaceholder')}
                  disabled={inviting}
                  style={{
                    width: '100%',
                    padding: 'var(--spacing-sm) var(--spacing-md)',
                    border: `1px solid var(--border-color)`,
                    borderRadius: 'var(--radius-md)',
                    fontSize: '1rem',
                    color: 'var(--text-primary)',
                    backgroundColor: 'var(--bg-primary)',
                    boxSizing: 'border-box',
                  }}
                  autoFocus
                />
                {inviteError && (
                  <p style={{
                    color: '#c62828',
                    fontSize: '0.875rem',
                    marginTop: 'var(--spacing-xs)',
                  }}>
                    {inviteError}
                  </p>
                )}
              </div>

              <div style={{
                display: 'flex',
                gap: 'var(--spacing-md)',
                justifyContent: 'flex-end',
              }}>
                <button
                  type="button"
                  onClick={handleCloseInviteModal}
                  disabled={inviting}
                  style={{
                    padding: 'var(--spacing-sm) var(--spacing-lg)',
                    backgroundColor: 'transparent',
                    color: 'var(--text-primary)',
                    border: `1px solid var(--border-color)`,
                    borderRadius: 'var(--radius-md)',
                    cursor: inviting ? 'not-allowed' : 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    opacity: inviting ? 0.6 : 1,
                  }}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={inviting || !inviteEmail.trim()}
                  style={{
                    padding: 'var(--spacing-sm) var(--spacing-lg)',
                    backgroundColor: inviting || !inviteEmail.trim() ? 'var(--text-secondary)' : 'var(--accent-primary)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    cursor: inviting || !inviteEmail.trim() ? 'not-allowed' : 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {inviting ? t('pools.actions.sending') : t('pools.actions.sendInvitation')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

export default function PoolsPage() {
  return (
    <ProtectedRoute>
      <PoolsContent />
    </ProtectedRoute>
  );
}
