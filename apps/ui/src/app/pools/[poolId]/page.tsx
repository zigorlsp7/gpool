'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
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

interface Prediction {
  matchId: string;
  homeScore: number;
  awayScore: number;
  isCorrect?: boolean;
  isExactMatch?: boolean;
  points?: number;
}

function PoolDetailContent() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { t, locale } = useI18n();
  const poolId = typeof params?.poolId === 'string' ? params.poolId : Array.isArray(params?.poolId) ? params.poolId[0] : '';

  const [pool, setPool] = useState<any>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [matchesByGroup, setMatchesByGroup] = useState<Record<string, Match[]>>({});
  const [groups, setGroups] = useState<string[]>([]);
  const [predictions, setPredictions] = useState<Record<string, Prediction>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [saveTimers, setSaveTimers] = useState<Record<string, NodeJS.Timeout>>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [ranking, setRanking] = useState<Array<{ rank: number; userName: string; points: number }>>([]);
  const [bracket, setBracket] = useState<Record<string, any[]>>({});
  const [bracketPredictions, setBracketPredictions] = useState<Record<string, any>>({});
  const [teams, setTeams] = useState<Array<{ teamId: string; name: string; group?: string; code?: string }>>([]);
  const [expandedGroupPhase, setExpandedGroupPhase] = useState(true);
  const [expandedFinalPhase, setExpandedFinalPhase] = useState(true);
  const [bracketScoringConfig, setBracketScoringConfig] = useState({ exactPositionPoints: 5, correctTeamWrongPositionPoints: 3 });

  // Countdown timer for June 7th 2026 midnight (end of June 7th = start of June 8th)
  // Deadline is June 8th 00:00:00 UTC, meaning predictions are disabled when June 8th starts
  const deadline = new Date('2026-06-08T00:00:00Z').getTime();

  useEffect(() => {
    const updateCountdown = () => {
      const now = Date.now();
      const diff = deadline - now;

      if (diff <= 0) {
        setTimeRemaining(t('poolDetail.deadline.passedShort'));
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      // Show days until less than 1 day remaining
      if (days > 0) {
        setTimeRemaining(`${days}d`);
      } else if (hours > 0) {
        // Show hours until less than 1 hour remaining
        setTimeRemaining(`${hours}h`);
      } else {
        // Show minutes when less than 1 hour remaining
        setTimeRemaining(`${minutes}m`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [deadline, t]);

  useEffect(() => {
    if (!poolId) {
      setError(t('poolDetail.errors.invalidPoolId'));
      setLoading(false);
      return;
    }

        const fetchData = async () => {
      try {
        setLoading(true);
        const [poolResponse, matchesResponse, predictionsResponse, rankingResponse, bracketResponse, bracketPredictionsResponse, teamsResponse] = await Promise.all([
          apiClient.get(`/pools/${poolId}`),
          apiClient.get(`/pools/${poolId}/matches`),
          apiClient.get(`/pools/${poolId}/matches/predictions`).catch(() => ({ data: [] })), // Handle case where user has no predictions
          apiClient.get(`/pools/${poolId}/matches/ranking`).catch(() => ({ data: [] })), // Handle case where ranking is empty
          apiClient.get(`/pools/${poolId}/bracket`).catch(() => ({ data: {} })), // Handle case where bracket doesn't exist
          apiClient.get(`/pools/${poolId}/bracket/predictions`).catch(() => ({ data: [] })), // Handle case where user has no bracket predictions
          apiClient.get(`/pools/${poolId}/matches/teams`).catch(() => ({ data: [] })), // Handle case where teams don't exist
        ]);

        setPool(poolResponse.data);
        const matchesData = matchesResponse.data || {};
        setMatches(matchesData.matches || []);
        setMatchesByGroup(matchesData.matchesByGroup || {});
        setGroups(matchesData.groups || []);
        
        // Debug logging
        console.log('Matches response:', matchesResponse.data);
        console.log('Matches:', matchesData.matches);
        console.log('Groups:', matchesData.groups);

        // Convert predictions array to map
        const predictionsMap: Record<string, Prediction> = {};
        (predictionsResponse.data || []).forEach((pred: any) => {
          predictionsMap[pred.matchId] = {
            matchId: pred.matchId,
            homeScore: pred.homeScore,
            awayScore: pred.awayScore,
            isCorrect: pred.isCorrect,
            isExactMatch: pred.isExactMatch,
            points: pred.points,
          };
        });
        setPredictions(predictionsMap);

        // Set ranking
        setRanking(rankingResponse.data || []);

        // Set bracket data
        setBracket(bracketResponse.data || {});

        // Set bracket predictions
        const bracketPredictionsMap: Record<string, any> = {};
        (bracketPredictionsResponse.data || []).forEach((pred: any) => {
          bracketPredictionsMap[pred.bracketMatchId] = pred;
        });
        setBracketPredictions(bracketPredictionsMap);
        
        // Debug: Log bracket predictions to verify evaluation fields
        console.log('Bracket predictions:', bracketPredictionsMap);
        console.log('Bracket matches with results:', (bracketResponse.data || {}));
        
        // Log ALL bracket matches to see their structure
        const allBracketMatches = Object.values(bracketResponse.data || {}).flat();
        console.log('All bracket matches:', allBracketMatches);
        console.log('Number of bracket matches:', allBracketMatches.length);
        
        // Log first few matches in detail to see their structure
        allBracketMatches.slice(0, 3).forEach((match: any, index: number) => {
          console.log(`[DEBUG] Bracket match ${index}:`, {
            bracketMatchId: match.bracketMatchId,
            phase: match.phase,
            matchNumber: match.matchNumber,
            homeTeamId: match.homeTeamId,
            homeTeamName: match.homeTeamName,
            awayTeamId: match.awayTeamId,
            awayTeamName: match.awayTeamName,
            homeResult: match.homeResult,
            awayResult: match.awayResult,
            homeResultType: typeof match.homeResult,
            awayResultType: typeof match.awayResult,
            homeResultUndefined: match.homeResult === undefined,
            awayResultUndefined: match.awayResult === undefined,
            homeResultNull: match.homeResult === null,
            awayResultNull: match.awayResult === null,
            status: match.status,
            allKeys: Object.keys(match),
          });
        });
        
        // Log matches that have results but predictions might not be evaluated
        let matchesWithResults = 0;
        let matchesWithPredictions = 0;
        let matchesWithResultsAndPredictions = 0;
        
        allBracketMatches.forEach((match: any) => {
          const hasResults = match.homeResult !== undefined && match.awayResult !== undefined && match.homeResult !== null && match.awayResult !== null;
          const pred = bracketPredictionsMap[match.bracketMatchId];
          const hasPrediction = !!pred;
          
          if (hasResults) matchesWithResults++;
          if (hasPrediction) matchesWithPredictions++;
          if (hasResults && hasPrediction) {
            matchesWithResultsAndPredictions++;
            console.log(`[DEBUG] Match ${match.bracketMatchId} has results AND prediction:`, {
              match: {
                bracketMatchId: match.bracketMatchId,
                phase: match.phase,
                homeTeamId: match.homeTeamId,
                homeTeamName: match.homeTeamName,
                awayTeamId: match.awayTeamId,
                awayTeamName: match.awayTeamName,
                homeResult: match.homeResult,
                awayResult: match.awayResult,
              },
              prediction: {
                bracketMatchId: pred.bracketMatchId,
                homeTeamId: pred.homeTeamId,
                homeTeamName: pred.homeTeamName,
                awayTeamId: pred.awayTeamId,
                awayTeamName: pred.awayTeamName,
                isEvaluated: pred.isEvaluated,
                homeTeamExactPosition: pred.homeTeamExactPosition,
                awayTeamExactPosition: pred.awayTeamExactPosition,
                homeTeamCorrectButWrongPosition: pred.homeTeamCorrectButWrongPosition,
                awayTeamCorrectButWrongPosition: pred.awayTeamCorrectButWrongPosition,
                points: pred.points,
              },
            });
          }
        });
        
        console.log(`[DEBUG] Summary: ${matchesWithResults} matches with results, ${matchesWithPredictions} matches with predictions, ${matchesWithResultsAndPredictions} matches with both`);

        // Set teams
        setTeams(teamsResponse.data || []);

        setError(null);
      } catch (err: any) {
        console.error('Failed to fetch data:', err);
        const errorMessage = err.response?.data?.message || t('poolDetail.errors.loadPool');
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchData();
    }
  }, [poolId, user, t]);

  const handleScoreChange = (matchId: string, type: 'home' | 'away', value: string) => {
    // Prevent negative numbers
    const numValue = value === '' ? '' : Math.max(0, parseInt(value, 10) || 0);
    if (value !== '' && (isNaN(parseInt(value, 10)) || parseInt(value, 10) < 0)) return;

    setPredictions((prev) => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        matchId,
        [type === 'home' ? 'homeScore' : 'awayScore']: numValue === '' ? '' : numValue,
        [type === 'home' ? 'awayScore' : 'homeScore']: prev[matchId]?.[type === 'home' ? 'awayScore' : 'homeScore'] || '',
      },
    }));

    // Auto-save with debouncing (500ms delay)
    const existingTimer = saveTimers[matchId];
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      // Get the latest prediction from state
      setPredictions((currentPredictions) => {
        const latestPrediction = currentPredictions[matchId];
        if (latestPrediction) {
          autoSavePrediction(matchId, latestPrediction);
        }
        return currentPredictions;
      });
      setSaveTimers((prev) => {
        const newTimers = { ...prev };
        delete newTimers[matchId];
        return newTimers;
      });
    }, 500);

    setSaveTimers((prev) => ({
      ...prev,
      [matchId]: timer,
    }));
  };

  const autoSavePrediction = async (matchId: string, prediction: Prediction) => {
    if (!prediction) return;

    // Don't save if both scores are empty or one is empty
    const homeScore = typeof prediction.homeScore === 'number' ? prediction.homeScore : (prediction.homeScore === '' ? 0 : parseInt(String(prediction.homeScore), 10) || 0);
    const awayScore = typeof prediction.awayScore === 'number' ? prediction.awayScore : (prediction.awayScore === '' ? 0 : parseInt(String(prediction.awayScore), 10) || 0);
    
    if (homeScore === 0 && awayScore === 0) {
      return; // Don't save empty predictions
    }

    // If one score is empty, don't save but don't show error (user is still typing)
    if (prediction.homeScore === '' || prediction.awayScore === '') {
      return;
    }

    const match = matches.find((m) => m.matchId === matchId);
    // Check if deadline has passed (current time >= deadline)
    if (match && match.deadline && Date.now() >= match.deadline) {
      return; // Deadline passed, don't try to save
    }

    try {
      setSubmitting(matchId);
      await apiClient.post(`/pools/${poolId}/matches/${matchId}/predict`, {
        homeScore,
        awayScore,
      });
      // Silent save - no toast notification for auto-save
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || t('poolDetail.errors.savePrediction');
      toast.error(errorMessage);
    } finally {
      setSubmitting(null);
    }
  };

  const isDeadlinePassed = Date.now() > deadline;

  if (loading) {
    return (
      <main style={{ padding: 'var(--spacing-2xl)', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
          <p style={{ color: 'var(--text-secondary)' }}>{t('poolDetail.loading')}</p>
        </div>
      </main>
    );
  }

  if (error || !pool) {
    return (
      <main style={{ padding: 'var(--spacing-2xl)', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
          <p style={{ color: '#c62828' }}>{error || t('poolDetail.errors.notFound')}</p>
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
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ 
          marginBottom: 'var(--spacing-lg)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
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
          
          {user?.role === 'admin' && (
            <button
              onClick={() => router.push('/pools/admin/results')}
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
              {`⚙️ ${t('poolDetail.actions.administrate')}`}
            </button>
          )}
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
            {pool.name}
          </h1>

          {pool.description && (
            <p style={{
              color: 'var(--text-secondary)',
              fontSize: '1rem',
              marginBottom: 'var(--spacing-lg)',
            }}>
              {pool.description}
            </p>
          )}

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 'var(--spacing-md)',
            marginTop: 'var(--spacing-xl)',
          }}>
            <div style={{
              padding: 'var(--spacing-md)',
              backgroundColor: 'rgba(67, 86, 99, 0.05)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(67, 86, 99, 0.2)',
            }}>
              <p style={{
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
                margin: 0,
                marginBottom: 'var(--spacing-xs)',
              }}>
                {t('poolDetail.info.owner')}
              </p>
              <p style={{
                fontSize: '1rem',
                color: 'var(--text-primary)',
                margin: 0,
                fontWeight: '500',
              }}>
                {pool.adminName || pool.adminEmail || t('pools.card.unknownOwner')}
              </p>
            </div>

            <div style={{
              padding: 'var(--spacing-md)',
              backgroundColor: 'rgba(67, 86, 99, 0.05)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(67, 86, 99, 0.2)',
            }}>
              <p style={{
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
                margin: 0,
                marginBottom: 'var(--spacing-xs)',
              }}>
                {t('poolDetail.info.members')}
              </p>
              <p style={{
                fontSize: '1rem',
                color: 'var(--text-primary)',
                margin: 0,
                fontWeight: '500',
              }}>
                {pool.memberCount || (pool.members ? pool.members.length : 0)}
              </p>
            </div>

          </div>

          {/* Countdown Timer - Blue Warning Container */}
          <div style={{
            width: '100%',
            marginTop: 'var(--spacing-xl)',
            padding: 'var(--spacing-md)',
            backgroundColor: '#e3f2fd',
            borderRadius: 'var(--radius-md)',
            border: '1px solid #2196F3',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-md)',
          }}>
            <span style={{
              fontSize: '1.5rem',
              color: '#2196F3',
            }}>
              ⚠️
            </span>
            <div style={{ flex: 1 }}>
              <p style={{
                fontSize: '0.875rem',
                color: '#1565C0',
                margin: 0,
                marginBottom: 'var(--spacing-xs)',
                fontWeight: '500',
              }}>
                {t('poolDetail.deadline.groupPhase')}
              </p>
              <p style={{
                fontSize: '1.5rem',
                fontWeight: '700',
                color: '#1565C0',
                margin: 0,
              }}>
                {isDeadlinePassed ? t('poolDetail.deadline.passed') : timeRemaining}
              </p>
              <p style={{
                fontSize: '0.75rem',
                color: '#1565C0',
                margin: 0,
                marginTop: '4px',
                opacity: 0.8,
              }}>
                {new Date(deadline).toLocaleDateString(locale, {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Ranking Section */}
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
            {t('poolDetail.ranking.title')}
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
              {t('poolDetail.ranking.empty')}
            </p>
          )}
        </div>

        {/* Group Phase Section */}
        <div style={{
          padding: 'var(--spacing-xl)',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)',
          border: '1px solid var(--border-color)',
          marginBottom: 'var(--spacing-lg)',
        }}>
          <h2 
            onClick={() => setExpandedGroupPhase(!expandedGroupPhase)}
            style={{
              fontSize: '1.5rem',
              fontWeight: '600',
              color: 'var(--text-primary)',
              marginBottom: expandedGroupPhase ? 'var(--spacing-lg)' : 0,
              paddingBottom: expandedGroupPhase ? 'var(--spacing-md)' : 0,
              borderBottom: expandedGroupPhase ? '2px solid var(--border-color)' : 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              userSelect: 'none',
            }}
          >
            <span>{t('poolDetail.groupPhase.title')}</span>
            <span style={{
              fontSize: '1.2rem',
              transition: 'transform 0.2s ease',
              transform: expandedGroupPhase ? 'rotate(180deg)' : 'rotate(0deg)',
            }}>
              ▼
            </span>
          </h2>

          {expandedGroupPhase && (
            <>
              {/* Matches by Group */}
              {groups.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
                  {groups.map((group) => {
              const isExpanded = expandedGroups[group] !== false; // Default to true
              
              return (
              <div
                key={group}
                style={{
                  padding: 'var(--spacing-xl)',
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-lg)',
                  boxShadow: 'var(--shadow-sm)',
                  border: '1px solid var(--border-color)',
                }}
              >
                <h2 
                  onClick={() => {
                    setExpandedGroups((prev) => ({
                      ...prev,
                      [group]: !isExpanded,
                    }));
                  }}
                  style={{
                    fontSize: '1.5rem',
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
                  <span>{t('poolDetail.groupPhase.group', { group })}</span>
                  <span style={{
                    fontSize: '1.2rem',
                    transition: 'transform 0.2s ease',
                    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  }}>
                    ▼
                  </span>
                </h2>

                {isExpanded && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                    {matchesByGroup[group]?.map((match) => {
                    const prediction = predictions[match.matchId] || { homeScore: '', awayScore: '' };
                    const matchDeadline = match.deadline || deadline;
                    // Check if deadline has passed (current time >= deadline)
                    const isMatchDeadlinePassed = Date.now() >= matchDeadline;
                    const matchDate = new Date(match.scheduledAt).toLocaleDateString(locale, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    });

                    // Check if match has results
                    const hasResults = match.homeResult !== undefined && match.awayResult !== undefined;
                    // Determine prediction status
                    const isExactMatch = hasResults && prediction.isExactMatch === true;
                    const isCorrectWinner = hasResults && prediction.isCorrect === true && !isExactMatch;
                    const isCorrect = hasResults && (prediction.isCorrect === true);
                    const isIncorrect = hasResults && !isCorrect && prediction.homeScore !== '' && prediction.awayScore !== '';
                    const pointsEarned = prediction.points || 0;

                    // Check if prediction is incomplete (one score is empty)
                    const isIncomplete = !isMatchDeadlinePassed && !hasResults && (
                      prediction.homeScore === '' || 
                      prediction.awayScore === '' ||
                      (prediction.homeScore === 0 && prediction.awayScore === 0)
                    );

                    return (
                      <div
                        key={match.matchId}
                        style={{
                          padding: 'var(--spacing-md)',
                          backgroundColor: isMatchDeadlinePassed 
                            ? 'rgba(0, 0, 0, 0.02)' 
                            : isIncorrect
                            ? 'rgba(244, 67, 54, 0.1)'
                            : isExactMatch
                            ? 'rgba(33, 150, 243, 0.1)'
                            : isCorrectWinner
                            ? 'rgba(76, 175, 80, 0.1)'
                            : isIncomplete 
                            ? 'rgba(244, 67, 54, 0.1)' 
                            : 'var(--bg-primary)',
                          borderRadius: 'var(--radius-md)',
                          border: `2px solid ${
                            isMatchDeadlinePassed 
                              ? 'var(--border-color)' 
                              : isIncorrect
                              ? '#f44336'
                              : isExactMatch
                              ? '#2196F3'
                              : isCorrectWinner
                              ? '#4caf50'
                              : isIncomplete 
                              ? '#f44336' 
                              : 'var(--border-color)'
                          }`,
                          opacity: isMatchDeadlinePassed ? 0.7 : 1,
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
                              value={prediction.homeScore === '' ? '' : prediction.homeScore}
                              onChange={(e) => {
                                const value = e.target.value;
                                // Only allow digits or empty string
                                if (value === '' || /^\d+$/.test(value)) {
                                  handleScoreChange(match.matchId, 'home', value);
                                }
                              }}
                              onKeyDown={(e) => {
                                // Prevent negative sign, decimal point, and 'e'
                                if (e.key === '-' || e.key === '.' || e.key === 'e' || e.key === 'E') {
                                  e.preventDefault();
                                }
                              }}
                              disabled={isMatchDeadlinePassed}
                              style={{
                                width: '60px',
                                padding: 'var(--spacing-xs)',
                                textAlign: 'center',
                                fontSize: '1.25rem',
                                fontWeight: '600',
                                border: `2px solid ${isIncomplete ? '#f44336' : 'var(--border-color)'}`,
                                borderRadius: 'var(--radius-sm)',
                                backgroundColor: isMatchDeadlinePassed ? 'var(--bg-secondary)' : 'var(--bg-primary)',
                                color: 'var(--text-primary)',
                                cursor: isMatchDeadlinePassed ? 'not-allowed' : 'text',
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
                              value={prediction.awayScore === '' ? '' : prediction.awayScore}
                              onChange={(e) => {
                                const value = e.target.value;
                                // Only allow digits or empty string
                                if (value === '' || /^\d+$/.test(value)) {
                                  handleScoreChange(match.matchId, 'away', value);
                                }
                              }}
                              onKeyDown={(e) => {
                                // Prevent negative sign, decimal point, and 'e'
                                if (e.key === '-' || e.key === '.' || e.key === 'e' || e.key === 'E') {
                                  e.preventDefault();
                                }
                              }}
                              disabled={isMatchDeadlinePassed}
                              style={{
                                width: '60px',
                                padding: 'var(--spacing-xs)',
                                textAlign: 'center',
                                fontSize: '1.25rem',
                                fontWeight: '600',
                                border: `2px solid ${isIncomplete ? '#f44336' : 'var(--border-color)'}`,
                                borderRadius: 'var(--radius-sm)',
                                backgroundColor: isMatchDeadlinePassed ? 'var(--bg-secondary)' : 'var(--bg-primary)',
                                color: 'var(--text-primary)',
                                cursor: isMatchDeadlinePassed ? 'not-allowed' : 'text',
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

                          {!isMatchDeadlinePassed && submitting === match.matchId && (
                            <span style={{
                              fontSize: '0.875rem',
                              color: 'var(--text-secondary)',
                              fontStyle: 'italic',
                            }}>
                              {t('common.saving')}
                            </span>
                          )}
                          {hasResults && (
                            <div style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'flex-end',
                              gap: '2px',
                            }}>
                              <span style={{
                                fontSize: '0.75rem',
                                color: 'var(--text-secondary)',
                                fontWeight: '500',
                              }}>
                                {t('poolDetail.match.result', { home: match.homeResult ?? '-', away: match.awayResult ?? '-' })}
                              </span>
                              {isExactMatch && (
                                <span style={{
                                  fontSize: '0.75rem',
                                  color: '#2196F3',
                                  fontWeight: '600',
                                }}>
                                  {t('poolDetail.match.exactResultPoints', { points: pointsEarned })}
                                </span>
                              )}
                              {isCorrectWinner && (
                                <span style={{
                                  fontSize: '0.75rem',
                                  color: '#4caf50',
                                  fontWeight: '600',
                                }}>
                                  {t('poolDetail.match.correctWinnerPoints', { points: pointsEarned })}
                                </span>
                              )}
                              {isIncorrect && (
                                <span style={{
                                  fontSize: '0.75rem',
                                  color: '#f44336',
                                  fontWeight: '600',
                                }}>
                                  {t('poolDetail.match.incorrect')}
                                </span>
                              )}
                            </div>
                          )}
                          {!hasResults && isIncomplete && !isMatchDeadlinePassed && (
                            <span style={{
                              fontSize: '0.75rem',
                              color: '#f44336',
                              fontWeight: '500',
                            }}>
                              {t('poolDetail.match.incomplete')}
                            </span>
                          )}
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
          <div style={{
            padding: 'var(--spacing-xl)',
            textAlign: 'center',
            color: 'var(--text-secondary)',
          }}>
            <p>{t('poolDetail.groupPhase.noMatches')}</p>
          </div>
        )}
            </>
          )}
        </div>

        {/* Final Phase Section */}
        <div style={{
          padding: 'var(--spacing-lg)',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)',
          border: '1px solid var(--border-color)',
          marginBottom: 'var(--spacing-md)',
        }}>
          <h2 
            onClick={() => setExpandedFinalPhase(!expandedFinalPhase)}
            style={{
              fontSize: '1.5rem',
              fontWeight: '600',
              color: 'var(--text-primary)',
              marginBottom: expandedFinalPhase ? 'var(--spacing-md)' : 0,
              paddingBottom: expandedFinalPhase ? 'var(--spacing-sm)' : 0,
              borderBottom: expandedFinalPhase ? '2px solid var(--border-color)' : 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              userSelect: 'none',
            }}
          >
            <span>{t('poolDetail.finalPhase.title')}</span>
            <span style={{
              fontSize: '1.2rem',
              transition: 'transform 0.2s ease',
              transform: expandedFinalPhase ? 'rotate(180deg)' : 'rotate(0deg)',
            }}>
              ▼
            </span>
          </h2>

          {expandedFinalPhase && (
            <div style={{ marginTop: 'var(--spacing-md)' }}>
              {Object.keys(bracket).length > 0 ? (
                <BracketVisualization
                  bracket={bracket}
                  teams={teams}
                  poolId={poolId}
                  mode="user"
                  bracketPredictions={bracketPredictions}
                  deadline={deadline}
                  exactPositionPoints={bracketScoringConfig.exactPositionPoints}
                  correctTeamWrongPositionPoints={bracketScoringConfig.correctTeamWrongPositionPoints}
                  onPredictionChange={async (bracketMatchId: string, side: 'home' | 'away', teamId: string, teamName: string) => {
                    // Check if deadline has passed
                    if (Date.now() >= deadline) {
                      toast.error(t('poolDetail.finalPhase.deadlinePassed'));
                      return;
                    }

                    try {
                      const prediction = bracketPredictions[bracketMatchId];
                      const updates: any = {};
                      if (side === 'home') {
                        updates.homeTeamId = teamId;
                        updates.homeTeamName = teamName;
                        updates.awayTeamId = prediction?.awayTeamId || '';
                        updates.awayTeamName = prediction?.awayTeamName || '';
                      } else {
                        updates.homeTeamId = prediction?.homeTeamId || '';
                        updates.homeTeamName = prediction?.homeTeamName || '';
                        updates.awayTeamId = teamId;
                        updates.awayTeamName = teamName;
                      }

                      await apiClient.post(`/pools/${poolId}/bracket/matches/${bracketMatchId}/predict`, updates);
                      
                      // Update local state
                      setBracketPredictions((prev) => ({
                        ...prev,
                        [bracketMatchId]: {
                          ...prediction,
                          ...updates,
                        },
                      }));

                      toast.success(t('poolDetail.finalPhase.predictionSaved'));
                    } catch (err: any) {
                      console.error('Failed to save bracket prediction:', err);
                      toast.error(err.response?.data?.message || t('poolDetail.errors.savePrediction'));
                    }
                  }}
                />
              ) : (
                <p style={{
                  textAlign: 'center',
                  color: 'var(--text-secondary)',
                  padding: 'var(--spacing-lg)',
                }}>
                  {t('poolDetail.finalPhase.bracketUnavailable')}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default function PoolDetailPage() {
  return (
    <ProtectedRoute>
      <PoolDetailContent />
    </ProtectedRoute>
  );
}
