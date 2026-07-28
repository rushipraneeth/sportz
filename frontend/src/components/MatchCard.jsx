import React from 'react';
import './MatchCard.css';

const formatStatus = (short) => {
  const map = {
    'NS': 'Scheduled',
    '1H': 'First Half',
    'HT': 'Half Time',
    '2H': 'Second Half',
    'ET': 'Extra Time',
    'AET': 'After Extra Time',
    'FT': 'Full Time',
    'PEN': 'Penalties',
    'PST': 'Postponed',
    'CANC': 'Cancelled',
    'Q1': '1st Quarter',
    'Q2': '2nd Quarter',
    'Q3': '3rd Quarter',
    'Q4': '4th Quarter',
    'OT': 'Overtime',
    'S1': '1st Set',
    'S2': '2nd Set',
    'S3': '3rd Set',
    'S4': '4th Set',
    'S5': '5th Set',
    'P1': '1st Period',
    'P2': '2nd Period',
    'P3': '3rd Period',
    'AW': 'Awarded',
    'WO': 'Walkover',
    'POST': 'Postponed',
    'ABD': 'Abandoned'
  };
  return map[short] || short || 'Unknown';
};

const getButtonConfig = (match, shortStatus, isSelected) => {
  const status = shortStatus || match.status.toUpperCase();
  
  if (['PST', 'POSTPONED'].includes(status)) {
    return { text: 'Match Postponed', disabled: true, className: 'btn-disabled' };
  }
  if (['CANC', 'CANCELLED'].includes(status)) {
    return { text: 'Match Cancelled', disabled: true, className: 'btn-disabled' };
  }
  
  const baseStatus = match.status.toLowerCase();
  if (baseStatus === 'finished' || ['FT', 'AET'].includes(status)) {
    return { text: isSelected ? 'Viewing Summary' : 'View Summary', disabled: false, className: 'btn-secondary' };
  }
  if (baseStatus === 'scheduled' || ['NS', 'SCHEDULED'].includes(status)) {
    return { text: isSelected ? 'Viewing' : 'View Match', disabled: false, className: 'btn-secondary' };
  }
  
  // Default to live
  return { text: isSelected ? '🔴 Watching Live' : '🔴 Watch Live', disabled: false, className: 'btn-primary' };
};

const MatchCard = ({ match, isSelected, onClick }) => {
  const isLive = match.status.toLowerCase() === 'live';
  
  // Use rich data if available, fallback to basic data
  const leagueName = match.league?.name || match.sport;
  const leagueLogo = match.league?.logo;
  const homeLogo = match.teamsInfo?.home?.logo;
  const awayLogo = match.teamsInfo?.away?.logo;
  const venue = match.fixtureInfo?.venue?.name;
  const elapsed = match.fixtureInfo?.status?.elapsed;
  const shortStatus = match.fixtureInfo?.status?.short;
  const detailedStatus = formatStatus(shortStatus || match.status);
  
  const btnConfig = getButtonConfig(match, shortStatus, isSelected);

  return (
    <div 
      className={`glass match-card ${isSelected ? 'selected' : ''}`}
      onClick={() => {
        if (!btnConfig.disabled) onClick(match.id);
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
            {elapsed ? `${elapsed}'` : 'Live'}
          </div>
        )}
        {!isLive && match.status.toLowerCase() === 'scheduled' && match.startTime && (
          <div className="time-badge">
            {new Date(match.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
      </div>
      
      <div className="teams-container">
        <div className="team-row">
          <div className="team-identity">
            {homeLogo && <img src={homeLogo} alt={match.homeTeam} className="team-logo" />}
            <span className="team-name">{match.homeTeam}</span>
          </div>
          <span className={`score ${isLive ? 'score-live' : ''}`}>{match.homeScore}</span>
        </div>
        <div className="team-row">
          <div className="team-identity">
            {awayLogo && <img src={awayLogo} alt={match.awayTeam} className="team-logo" />}
            <span className="team-name">{match.awayTeam}</span>
          </div>
          <span className={`score ${isLive ? 'score-live' : ''}`}>{match.awayScore}</span>
        </div>
      </div>
      
      <div className="match-card-footer">
        <div className="match-meta">
          <span className="status-text">{detailedStatus}</span>
          {venue && <span className="venue-text">{venue}</span>}
        </div>
        <button 
          className={`btn ${btnConfig.className} watch-btn`} 
          disabled={btnConfig.disabled}
          onClick={(e) => {
            e.stopPropagation();
            if (!btnConfig.disabled) onClick(match.id);
          }}
        >
          {btnConfig.text}
        </button>
      </div>
    </div>
  );
};

export default MatchCard;
