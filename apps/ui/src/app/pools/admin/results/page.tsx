'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/i18n/client';
import toast from 'react-hot-toast';
import { BracketVisualization } from '@/components/BracketVisualization';

interface Match {
  matchId: string;
  groupId: string;
  homeTeamName: string;
  awayTeamName: string;
  scheduledAt: string;
  deadline: number;
  phase: string;
  status: string;
  homeResult?: number;
  awayResult?: number;
}

interface BracketMatch {
  bracketMatchId: string;
  poolId: string;
  phase: string;
  matchNumber: number;
  homeTeamId?: string;
  homeTeamName?: string;
  awayTeamId?: string;
  awayTeamName?: string;
  homeResult?: number;
  awayResult?: number;
  status?: string;
}

interface Team {
  teamId: string;
  name: string;
  group?: string;
  code?: string;
}

const PHASES = [
  { key: '16th-finals', labelKey: 'bracket.round.16th', matches: 16 }, // 8 left + 8 right
  { key: '8th-finals', labelKey: 'bracket.round.8th', matches: 8 }, // 4 left + 4 right
  { key: 'quarter-finals', labelKey: 'bracket.round.quarter', matches: 4 }, // 2 left + 2 right
  { key: 'semi-finals', labelKey: 'bracket.round.semi', matches: 2 }, // 1 left + 1 right
  { key: 'finals', labelKey: 'bracket.round.final', matches: 1 },
] as const;

// Old Bracket Visualization Component - REMOVED, using shared component from @/components/BracketVisualization

