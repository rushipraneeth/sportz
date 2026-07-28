import React from 'react';
import { 
  Goal, Flag, Clock, CircleDot, ShieldAlert,
  Volleyball, Circle, Square, AlertTriangle, RefreshCw, Tv, Target, Timer, XCircle
} from 'lucide-react';
import './CommentaryItem.css';

const getEventIcon = (eventType) => {
  switch (eventType.toLowerCase()) {
    case 'goal':
      return <Goal size={16} className="icon-goal" />;
    case 'own_goal':
      return <XCircle size={16} className="icon-own-goal" color="#ef4444" />;
    case 'foul':
      return <Flag size={16} className="icon-foul" />;
    case 'timeout':
      return <Clock size={16} className="icon-timeout" />;
    case 'four':
    case 'six':
      return <CircleDot size={16} className="icon-cricket" />;
    case 'wicket':
      return <ShieldAlert size={16} className="icon-wicket" />;
    case 'basket':
      return <Circle size={16} className="icon-basket" />;
    case 'yellow card':
    case 'yellow_card':
      return <Square size={16} className="icon-yellow-card" fill="#eab308" color="#eab308" />;
    case 'red card':
    case 'red_card':
      return <Square size={16} className="icon-red-card" fill="#ef4444" color="#ef4444" />;
    case 'substitution':
      return <RefreshCw size={16} className="icon-substitution" color="#3b82f6" />;
    case 'penalty':
      return <Target size={16} className="icon-penalty" color="#f97316" />;
    case 'var':
      return <Tv size={16} className="icon-var" color="#8b5cf6" />;
    case 'half_time':
    case 'full_time':
      return <Timer size={16} className="icon-timer" color="#10b981" />;
    case 'tipoff':
    case 'kickoff':
    case 'start':
      return <Volleyball size={16} className="icon-start" />;
    default:
      return <AlertTriangle size={16} className="icon-default" />;
  }
};

const formatEventType = (type) => {
  return type.replace('_', ' ').toUpperCase();
};

const CommentaryItem = ({ commentary }) => {
  return (
    <div className="commentary-item fade-in">
      <div className="commentary-timeline">
        <div className="timeline-dot"></div>
        <div className="timeline-line"></div>
      </div>
      
      <div className="commentary-content glass">
        <div className="commentary-header">
          <div className="commentary-meta">
            <span className="minute">{commentary.minute}'</span>
            <span className="period">{commentary.period}</span>
          </div>
          <div className="event-badge">
            {getEventIcon(commentary.eventType)}
            <span>{formatEventType(commentary.eventType)}</span>
          </div>
        </div>
        
        <div className="commentary-body">
          <p className="message">{commentary.message}</p>
          {(commentary.actor || commentary.team) && (
            <div className="actor-info">
              {commentary.actor && <span className="actor">{commentary.actor}</span>}
              {commentary.actor && commentary.team && <span className="separator">•</span>}
              {commentary.team && <span className="team">{commentary.team}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommentaryItem;
