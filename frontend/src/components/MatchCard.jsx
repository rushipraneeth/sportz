import React from 'react';
import './MatchCard.css';

const MatchCard = ({ match, isSelected, onClick }) => {
  const isLive = match.status.toLowerCase() === 'live';

  return (
    <div 
      className={`glass match-card ${isSelected ? 'selected' : ''}`}
      onClick={() => onClick(match.id)}
    >
      <div className="match-card-header">
        <span className="sport-badge">{match.sport}</span>
        {isLive && (
          <div className="live-badge">
            <span className="live-dot-small"></span>
            Live
          </div>
        )}
      </div>
      
      <div className="teams-container">
        <div className="team-row">
          <span className="team-name">{match.homeTeam}</span>
          <span className={`score ${isLive ? 'score-live' : ''}`}>{match.homeScore}</span>
        </div>
        <div className="team-row">
          <span className="team-name">{match.awayTeam}</span>
          <span className={`score ${isLive ? 'score-live' : ''}`}>{match.awayScore}</span>
        </div>
      </div>
      
      <div className="match-card-footer">
        <span className="status-text">{match.status}</span>
        <button className="btn btn-primary watch-btn">
          {isSelected ? 'Watching Live' : 'Watch Live'}
        </button>
      </div>
    </div>
  );
};

export default MatchCard;
