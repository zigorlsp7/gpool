'use client';

import { useI18n } from '@/i18n/client';

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

interface BracketPrediction {
  homeTeamId?: string;
  homeTeamName?: string;
  awayTeamId?: string;
  awayTeamName?: string;
  points?: number;
  homeTeamExactPosition?: boolean;
  awayTeamExactPosition?: boolean;
  homeTeamCorrectButWrongPosition?: boolean;
  awayTeamCorrectButWrongPosition?: boolean;
}

interface BracketVisualizationProps {
  bracket: Record<string, BracketMatch[]>;
  teams: Team[];
  poolId: string;
  // Admin mode props
  mode?: 'admin' | 'user';
  updatingMatch?: string | null;
  onUpdateTeam?: (bracketMatchId: string, side: 'home' | 'away', teamId: string, teamName: string) => void;
  onBracketResultChange?: (bracketMatchId: string, homeResult: number | '', awayResult: number | '') => void;
  onUpdateResult?: (bracketMatchId: string, homeResult: number, awayResult: number) => void;
  bracketResults?: Record<string, { homeResult: number | ''; awayResult: number | '' }>;
  submittingResult?: string | null;
  // User mode props
  bracketPredictions?: Record<string, BracketPrediction>;
  deadline?: number;
  onPredictionChange?: (bracketMatchId: string, side: 'home' | 'away', teamId: string, teamName: string) => void;
  // Scoring config for displaying points
  exactPositionPoints?: number;
  correctTeamWrongPositionPoints?: number;
}