function AdminResultsContent() {
  const router = useRouter();
  const { user } = useAuth();
  const { t, locale } = useI18n();
  const [matches, setMatches] = useState<Match[]>([]);
  const [matchesByGroup, setMatchesByGroup] = useState<Record<string, Match[]>>({});
  const [groups, setGroups] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, { homeResult: number | ''; awayResult: number | '' }>>({});
  const [scoringConfig, setScoringConfig] = useState({ winnerPoints: 1, exactResultPoints: 3 });
  const [bracketScoringConfig, setBracketScoringConfig] = useState({ exactPositionPoints: 5, correctTeamWrongPositionPoints: 3 });
  const [savingConfig, setSavingConfig] = useState(false);
  const [poolId, setPoolId] = useState<string>('all-pools');
  const [ranking, setRanking] = useState<Array<{ rank: number; userName: string; points: number }>>([]);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  
  // Bracket state
  const [bracket, setBracket] = useState<Record<string, BracketMatch[]>>({});
  const [teams, setTeams] = useState<Team[]>([]);
  const [creatingPhase, setCreatingPhase] = useState<string | null>(null);
  const [updatingMatch, setUpdatingMatch] = useState<string | null>(null);
  const [submittingBracketResult, setSubmittingBracketResult] = useState<string | null>(null);
  const [bracketResults, setBracketResults] = useState<Record<string, { homeResult: number | ''; awayResult: number | '' }>>({});
  const [groupPhaseExpanded, setGroupPhaseExpanded] = useState(true);
  const [finalPhaseExpanded, setFinalPhaseExpanded] = useState(false);

  // Check if user is admin
  useEffect(() => {
    if (user && user.role !== 'admin') {
      toast.error(t('adminResults.errors.adminRequired'));
      router.push('/pools');
    }
  }, [user, router, t]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Use any pool ID to get matches (they're shared)
        const [matchesResponse, poolsResponse] = await Promise.all([
          apiClient.get(`/pools/all-pools/matches`),
          apiClient.get('/pools').catch(() => ({ data: [] })),
        ]);
        
        const matchesData = matchesResponse.data || {};
        const matchesList = matchesData.matches || [];
        const matchesByGroupData = matchesData.matchesByGroup || {};
        const groupsList = matchesData.groups || [];

        setMatches(matchesList);
        setMatchesByGroup(matchesByGroupData);
        setGroups(groupsList);

        // Initialize results state with existing results
        const resultsMap: Record<string, { homeResult: number | ''; awayResult: number | '' }> = {};
        matchesList.forEach((match: Match) => {
          resultsMap[match.matchId] = {
            homeResult: match.homeResult !== undefined ? match.homeResult : '',
            awayResult: match.awayResult !== undefined ? match.awayResult : '',
          };
        });
        setResults(resultsMap);

        // Get pool ID and fetch ranking/bracket
        const pools = poolsResponse.data || [];
        if (pools.length > 0) {
          const firstPoolId = pools[0].poolId;
          setPoolId(firstPoolId);
          
          // Fetch pool config, ranking, bracket, and teams
          const [poolResponse, rankingResponse, bracketResponse, teamsResponse] = await Promise.all([
            apiClient.get(`/pools/${firstPoolId}`).catch(() => ({ data: {} })),
            apiClient.get(`/pools/${firstPoolId}/matches/ranking`).catch(() => ({ data: [] })),
            apiClient.get(`/pools/${firstPoolId}/bracket`).catch(() => ({ data: {} })),
            apiClient.get(`/pools/${firstPoolId}/matches/teams`).catch(() => ({ data: [] })),
          ]);

          const pool = poolResponse.data;
          if (pool?.config?.scoring) {
            setScoringConfig({
              winnerPoints: pool.config.scoring.winnerPoints ?? 1,
              exactResultPoints: pool.config.scoring.exactResultPoints ?? 3,
            });
          }
          if (pool?.config?.bracketScoring) {
            setBracketScoringConfig({
              exactPositionPoints: pool.config.bracketScoring.exactPositionPoints ?? 5,
              correctTeamWrongPositionPoints: pool.config.bracketScoring.correctTeamWrongPositionPoints ?? 3,
            });
          }

          setRanking(rankingResponse.data || []);
          const bracketData = bracketResponse.data || {};
          setBracket(bracketData);
          const teamsData = teamsResponse.data || [];
          setTeams(teamsData);
          console.log(`[Admin View] Loaded ${teamsData.length} teams for pool ${firstPoolId}:`, teamsData);
          
          // Initialize bracket results state
          const bracketResultsMap: Record<string, { homeResult: number | ''; awayResult: number | '' }> = {};
          Object.values(bracketData || {}).flat().forEach((match: any) => {
            if (match.bracketMatchId) {
              bracketResultsMap[match.bracketMatchId] = {
                homeResult: match.homeResult !== undefined ? match.homeResult : '',
                awayResult: match.awayResult !== undefined ? match.awayResult : '',
              };
            }
          });
          setBracketResults(bracketResultsMap);

          // Auto-create or update all phases to ensure correct match counts
          let needsRefresh = false;
          for (const phase of PHASES) {
            const phaseMatches = bracketData[phase.key] || [];
            const expectedMatches = phase.matches;
            
            // If phase doesn't exist, create it
            if (phaseMatches.length === 0) {
              try {
                await apiClient.post(`/pools/${firstPoolId}/bracket/phases/${phase.key}`, { 
                  numberOfMatches: expectedMatches 
                });
                needsRefresh = true;
              } catch (err) {
                console.warn(`Failed to auto-create phase ${phase.key}:`, err);
              }
            } 
            // If phase exists but has wrong number of matches, recreate it
            else if (phaseMatches.length !== expectedMatches) {
              try {
                await apiClient.post(`/pools/${firstPoolId}/bracket/phases/${phase.key}`, { 
                  numberOfMatches: expectedMatches,
                  forceRecreate: true
                });
                needsRefresh = true;
              } catch (err) {
                console.warn(`Failed to recreate phase ${phase.key}:`, err);
              }
            }
          }
          
          // Refresh bracket after creating/updating phases
          if (needsRefresh) {
            const updatedBracketResponse = await apiClient.get(`/pools/${firstPoolId}/bracket`);
            const updatedBracketData = updatedBracketResponse.data || {};
            setBracket(updatedBracketData);
            
            // Update bracket results state after refresh
            const updatedBracketResultsMap: Record<string, { homeResult: number | ''; awayResult: number | '' }> = {};
            Object.values(updatedBracketData || {}).flat().forEach((match: any) => {
              if (match.bracketMatchId) {
                updatedBracketResultsMap[match.bracketMatchId] = {
                  homeResult: match.homeResult !== undefined ? match.homeResult : '',
                  awayResult: match.awayResult !== undefined ? match.awayResult : '',
                };
              }
            });
            setBracketResults(updatedBracketResultsMap);
          }
        }
      } catch (err: any) {
        console.error('Failed to fetch data:', err);
        const errorMessage = err.response?.data?.message || t('adminResults.errors.loadData');
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    if (user && user.role === 'admin') {
      fetchData();
    }
  }, [user, t]);

  const handleResultChange = (matchId: string, type: 'home' | 'away', value: string) => {
    const numValue = value === '' ? '' : Math.max(0, parseInt(value, 10) || 0);
    if (value !== '' && (isNaN(parseInt(value, 10)) || parseInt(value, 10) < 0)) return;

    setResults((prev) => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        [type === 'home' ? 'homeResult' : 'awayResult']: numValue === '' ? '' : numValue,
        [type === 'home' ? 'awayResult' : 'homeResult']: prev[matchId]?.[type === 'home' ? 'awayResult' : 'homeResult'] || '',
      },
    }));
  };

  const handleSaveScoringConfig = async () => {
    if (!poolId || poolId === 'all-pools') {
      toast.error(t('adminResults.errors.selectPoolFirst'));
      return;
    }

    try {
      setSavingConfig(true);
      await apiClient.put(`/pools/${poolId}/configuration`, {
        scoring: {
          winnerPoints: scoringConfig.winnerPoints,
          exactResultPoints: scoringConfig.exactResultPoints,
        },
        bracketScoring: {
          exactPositionPoints: bracketScoringConfig.exactPositionPoints,
          correctTeamWrongPositionPoints: bracketScoringConfig.correctTeamWrongPositionPoints,
        },
      });
      toast.success(t('adminResults.toast.scoringSaved'));
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || t('adminResults.errors.saveScoring');
      toast.error(errorMessage);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleSaveResults = async (matchId: string) => {
    const result = results[matchId];
    if (!result || result.homeResult === '' || result.awayResult === '') {
      toast.error(t('adminResults.errors.enterBothResults'));
      return;
    }

    try {
      setSubmitting(matchId);
      const targetPoolId = poolId !== 'all-pools' ? poolId : 'all-pools';
      await apiClient.post(`/pools/${targetPoolId}/matches/${matchId}/results`, {
        homeResult: result.homeResult,
        awayResult: result.awayResult,
      });
      toast.success(t('adminResults.toast.resultsSaved'));
      
      // Refresh ranking
      if (poolId !== 'all-pools') {
        const rankingResponse = await apiClient.get(`/pools/${poolId}/matches/ranking`);
        setRanking(rankingResponse.data || []);
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || t('adminResults.errors.saveResults');
      toast.error(errorMessage);
    } finally {
      setSubmitting(null);
    }
  };

  const handleCreatePhase = async (phase: string, numberOfMatches: number) => {
    if (!poolId || poolId === 'all-pools') {
      toast.error(t('adminResults.errors.selectPoolFirst'));
      return;
    }

    try {
      setCreatingPhase(phase);
      await apiClient.post(`/pools/${poolId}/bracket/phases/${phase}`, { numberOfMatches });
      const phaseLabelKey = PHASES.find((p) => p.key === phase)?.labelKey;
      const phaseLabel = phaseLabelKey ? t(phaseLabelKey) : phase;
      toast.success(t('adminResults.toast.phaseCreated', { phase: phaseLabel }));
      
      const bracketResponse = await apiClient.get(`/pools/${poolId}/bracket`);
      setBracket(bracketResponse.data || {});
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || t('adminResults.errors.createPhase');
      toast.error(errorMessage);
    } finally {
      setCreatingPhase(null);
    }
  };

  const handleUpdateTeam = async (
    bracketMatchId: string,
    side: 'home' | 'away',
    teamId: string,
    teamName: string,
  ) => {
    if (!poolId || poolId === 'all-pools') {
      toast.error(t('adminResults.errors.selectPoolFirst'));
      return;
    }

    try {
      setUpdatingMatch(bracketMatchId);
      await apiClient.put(`/pools/${poolId}/bracket/matches/${bracketMatchId}/team`, {
        side,
        teamId,
        teamName,
      });
      
      const [bracketResponse, teamsResponse] = await Promise.all([
        apiClient.get(`/pools/${poolId}/bracket`),
        apiClient.get(`/pools/${poolId}/matches/teams`).catch(() => ({ data: [] })),
      ]);
      setBracket(bracketResponse.data || {});
      const teamsData = teamsResponse.data || [];
      setTeams(teamsData);
      console.log(`[Admin View] Refreshed ${teamsData.length} teams after team update`);
      
      // Update bracket results state
      const bracketResultsMap: Record<string, { homeResult: number | ''; awayResult: number | '' }> = {};
      Object.values(bracketResponse.data || {}).flat().forEach((match: any) => {
        if (match.bracketMatchId) {
          bracketResultsMap[match.bracketMatchId] = {
            homeResult: match.homeResult !== undefined ? match.homeResult : '',
            awayResult: match.awayResult !== undefined ? match.awayResult : '',
          };
        }
      });
      setBracketResults(bracketResultsMap);
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || t('adminResults.errors.updateTeam');
      toast.error(errorMessage);
    } finally {
      setUpdatingMatch(null);
    }
  };

  const handleBracketResultChange = (bracketMatchId: string, homeResult: number, awayResult: number) => {
    setBracketResults((prev) => ({
      ...prev,
      [bracketMatchId]: {
        homeResult: homeResult || '',
        awayResult: awayResult || '',
      },
    }));
  };

  const handleSaveBracketResult = async (bracketMatchId: string, homeResult: number, awayResult: number) => {
    if (!poolId || poolId === 'all-pools') {
      toast.error(t('adminResults.errors.selectPoolFirst'));
      return;
    }

    if (homeResult === 0 || awayResult === 0) {
      toast.error(t('adminResults.errors.enterBothResults'));
      return;
    }

    try {
      setSubmittingBracketResult(bracketMatchId);
      await apiClient.put(`/pools/${poolId}/bracket/matches/${bracketMatchId}/result`, {
        homeResult,
        awayResult,
      });
      toast.success(t('adminResults.toast.bracketResultSaved'));
      
      // Refresh bracket and ranking
      const [bracketResponse, rankingResponse] = await Promise.all([
        apiClient.get(`/pools/${poolId}/bracket`),
        apiClient.get(`/pools/${poolId}/matches/ranking`).catch(() => ({ data: [] })),
      ]);
      
      setBracket(bracketResponse.data || {});
      setRanking(rankingResponse.data || []);
      
      // Update bracket results state
      const bracketResultsMap: Record<string, { homeResult: number | ''; awayResult: number | '' }> = {};
      Object.values(bracketResponse.data || {}).flat().forEach((match: any) => {
        if (match.bracketMatchId) {
          bracketResultsMap[match.bracketMatchId] = {
            homeResult: match.homeResult !== undefined ? match.homeResult : '',
            awayResult: match.awayResult !== undefined ? match.awayResult : '',
          };
        }
      });
      setBracketResults(bracketResultsMap);
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || t('adminResults.errors.saveBracketResult');
      toast.error(errorMessage);
    } finally {
      setSubmittingBracketResult(null);
    }
  };


  if (loading) {
    return (
      <main style={{ padding: 'var(--spacing-2xl)', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
          <p style={{ color: 'var(--text-secondary)' }}>{t('common.loading')}</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ padding: 'var(--spacing-2xl)', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
          <p style={{ color: '#c62828' }}>{error}</p>
          <button
            onClick={() => router.push('/pools')}
            style={{
              marginTop: 'var(--spacing-md)',
              padding: '0.5rem 1.25rem',
              borderRadius: '999px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 500,
              background: 'var(--accent-primary)',
              color: '#fff',
            }}
          >
            {t('common.backToPools')}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main style={{ padding: 'var(--spacing-2xl)', minHeight: '60vh' }}>
      <div style={{ maxWidth: '1800px', margin: '0 auto' }}>
        <div style={{ marginBottom: 'var(--spacing-lg)' }}>
          <button
            onClick={() => router.push('/pools')}
            style={{
              padding: 'var(--spacing-xs) var(--spacing-md)',
              backgroundColor: 'transparent',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              color: 'var(--text-primary)',
              fontSize: '0.875rem',
            }}
          >
            {`← ${t('common.backToPools')}`}
          </button>
        </div>

        <div style={{
          padding: 'var(--spacing-xl)',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)',
          border: '1px solid var(--border-color)',
          marginBottom: 'var(--spacing-lg)',
        }}>
          <h1 style={{
            fontSize: '2rem',
            fontWeight: '700',
            color: 'var(--text-primary)',
            marginBottom: 'var(--spacing-md)',
          }}>
            {t('adminResults.title')}
          </h1>
        </div>

        {/* Ranking Section - Always Visible */}
        <div style={{
          padding: 'var(--spacing-xl)',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)',
          border: '1px solid var(--border-color)',
          marginBottom: 'var(--spacing-lg)',
        }}>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            color: 'var(--text-primary)',
            marginBottom: 'var(--spacing-lg)',
          }}>
            {t('adminResults.ranking.title')}
          </h2>
          {ranking.length > 0 ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--spacing-sm)',
            }}>
              {ranking.map((entry) => (
                <div
                  key={entry.rank}
                  style={{
                    padding: 'var(--spacing-md)',
                    backgroundColor: 'var(--bg-primary)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-md)',
                  }}>
                    <span style={{
                      fontSize: '1.25rem',
                      fontWeight: '700',
                      color: 'var(--text-secondary)',
                      minWidth: '40px',
                    }}>
                      #{entry.rank}
                    </span>
                    <span style={{
                      fontSize: '1rem',
                      fontWeight: '500',
                      color: 'var(--text-primary)',
                    }}>
                      {entry.userName}
                    </span>
                  </div>
                  <span style={{
                    fontSize: '1.25rem',
                    fontWeight: '700',
                    color: 'var(--accent-primary)',
                  }}>
                    {entry.points} {entry.points === 1 ? t('common.point') : t('common.points')}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{
              color: 'var(--text-secondary)',
              fontSize: '0.875rem',
              fontStyle: 'italic',
              textAlign: 'center',
              padding: 'var(--spacing-md)',
            }}>
              {t('adminResults.ranking.empty')}
            </p>
          )}
        </div>

        {/* Scoring Configuration */}
        <div style={{
          padding: 'var(--spacing-xl)',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)',
          border: '1px solid var(--border-color)',
          marginBottom: 'var(--spacing-lg)',
        }}>
          <h3 style={{
            fontSize: '1rem',
            fontWeight: '600',
            color: 'var(--text-primary)',
            marginBottom: 'var(--spacing-md)',
          }}>
            {t('adminResults.scoring.title')}
          </h3>
          {/* Group phase scoring (results) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 'var(--spacing-md)',
            marginBottom: 'var(--spacing-lg)',
          }}>
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                color: 'var(--text-secondary)',
                marginBottom: 'var(--spacing-xs)',
              }}>
                {t('adminResults.scoring.groupPhaseWinner')}
              </label>
              <input
                type="number"
                min="0"
                value={scoringConfig.winnerPoints}
                onChange={(e) => {
                  const value = parseInt(e.target.value, 10) || 0;
                  setScoringConfig(prev => ({ ...prev, winnerPoints: value }));
                }}
                style={{
                  width: '100%',
                  padding: 'var(--spacing-xs)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: '1rem',
                }}
              />
            </div>
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                color: 'var(--text-secondary)',
                marginBottom: 'var(--spacing-xs)',
              }}>
                {t('adminResults.scoring.groupPhaseExact')}
              </label>
              <input
                type="number"
                min="0"
                value={scoringConfig.exactResultPoints}
                onChange={(e) => {
                  const value = parseInt(e.target.value, 10) || 0;
                  setScoringConfig(prev => ({ ...prev, exactResultPoints: value }));
                }}
                style={{
                  width: '100%',
                  padding: 'var(--spacing-xs)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: '1rem',
                }}
              />
            </div>
          </div>

          {/* Final phase bracket scoring (applies to all rounds of the final phase) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 'var(--spacing-md)',
          }}>
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                color: 'var(--text-secondary)',
                marginBottom: 'var(--spacing-xs)',
              }}>
                {t('adminResults.scoring.finalExactPosition')}
              </label>
              <input
                type="number"
                min="0"
                value={bracketScoringConfig.exactPositionPoints}
                onChange={(e) => {
                  const value = parseInt(e.target.value, 10) || 0;
                  setBracketScoringConfig(prev => ({ ...prev, exactPositionPoints: value }));
                }}
                style={{
                  width: '100%',
                  padding: 'var(--spacing-xs)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: '1rem',
                }}
              />
            </div>
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                color: 'var(--text-secondary)',
                marginBottom: 'var(--spacing-xs)',
              }}>
                {t('adminResults.scoring.finalCorrectWrongPosition')}
              </label>
              <input
                type="number"
                min="0"
                value={bracketScoringConfig.correctTeamWrongPositionPoints}
                onChange={(e) => {
                  const value = parseInt(e.target.value, 10) || 0;
                  setBracketScoringConfig(prev => ({ ...prev, correctTeamWrongPositionPoints: value }));
                }}
                style={{
                  width: '100%',
                  padding: 'var(--spacing-xs)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: '1rem',
                }}
              />
            </div>
          </div>
          <button
            onClick={handleSaveScoringConfig}
            disabled={savingConfig || poolId === 'all-pools'}
            style={{
              marginTop: 'var(--spacing-md)',
              padding: 'var(--spacing-xs) var(--spacing-md)',
              backgroundColor: poolId === 'all-pools' ? 'var(--bg-secondary)' : 'var(--accent-primary)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              cursor: savingConfig || poolId === 'all-pools' ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500',
              opacity: savingConfig || poolId === 'all-pools' ? 0.6 : 1,
            }}
          >
            {savingConfig ? t('common.saving') : t('adminResults.scoring.save')}
          </button>
        </div>

        {/* Group Phase - Collapsible */}
        <div style={{
          padding: 'var(--spacing-xl)',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)',
          border: '1px solid var(--border-color)',
          marginBottom: 'var(--spacing-lg)',
        }}>
          <h2
            onClick={() => setGroupPhaseExpanded(!groupPhaseExpanded)}
            style={{
              fontSize: '1.5rem',
              fontWeight: '600',
              color: 'var(--text-primary)',
              marginBottom: groupPhaseExpanded ? 'var(--spacing-lg)' : 0,
              paddingBottom: groupPhaseExpanded ? 'var(--spacing-md)' : 0,
              borderBottom: groupPhaseExpanded ? '2px solid var(--border-color)' : 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              userSelect: 'none',
            }}
          >
            <span>{t('adminResults.groupPhase.title')}</span>
            <span style={{
              fontSize: '1.2rem',
              transition: 'transform 0.2s ease',
              transform: groupPhaseExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
            }}>
              ▼
            </span>
          </h2>

          {groupPhaseExpanded && (
            <div>
              {groups.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
                  {groups.map((group) => {
                    const isExpanded = expandedGroups[group] !== false;

                    return (
                      <div
                        key={group}
                        style={{
                          padding: 'var(--spacing-xl)',
                          backgroundColor: 'var(--bg-primary)',
                          borderRadius: 'var(--radius-lg)',
                          boxShadow: 'var(--shadow-sm)',
                          border: '1px solid var(--border-color)',
                        }}
                      >
                        <h3
                          onClick={() => {
                            setExpandedGroups((prev) => ({
                              ...prev,
                              [group]: !isExpanded,
                            }));
                          }}
                          style={{
                            fontSize: '1.25rem',
                            fontWeight: '600',
                            color: 'var(--text-primary)',
                            marginBottom: isExpanded ? 'var(--spacing-lg)' : 0,
                            paddingBottom: isExpanded ? 'var(--spacing-md)' : 0,
                            borderBottom: isExpanded ? '2px solid var(--border-color)' : 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            userSelect: 'none',
                          }}
                        >
                          <span>{t('adminResults.groupPhase.group', { group })}</span>
                          <span style={{
                            fontSize: '1.2rem',
                            transition: 'transform 0.2s ease',
                            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                          }}>
                            ▼
                          </span>
                        </h3>

                        {isExpanded && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                            {matchesByGroup[group]?.map((match) => {
                              const result = results[match.matchId] || { homeResult: '', awayResult: '' };
                              const matchDate = new Date(match.scheduledAt).toLocaleDateString(locale, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              });
                              const hasResults = result.homeResult !== '' && result.awayResult !== '';

                              return (
                                <div
                                  key={match.matchId}
                                  style={{
                                    padding: 'var(--spacing-md)',
                                    backgroundColor: 'var(--bg-secondary)',
                                    borderRadius: 'var(--radius-md)',
                                    border: '2px solid var(--border-color)',
                                  }}
                                >
                                  <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 'var(--spacing-md)',
                                    flexWrap: 'wrap',
                                  }}>
                                    <div style={{ flex: 1, minWidth: '120px' }}>
                                      <p style={{
                                        fontSize: '0.875rem',
                                        color: 'var(--text-secondary)',
                                        margin: 0,
                                        marginBottom: 'var(--spacing-xs)',
                                      }}>
                                        {matchDate}
                                      </p>
                                      <p style={{
                                        fontSize: '1rem',
                                        fontWeight: '500',
                                        color: 'var(--text-primary)',
                                        margin: 0,
                                      }}>
                                        {match.homeTeamName}
                                      </p>
                                    </div>

                                    <div style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 'var(--spacing-sm)',
                                    }}>
                                      <input
                                        type="number"
                                        min="0"
                                        value={result.homeResult === '' ? '' : result.homeResult}
                                        onChange={(e) => {
                                          const value = e.target.value;
                                          if (value === '' || /^\d+$/.test(value)) {
                                            handleResultChange(match.matchId, 'home', value);
                                          }
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === '-' || e.key === '.' || e.key === 'e' || e.key === 'E') {
                                            e.preventDefault();
                                          }
                                        }}
                                        style={{
                                          width: '60px',
                                          padding: 'var(--spacing-xs)',
                                          textAlign: 'center',
                                          fontSize: '1.25rem',
                                          fontWeight: '600',
                                          border: '2px solid var(--border-color)',
                                          borderRadius: 'var(--radius-sm)',
                                          backgroundColor: 'var(--bg-primary)',
                                          color: 'var(--text-primary)',
                                          cursor: 'text',
                                        }}
                                      />
                                      <span style={{
                                        fontSize: '1.25rem',
                                        fontWeight: '600',
                                        color: 'var(--text-secondary)',
                                      }}>
                                        -
                                      </span>
                                      <input
                                        type="number"
                                        min="0"
                                        value={result.awayResult === '' ? '' : result.awayResult}
                                        onChange={(e) => {
                                          const value = e.target.value;
                                          if (value === '' || /^\d+$/.test(value)) {
                                            handleResultChange(match.matchId, 'away', value);
                                          }
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === '-' || e.key === '.' || e.key === 'e' || e.key === 'E') {
                                            e.preventDefault();
                                          }
                                        }}
                                        style={{
                                          width: '60px',
                                          padding: 'var(--spacing-xs)',
                                          textAlign: 'center',
                                          fontSize: '1.25rem',
                                          fontWeight: '600',
                                          border: '2px solid var(--border-color)',
                                          borderRadius: 'var(--radius-sm)',
                                          backgroundColor: 'var(--bg-primary)',
                                          color: 'var(--text-primary)',
                                          cursor: 'text',
                                        }}
                                      />
                                    </div>

                                    <div style={{ flex: 1, minWidth: '120px', textAlign: 'right' }}>
                                      <p style={{
                                        fontSize: '1rem',
                                        fontWeight: '500',
                                        color: 'var(--text-primary)',
                                        margin: 0,
                                      }}>
                                        {match.awayTeamName}
                                      </p>
                                    </div>

                                    <button
                                      onClick={() => handleSaveResults(match.matchId)}
                                      disabled={submitting === match.matchId || result.homeResult === '' || result.awayResult === ''}
                                      style={{
                                        padding: 'var(--spacing-xs) var(--spacing-md)',
                                        backgroundColor: 'var(--accent-primary)',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: 'var(--radius-md)',
                                        cursor: submitting === match.matchId || result.homeResult === '' || result.awayResult === '' ? 'not-allowed' : 'pointer',
                                        fontSize: '0.875rem',
                                        fontWeight: '500',
                                        opacity: submitting === match.matchId || result.homeResult === '' || result.awayResult === '' ? 0.6 : 1,
                                      }}
                                    >
                                      {submitting === match.matchId ? t('common.saving') : hasResults ? t('common.update') : t('common.save')}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p style={{
                  color: 'var(--text-secondary)',
                  fontSize: '0.875rem',
                  textAlign: 'center',
                  padding: 'var(--spacing-md)',
                }}>
                  {t('adminResults.groupPhase.empty')}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Final Phase - Collapsible */}
        <div style={{
          padding: 'var(--spacing-lg)',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)',
          border: '1px solid var(--border-color)',
          marginBottom: 'var(--spacing-md)',
        }}>
          <h2
            onClick={() => setFinalPhaseExpanded(!finalPhaseExpanded)}
            style={{
              fontSize: '1.5rem',
              fontWeight: '600',
              color: 'var(--text-primary)',
              marginBottom: finalPhaseExpanded ? 'var(--spacing-lg)' : 0,
              paddingBottom: finalPhaseExpanded ? 'var(--spacing-md)' : 0,
              borderBottom: finalPhaseExpanded ? '2px solid var(--border-color)' : 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              userSelect: 'none',
            }}
          >
            <span>{t('adminResults.finalPhase.title')}</span>
            <span style={{
              fontSize: '1.2rem',
              transition: 'transform 0.2s ease',
              transform: finalPhaseExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
            }}>
              ▼
            </span>
          </h2>

          {finalPhaseExpanded && (
            <div>
              <p style={{
                color: 'var(--text-secondary)',
                fontSize: '0.875rem',
                margin: '0 0 var(--spacing-lg) 0',
              }}>
                {t('adminResults.finalPhase.description')}
              </p>

              {/* Tournament Bracket Visualization - Full Tree with All Matches */}
              <BracketVisualization
                bracket={bracket}
                teams={teams}
                poolId={poolId}
                mode="admin"
                updatingMatch={updatingMatch}
                onUpdateTeam={handleUpdateTeam}
                onBracketResultChange={handleBracketResultChange}
                onUpdateResult={handleSaveBracketResult}
                bracketResults={bracketResults}
                submittingResult={submittingBracketResult}
              />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default function AdminResultsPage() {
  return (
    <ProtectedRoute>
      <AdminResultsContent />
    </ProtectedRoute>
  );
}
