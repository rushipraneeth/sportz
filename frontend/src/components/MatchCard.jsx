import React from 'react';
import { formatStatus, formatMatchKickoff } from '../utils/formatters';
import './MatchCard.css';

const getButtonConfig = (match, shortStatus, isSelected) => {
  const status = (shortStatus || match.statusDetail || match.status || '').toUpperCase();
  
  if (['PST', 'POSTPONED'].includes(status)) {
    return { text: 'Match Postponed', disabled: true, className: 'btn-disabled' };
  }
  if (['CANC', 'CANCELLED'].includes(status)) {
    return { text: 'Match Cancelled', disabled: true, className: 'btn-disabled' };
  }
  if (['ABD', 'ABANDONED'].includes(status)) {
    return { text: 'Match Abandoned', disabled: true, className: 'btn-disabled' };
  }
  
  const baseStatus = (match.status || '').toLowerCase();
  if (baseStatus === 'finished' || ['FT', 'AET', 'PEN'].includes(status)) {
    return { text: isSelected ? 'Viewing Summary' : 'View Summary', disabled: false, className: 'btn-secondary' };
  }
  if (baseStatus === 'scheduled' || ['NS', 'SCHEDULED', 'TBD'].includes(status)) {
    return { text: isSelected ? 'Viewing Fixture' : 'View Fixture', disabled: false, className: 'btn-secondary' };
  }
  
  // Default to live
  return { text: isSelected ? '🔴 Watching Live' : '🔴 Watch Live', disabled: false, className: 'btn-primary' };
};

const MatchCard = ({ match, isSelected, onClick }) => {
  const isLive = match.status?.toLowerCase() === 'live';
  
  const leagueName = match.leagueName || match.league?.name || match.sport;
  const leagueLogo = match.leagueLogo || match.league?.logo;
  const homeLogo = match.homeLogo || match.teamsInfo?.home?.logo;
  const awayLogo = match.awayLogo || match.teamsInfo?.away?.logo;
  const venue = match.venue || match.fixtureInfo?.venue?.name;
  const elapsed = match.elapsed ?? match.fixtureInfo?.status?.elapsed;
  const shortStatus = match.statusDetail || match.fixtureInfo?.status?.short || match.status;
  const detailedStatus = formatStatus(shortStatus, isLive ? 'Live' : 'Scheduled');
  
  const btnConfig = getButtonConfig(match, shortStatus, isSelected);
  const formattedKickoff = formatMatchKickoff(match.startTime);

  return (
    <div 
      className={`glass match-card ${isSelected ? 'selected' : ''}`}
      onClick={() => {
        if (!btnConfig.disabled) onClick(match);
      }}
      style={{ cursor: btnConfig.disabled ? 'default' : 'pointer' }}
    >
      <div className="match-card-header">
        <div className="league-info">
          {leagueLogo && <img src={leagueLogo} alt="League" className="league-logo" />}
          <span className="sport-badge">{leagueName}</span>
        </div>
        
        {isLive && (
          <div className="live-badge">
            <span className="live-dot-small"></span>
            {shortStatus === 'HT' ? 'HT' : elapsed ? `${elapsed}'` : 'Live'}
          </div>
        )}
        
        {!isLive && match.status?.toLowerCase() === 'scheduled' && formattedKickoff && (
          <div className="time-badge" title="Kickoff Time (Asia/Kolkata)">
            {formattedKickoff}
          </div>
        )}
      </div>
      
      <div className="teams-container">
        <div className="team-row">
          <div className="team-identity">
            {homeLogo ? (
              <img src={homeLogo} alt={match.homeTeam} className="team-logo" onError={(e) => { e.target.style.display = 'none'; }} />
            ) : (
              <div className="team-logo-fallback">⚽</div>
            )}
            <span className="team-name">{match.homeTeam}</span>
          </div>
          <span className={`score ${isLive ? 'score-live' : ''}`}>{match.homeScore ?? 0}</span>
        </div>
        
        <div className="team-row">
          <div className="team-identity">
            {awayLogo ? (
              <img src={awayLogo} alt={match.awayTeam} className="team-logo" onError={(e) => { e.target.style.display = 'none'; }} />
            ) : (
              <div className="team-logo-fallback">⚽</div>
            )}
            <span className="team-name">{match.awayTeam}</span>
          </div>
          <span className={`score ${isLive ? 'score-live' : ''}`}>{match.awayScore ?? 0}</span>
        </div>
      </div>
      
      <div className="match-card-footer">
        <div className="match-meta">
          <span className="status-text">{detailedStatus}</span>
          {venue && <span className="venue-text" title={venue}>• {venue}</span>}
          {match.isStale && <span className="badge-stale" style={{ fontSize: '0.7rem', color: '#f59e0b', marginLeft: '0.25rem' }}>[Cached]</span>}
        </div>
        <button 
          className={`btn ${btnConfig.className} watch-btn`} 
          disabled={btnConfig.disabled}
          onClick={(e) => {
            e.stopPropagation();
            if (!btnConfig.disabled) onClick(match);
          }}
        >
          {btnConfig.text}
        </button>
      </div>
    </div>
  );
};

export default MatchCard;
