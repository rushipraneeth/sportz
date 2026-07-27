import React from 'react';
import { 
  Goal, Flag, Clock, CircleDot, ShieldAlert,
  Volleyball, Circle, Square, AlertTriangle
} from 'lucide-react';
import './CommentaryItem.css';

const getEventIcon = (eventType) => {
  switch (eventType.toLowerCase()) {
    case 'goal':
      return <Goal size={16} className="icon-goal" />;
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
      return <Square size={16} className="icon-yellow-card" />;
    case 'red card':
    case 'red_card':
      return <Square size={16} className="icon-red-card" />;
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