export function BracketVisualization({
  bracket,
  teams,
  poolId,
  mode = 'admin',
  updatingMatch = null,
  onUpdateTeam,
  onBracketResultChange,
  onUpdateResult,
  bracketResults = {},
  submittingResult = null,
  bracketPredictions = {},
  deadline,
  onPredictionChange,
  exactPositionPoints = 5,
  correctTeamWrongPositionPoints = 3,
}: BracketVisualizationProps) {
  const { t } = useI18n();
  const isDeadlinePassed = deadline ? Date.now() >= deadline : false;
  
  // Debug: Log teams when component renders
  if (mode === 'admin' && teams.length === 0) {
    console.warn(`[BracketVisualization] No teams provided in admin mode for pool ${poolId}`);
  } else if (mode === 'admin') {
    console.log(`[BracketVisualization] Admin mode with ${teams.length} teams:`, teams.slice(0, 5));
  }
  // Match box layout: keep enough fixed vertical space so hints/points don't
  // change the box height when they appear, while staying reasonably compact.
  // This height should stay in sync with the BracketMatchBox minHeight below.
  const matchHeight = 170;
  const matchGap = 16;
  const roundGap = 60;

  const getMatchTop = (matchIndex: number, phaseKey: string, allPhases: Record<string, BracketMatch[]>) => {
    if (phaseKey === '16th-finals') {
      return matchIndex * (matchHeight + matchGap);
    }

    let parentPhaseKey: string;
    let parentMatchIndex1: number;
    let parentMatchIndex2: number;

    if (phaseKey === '8th-finals') {
      parentPhaseKey = '16th-finals';
      parentMatchIndex1 = matchIndex * 2;
      parentMatchIndex2 = matchIndex * 2 + 1;
    } else if (phaseKey === 'quarter-finals') {
      parentPhaseKey = '8th-finals';
      parentMatchIndex1 = matchIndex * 2;
      parentMatchIndex2 = matchIndex * 2 + 1;
    } else if (phaseKey === 'semi-finals') {
      parentPhaseKey = 'quarter-finals';
      parentMatchIndex1 = matchIndex * 2;
      parentMatchIndex2 = matchIndex * 2 + 1;
    } else if (phaseKey === 'finals') {
      // Place the final vertically centered relative to the full 16th-finals column.
      const totalMatches = (allPhases['16th-finals']?.length ?? 16);
      const totalHeight =
        totalMatches * matchHeight + (totalMatches - 1) * matchGap;
      const center = totalHeight / 2;
      return center - matchHeight / 2;
    } else {
      return matchIndex * (matchHeight + matchGap);
    }

    const parentMatches = allPhases[parentPhaseKey] || [];
    if (parentMatches.length === 0) {
      return matchIndex * (matchHeight + matchGap);
    }

    const parentTop1 = getMatchTop(parentMatchIndex1, parentPhaseKey, allPhases);
    const parentTop2 = getMatchTop(parentMatchIndex2, parentPhaseKey, allPhases);
    const parentCenter1 = parentTop1 + matchHeight / 2;
    const parentCenter2 = parentTop2 + matchHeight / 2;
    const centerBetween = (parentCenter1 + parentCenter2) / 2;
    return centerBetween - matchHeight / 2;
  };

  const renderRound = (
    phaseKey: string,
    label: string,
    matches: BracketMatch[],
    isLeft: boolean,
    isRight: boolean,
    isFinal: boolean = false
  ) => {
    if (!matches || matches.length === 0) return null;

    return (
      <div style={{ position: 'relative', width: '220px' }}>
        <div style={{
          fontSize: '0.875rem',
          fontWeight: '600',
          color: 'var(--text-secondary)',
          marginBottom: 'var(--spacing-sm)',
          textAlign: 'center',
        }}>
          {label}
        </div>
        {matches.map((match, idx) => {
          const actualIndex = isLeft ? idx : (phaseKey === '16th-finals' ? 8 + idx :
            phaseKey === '8th-finals' ? 4 + idx :
            phaseKey === 'quarter-finals' ? 2 + idx :
            phaseKey === 'semi-finals' ? 1 + idx : idx);
          let top = getMatchTop(actualIndex, phaseKey, bracket);

          if (!isLeft && !isFinal) {
            const firstLeftIndex = 0;
            const firstRightIndex = phaseKey === '16th-finals' ? 8 :
              phaseKey === '8th-finals' ? 4 :
              phaseKey === 'quarter-finals' ? 2 :
              phaseKey === 'semi-finals' ? 1 : 0;
            const firstLeftTop = getMatchTop(firstLeftIndex, phaseKey, bracket);
            const firstRightTop = getMatchTop(firstRightIndex, phaseKey, bracket);
            const offset = firstLeftTop - firstRightTop;
            top = top + offset;
          }

          const prediction = bracketPredictions[match.bracketMatchId] || {};
          // For final phase, check if both teams are set (not results, since final phase doesn't use scores)
          const hasBothTeams = match.homeTeamId && match.awayTeamId;
          
          // Check evaluation fields - handle both boolean true and truthy values
          // Evaluation happens when admin sets both teams in the match
          const homeTeamExactPosition = hasBothTeams && (prediction.homeTeamExactPosition === true || prediction.homeTeamExactPosition === 'true');
          const awayTeamExactPosition = hasBothTeams && (prediction.awayTeamExactPosition === true || prediction.awayTeamExactPosition === 'true');
          const homeTeamCorrectButWrongPosition = hasBothTeams && (prediction.homeTeamCorrectButWrongPosition === true || prediction.homeTeamCorrectButWrongPosition === 'true');
          const awayTeamCorrectButWrongPosition = hasBothTeams && (prediction.awayTeamCorrectButWrongPosition === true || prediction.awayTeamCorrectButWrongPosition === 'true');
          const points = prediction.points || 0;
          
          // Debug logging for matches with teams set and predictions
          if (hasBothTeams && Object.keys(prediction).length > 0) {
            console.log(`[Bracket User View] Match ${match.bracketMatchId}:`, {
              hasBothTeams,
              matchTeams: { home: match.homeTeamId, away: match.awayTeamId },
              predictionTeams: { home: prediction.homeTeamId, away: prediction.awayTeamId },
              evaluationFields: {
                homeTeamExactPosition: prediction.homeTeamExactPosition,
                awayTeamExactPosition: prediction.awayTeamExactPosition,
                homeTeamCorrectButWrongPosition: prediction.homeTeamCorrectButWrongPosition,
                awayTeamCorrectButWrongPosition: prediction.awayTeamCorrectButWrongPosition,
                points: prediction.points,
                isEvaluated: prediction.isEvaluated,
              },
              computed: {
                homeTeamExactPosition,
                awayTeamExactPosition,
                homeTeamCorrectButWrongPosition,
                awayTeamCorrectButWrongPosition,
              },
              fullPrediction: prediction,
              fullMatch: match,
            });
          }

          return (
            <div
              key={match.bracketMatchId}
              style={{
                position: 'absolute',
                top: `${top}px`,
                left: '50%',
                transform: 'translateX(-50%)',
                width: '100%',
              }}
            >
              {isFinal ? (
                <div style={{
                  padding: 'var(--spacing-lg)',
                  backgroundColor: 'var(--accent-primary)',
                  borderRadius: 'var(--radius-md)',
                  border: '3px solid var(--accent-secondary)',
                  minWidth: '220px',
                }}>
                  <div style={{
                    fontSize: '0.875rem',
                    color: '#fff',
                    marginBottom: 'var(--spacing-sm)',
                    textAlign: 'center',
                    fontWeight: '600',
                  }}>
                    {t('bracket.final')}
                  </div>
                  <BracketMatchBox
                    match={match}
                    teams={teams}
                    poolId={poolId}
                    mode={mode}
                    updatingMatch={updatingMatch}
                    onUpdateTeam={onUpdateTeam}
                    onBracketResultChange={onBracketResultChange}
                    onUpdateResult={onUpdateResult}
                    bracketResults={bracketResults}
                    submittingResult={submittingResult}
                    prediction={prediction}
                    isDeadlinePassed={isDeadlinePassed}
                    onPredictionChange={onPredictionChange}
                    isFinal={true}
                    homeTeamExactPosition={homeTeamExactPosition}
                    awayTeamExactPosition={awayTeamExactPosition}
                    homeTeamCorrectButWrongPosition={homeTeamCorrectButWrongPosition}
                    awayTeamCorrectButWrongPosition={awayTeamCorrectButWrongPosition}
                    points={points}
                    exactPositionPoints={exactPositionPoints}
                    correctTeamWrongPositionPoints={correctTeamWrongPositionPoints}
                  />
                </div>
              ) : (
                <BracketMatchBox
                  match={match}
                  teams={teams}
                  poolId={poolId}
                  mode={mode}
                  updatingMatch={updatingMatch}
                    onUpdateTeam={onUpdateTeam}
                    onBracketResultChange={onBracketResultChange}
                    onUpdateResult={onUpdateResult}
                    bracketResults={bracketResults}
                    submittingResult={submittingResult}
                  prediction={prediction}
                  isDeadlinePassed={isDeadlinePassed}
                  onPredictionChange={onPredictionChange}
                  homeTeamExactPosition={homeTeamExactPosition}
                  awayTeamExactPosition={awayTeamExactPosition}
                  homeTeamCorrectButWrongPosition={homeTeamCorrectButWrongPosition}
                  awayTeamCorrectButWrongPosition={awayTeamCorrectButWrongPosition}
                  points={points}
                  exactPositionPoints={exactPositionPoints}
                  correctTeamWrongPositionPoints={correctTeamWrongPositionPoints}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  let maxHeight = 0;
  const checkPhase = (phaseKey: string, isLeft: boolean) => {
    const phaseMatches = bracket[phaseKey] || [];
    if (phaseMatches.length === 0) return;

    const startIdx = isLeft ? 0 : (phaseKey === '16th-finals' ? 8 :
      phaseKey === '8th-finals' ? 4 :
      phaseKey === 'quarter-finals' ? 2 :
      phaseKey === 'semi-finals' ? 1 : 0);

    for (let idx = 0; idx < phaseMatches.length; idx++) {
      const actualIndex = isLeft ? idx : startIdx + idx;
      let top = getMatchTop(actualIndex, phaseKey, bracket);

      if (!isLeft) {
        const firstLeftIndex = 0;
        const firstRightIndex = startIdx;
        const firstLeftTop = getMatchTop(firstLeftIndex, phaseKey, bracket);
        const firstRightTop = getMatchTop(firstRightIndex, phaseKey, bracket);
        const offset = firstLeftTop - firstRightTop;
        top = top + offset;
      }

      const bottom = top + matchHeight;
      if (bottom > maxHeight) {
        maxHeight = bottom;
      }
    }
  };

  ['16th-finals', '8th-finals', 'quarter-finals', 'semi-finals', 'finals'].forEach(phaseKey => {
    checkPhase(phaseKey, true);
    checkPhase(phaseKey, false);
  });

  // Ensure a reasonable minimum height so lines render correctly,
  // but keep it tight to avoid large empty space below the bracket.
  maxHeight = Math.max(maxHeight, 140);

  return (
    <div style={{
      overflowX: 'auto',
      overflowY: 'visible',
      padding: 'var(--spacing-md) var(--spacing-lg) var(--spacing-xs)',
    }}>
      <div style={{
        display: 'flex',
        gap: `${roundGap}px`,
        alignItems: 'flex-start',
        minHeight: `${maxHeight}px`,
        position: 'relative',
      }}>
        {/* Left Side */}
        <div style={{
          display: 'flex',
          gap: `${roundGap}px`,
          alignItems: 'flex-start',
          height: `${maxHeight}px`,
        }}>
          {renderRound('16th-finals', t('bracket.round.16th'), bracket['16th-finals']?.slice(0, 8) || [], true, false)}
          {renderRound('8th-finals', t('bracket.round.8th'), bracket['8th-finals']?.slice(0, 4) || [], true, false)}
          {renderRound('quarter-finals', t('bracket.round.quarter'), bracket['quarter-finals']?.slice(0, 2) || [], true, false)}
          {renderRound('semi-finals', t('bracket.round.semi'), bracket['semi-finals']?.slice(0, 1) || [], true, false)}
        </div>

        {/* Center: Final */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          height: `${maxHeight}px`,
          justifyContent: 'center',
          position: 'relative',
        }}>
          {renderRound('finals', t('bracket.round.final'), bracket['finals'] || [], false, false, true)}
        </div>

        {/* Right Side */}
        <div style={{
          display: 'flex',
          gap: `${roundGap}px`,
          alignItems: 'flex-start',
          height: `${maxHeight}px`,
        }}>
          {renderRound('semi-finals', t('bracket.round.semi'), bracket['semi-finals']?.slice(1, 2) || [], false, true)}
          {renderRound('quarter-finals', t('bracket.round.quarter'), bracket['quarter-finals']?.slice(2, 4) || [], false, true)}
          {renderRound('8th-finals', t('bracket.round.8th'), bracket['8th-finals']?.slice(4, 8) || [], false, true)}
          {renderRound('16th-finals', t('bracket.round.16th'), bracket['16th-finals']?.slice(8, 16) || [], false, true)}
        </div>
      </div>
    </div>
  );
}

// Bracket Match Box Component
function BracketMatchBox({
  match,
  teams,
  poolId,
  mode,
  updatingMatch,
  onUpdateTeam,
  onBracketResultChange,
  onUpdateResult,
  bracketResults = {},
  submittingResult = null,
  prediction,
  isDeadlinePassed,
  onPredictionChange,
  isFinal = false,
  homeTeamExactPosition,
  awayTeamExactPosition,
  homeTeamCorrectButWrongPosition,
  awayTeamCorrectButWrongPosition,
  points,
  exactPositionPoints = 5,
  correctTeamWrongPositionPoints = 3,
}: {
  match: BracketMatch;
  teams: Team[];
  poolId: string;
  mode: 'admin' | 'user';
  updatingMatch?: string | null;
  onUpdateTeam?: (bracketMatchId: string, side: 'home' | 'away', teamId: string, teamName: string) => void;
  onBracketResultChange?: (bracketMatchId: string, homeResult: number | '', awayResult: number | '') => void;
  onUpdateResult?: (bracketMatchId: string, homeResult: number, awayResult: number) => void;
  bracketResults?: Record<string, { homeResult: number | ''; awayResult: number | '' }>;
  submittingResult?: string | null;
  prediction?: BracketPrediction;
  isDeadlinePassed?: boolean;
  onPredictionChange?: (bracketMatchId: string, side: 'home' | 'away', teamId: string, teamName: string) => void;
  isFinal?: boolean;
  homeTeamExactPosition?: boolean;
  awayTeamExactPosition?: boolean;
  homeTeamCorrectButWrongPosition?: boolean;
  awayTeamCorrectButWrongPosition?: boolean;
  points?: number;
  exactPositionPoints?: number;
  correctTeamWrongPositionPoints?: number;
}) {
  const { t } = useI18n();
  const isAdmin = mode === 'admin';
  const isDisabled = isAdmin 
    ? (updatingMatch === match.bracketMatchId || poolId === 'all-pools')
    : (poolId === 'all-pools' || isDeadlinePassed);

  const homeTeamId = isAdmin ? match.homeTeamId : (prediction?.homeTeamId || '');
  const homeTeamName = isAdmin ? match.homeTeamName : (prediction?.homeTeamName || '');
  const awayTeamId = isAdmin ? match.awayTeamId : (prediction?.awayTeamId || '');
  const awayTeamName = isAdmin ? match.awayTeamName : (prediction?.awayTeamName || '');
  
  // For final phase, check if both teams are set (not results, since final phase doesn't use scores)
  const hasBothTeams = match.homeTeamId && match.awayTeamId;
  
  // Determine border color for dropdowns based on prediction status
  const getHomeTeamBorderColor = () => {
    if (isAdmin || !hasBothTeams) return isFinal ? 'rgba(255,255,255,0.3)' : 'var(--border-color)';
    if (homeTeamExactPosition) return '#2196F3'; // Blue for exact position
    if (homeTeamCorrectButWrongPosition) return '#4caf50'; // Green for correct but wrong position
    return isFinal ? 'rgba(255,255,255,0.3)' : 'var(--border-color)';
  };
  
  const getAwayTeamBorderColor = () => {
    if (isAdmin || !hasBothTeams) return isFinal ? 'rgba(255,255,255,0.3)' : 'var(--border-color)';
    if (awayTeamExactPosition) return '#2196F3'; // Blue for exact position
    if (awayTeamCorrectButWrongPosition) return '#4caf50'; // Green for correct but wrong position
    return isFinal ? 'rgba(255,255,255,0.3)' : 'var(--border-color)';
  };

  const handleTeamChange = (side: 'home' | 'away', teamId: string, teamName: string) => {
    if (isAdmin && onUpdateTeam) {
      onUpdateTeam(match.bracketMatchId, side, teamId, teamName);
    } else if (!isAdmin && onPredictionChange) {
      onPredictionChange(match.bracketMatchId, side, teamId, teamName);
    }
  };

  return (
    <div style={{
      padding: isFinal ? 'var(--spacing-md)' : 'var(--spacing-sm)',
      backgroundColor: isFinal ? 'transparent' : 'var(--bg-secondary)',
      borderRadius: 'var(--radius-md)',
      border: isFinal ? 'none' : '2px solid var(--border-color)',
      minWidth: '180px',
      // Fix a minimum height so that adding validation/points text does not
      // change the box height and break vertical alignment between rounds.
      // This should stay roughly aligned with matchHeight above.
      minHeight: isFinal ? 210 : 170,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-start',
    }}>
      {!isFinal && (
        <div style={{
          fontSize: '0.75rem',
          color: isFinal ? '#fff' : 'var(--text-secondary)',
          marginBottom: 'var(--spacing-xs)',
          textAlign: 'center',
        }}>
          {t('bracket.match', { number: match.matchNumber })}
        </div>
      )}

      {/* Home Team */}
      <div style={{ marginBottom: 'var(--spacing-xs)' }}>
        <select
          value={homeTeamId || ''}
          onChange={(e) => {
            const selectedTeam = teams.find(t => t.teamId === e.target.value);
            if (selectedTeam) {
              handleTeamChange('home', selectedTeam.teamId, selectedTeam.name);
            }
          }}
          disabled={isDisabled}
          style={{
            width: '100%',
            padding: 'var(--spacing-xs)',
            border: `2px solid ${getHomeTeamBorderColor()}`,
            borderRadius: 'var(--radius-sm)',
            backgroundColor: isFinal 
              ? (isDeadlinePassed ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.1)') 
              : (isDeadlinePassed ? 'var(--bg-secondary)' : 'var(--bg-primary)'),
            color: isFinal ? '#fff' : 'var(--text-primary)',
            fontSize: '0.875rem',
            cursor: isDisabled ? 'not-allowed' : 'pointer',
            opacity: isDeadlinePassed ? 0.7 : 1,
          }}
        >
          <option value="">{t('bracket.selectTeam')}</option>
          {teams.map((team) => (
            <option key={team.teamId} value={team.teamId} style={{ color: '#000' }}>
              {team.name}
            </option>
          ))}
        </select>
        {!isAdmin && homeTeamExactPosition && (
          <div style={{
            fontSize: '0.7rem',
            color: '#2196F3',
            marginTop: '2px',
            fontWeight: '600',
          }}>
            {t('bracket.exactPositionPoints', { points: exactPositionPoints })}
          </div>
        )}
        {!isAdmin && homeTeamCorrectButWrongPosition && (
          <div style={{
            fontSize: '0.7rem',
            color: '#4caf50',
            marginTop: '2px',
            fontWeight: '600',
          }}>
            {t('bracket.correctTeamPoints', { points: correctTeamWrongPositionPoints })}
          </div>
        )}
      </div>

      <div style={{
        textAlign: 'center',
        color: isFinal ? '#fff' : 'var(--text-secondary)',
        margin: 'var(--spacing-xs) 0',
        fontSize: '0.875rem',
      }}>
        {t('bracket.vs')}
      </div>

      {/* Away Team */}
      <div>
        <select
          value={awayTeamId || ''}
          onChange={(e) => {
            const selectedTeam = teams.find(t => t.teamId === e.target.value);
            if (selectedTeam) {
              handleTeamChange('away', selectedTeam.teamId, selectedTeam.name);
            }
          }}
          disabled={isDisabled}
          style={{
            width: '100%',
            padding: 'var(--spacing-xs)',
            border: `2px solid ${getAwayTeamBorderColor()}`,
            borderRadius: 'var(--radius-sm)',
            backgroundColor: isFinal 
              ? (isDeadlinePassed ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.1)') 
              : (isDeadlinePassed ? 'var(--bg-secondary)' : 'var(--bg-primary)'),
            color: isFinal ? '#fff' : 'var(--text-primary)',
            fontSize: '0.875rem',
            cursor: isDisabled ? 'not-allowed' : 'pointer',
            opacity: isDeadlinePassed ? 0.7 : 1,
          }}
        >
          <option value="">{t('bracket.selectTeam')}</option>
          {teams.map((team) => (
            <option key={team.teamId} value={team.teamId} style={{ color: '#000' }}>
              {team.name}
            </option>
          ))}
        </select>
        {!isAdmin && awayTeamExactPosition && (
          <div style={{
            fontSize: '0.7rem',
            color: '#2196F3',
            marginTop: '2px',
            fontWeight: '600',
          }}>
            {t('bracket.exactPositionPoints', { points: exactPositionPoints })}
          </div>
        )}
        {!isAdmin && awayTeamCorrectButWrongPosition && (
          <div style={{
            fontSize: '0.7rem',
            color: '#4caf50',
            marginTop: '2px',
            fontWeight: '600',
          }}>
            {t('bracket.correctTeamPoints', { points: correctTeamWrongPositionPoints })}
          </div>
        )}
      </div>

      {!isAdmin && points !== undefined && points > 0 && (
        <div style={{
          fontSize: '0.75rem',
          color: '#4caf50',
          marginTop: 'var(--spacing-xs)',
          textAlign: 'center',
          fontWeight: '600',
        }}>
          {t('bracket.totalPoints', { points })}
        </div>
      )}
    </div>
  );
}
