import React, { useState, useEffect, useRef } from 'react';
import { Activity, Wifi, WifiOff } from 'lucide-react';
import MatchCard from '../components/MatchCard';
import CommentaryItem from '../components/CommentaryItem';
import { fetchMatches, fetchCommentary } from '../services/api';
import { socketService } from '../services/socket';
import './Dashboard.css';

const extractPoints = (eventType, metadata) => {
  if (!eventType) return null;
  const type = eventType.toLowerCase();
  if (type === 'goal') return 1;
  if (type === 'basket') return 2; // Default to 2 for basketball if no runs provided
  if (type === 'four') return 4;
  if (type === 'six') return 6;
  if (type === 'run') return 1;
  if (metadata && Number.isFinite(metadata.runs)) return metadata.runs;
  return null;
};

const Dashboard = () => {
  const [matches, setMatches] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [commentaryByMatch, setCommentaryByMatch] = useState({});
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [loadingCommentary, setLoadingCommentary] = useState(false);
  const [connectionState, setConnectionState] = useState('Disconnected');
  const [error, setError] = useState(null);
  
  const commentaryListRef = useRef(null);
  const selectedMatchRef = useRef(selectedMatch);
  
  // Queue for incoming WebSocket messages to slow down the feed
  const messageQueueRef = useRef([]);
  // Track which events have been processed to prevent duplicates and calculate unprocessed
  const processedIdsRef = useRef(new Set());
  // Track if a match has been visited for the first time
  const isFirstVisitRef = useRef(new Set());

  useEffect(() => {
    selectedMatchRef.current = selectedMatch;
  }, [selectedMatch]);

  // Handle processing the message queue slowly
  useEffect(() => {
    const processQueue = () => {
      if (messageQueueRef.current.length > 0) {
        // Pop the oldest message
        const newCommentary = messageQueueRef.current.shift();
        
        // Mark as processed
        processedIdsRef.current.add(newCommentary.id);

        // Update commentary list for the specific match
        setCommentaryByMatch((prev) => {
          const matchComms = prev[newCommentary.matchId] || [];
          if (matchComms.some(c => c.id === newCommentary.id)) return prev;
          return { ...prev, [newCommentary.matchId]: [...matchComms, newCommentary] };
        });

        // Update score
        const points = extractPoints(newCommentary.eventType, newCommentary.metadata);
        if (points !== null && newCommentary.team) {
          setMatches((prevMatches) => prevMatches.map(m => {
            if (m.id === newCommentary.matchId) {
              const isHome = m.homeTeam === newCommentary.team;
              const isAway = m.awayTeam === newCommentary.team;
              if (isHome) {
                return { ...m, homeScore: m.homeScore + points };
              }
              if (isAway) {
                return { ...m, awayScore: m.awayScore + points };
              }
            }
            return m;
          }));
        }
      }
      
      // Dynamic playback speed:
      // If there are multiple items in the queue (we are catching up), process them FAST (50ms)
      // If we are just receiving live events, check at a normal pace
      const nextDelay = messageQueueRef.current.length > 0 ? 50 : 1000;
      timeoutId = setTimeout(processQueue, nextDelay);
    };

    // Start the loop
    let timeoutId = setTimeout(processQueue, 500);
    return () => clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    const loadMatches = async () => {
      try {
        setError(null);
        const data = await fetchMatches();
        setMatches(data);
        if (data.length > 0) {
          handleSelectMatch(data[0]);
        }
      } catch (err) {
        console.error('Error loading matches', err);
        setError('Failed to connect to the backend server. Please make sure the server is running and CORS is configured.');
      } finally {
        setLoadingMatches(false);
      }
    };
    loadMatches();

    const unsubscribeConn = socketService.onConnectionChange((state) => {
      setConnectionState(state);
    });

    // Global listener for all commentary - just push to queue
    const unsubscribeCommentary = socketService.on('commentary', (newCommentary) => {
      // Avoid pushing duplicates to queue
      const inQueue = messageQueueRef.current.some(c => c.id === newCommentary.id);
      if (!inQueue) {
        messageQueueRef.current.push(newCommentary);
      }
    });

    return () => {
      unsubscribeConn();
      unsubscribeCommentary();
      socketService.disconnect();
    };
  }, []);

  useEffect(() => {
    if (commentaryListRef.current) {
      commentaryListRef.current.scrollTop = commentaryListRef.current.scrollHeight;
    }
  }, [commentaryByMatch, selectedMatch]);

  const handleSelectMatch = async (match) => {
    setSelectedMatch(match);
    setLoadingCommentary(true);
    
    // Clear queue when switching matches so they stop at current value
    messageQueueRef.current = [];
    
    try {
      setError(null);
      const data = await fetchCommentary(match.id);
      const chronologicalData = [...data].reverse();
      
      const isFirstVisit = !isFirstVisitRef.current.has(match.id);
      isFirstVisitRef.current.add(match.id);
      
      if (isFirstVisit) {
        // First visit: queue historical data so it slowly plays out from 0
        messageQueueRef.current = [...chronologicalData];
      } else {
        // Revisit: put the unprocessed events back into the queue so it resumes slowly from where it left off
        const unprocessed = chronologicalData.filter(item => !processedIdsRef.current.has(item.id));
        messageQueueRef.current = [...unprocessed];
      }
    } catch (err) {
      console.error('Error fetching initial commentary', err);
      setError('Failed to fetch commentary data from the backend.');
    } finally {
      setLoadingCommentary(false);
    }

    socketService.subscribe(match.id);
  };

  return (
    <div className="container">
      <header className="app-header">
        <h1 className="app-title text-accent">
          <Activity size={32} />
          Sportz
        </h1>
        <div className="connection-status glass">
          {connectionState === 'Connected' ? (
            <div className="status-connected">
              <Wifi size={16} /> Live Connected
            </div>
          ) : (
            <div className="status-disconnected">
              <WifiOff size={16} /> Disconnected
            </div>
          )}
        </div>
      </header>

      {error && (
        <div className="error-banner" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '1rem', margin: '1rem', borderRadius: '0.5rem', border: '1px solid #ef4444', textAlign: 'center' }}>
          {error}
        </div>
      )}

      <div className="layout-grid">
        <aside className="matches-column">
          <h2 className="section-title">Current Matches</h2>
          {loadingMatches ? (
            <div className="loading-state">Loading matches...</div>
          ) : (
            <div className="matches-list">
              {matches.map(match => (
                <MatchCard 
                  key={match.id} 
                  match={match} 
                  isSelected={selectedMatch?.id === match.id}
                  onClick={() => handleSelectMatch(match)}
                />
              ))}
            </div>
          )}
        </aside>

        <main className="commentary-column glass">
          <div className="commentary-header-sticky">
            <h2 className="section-title mb-0">Live Commentary</h2>
            {selectedMatch && (
              <span className="selected-match-name text-accent">
                {selectedMatch.homeTeam} vs {selectedMatch.awayTeam}
              </span>
            )}
          </div>
          
          <div className="commentary-list-container" ref={commentaryListRef}>
            {!selectedMatch ? (
              <div className="empty-state">Select a match to view commentary</div>
            ) : loadingCommentary ? (
              <div className="loading-state">Loading previous commentary...</div>
            ) : !(commentaryByMatch[selectedMatch.id] && commentaryByMatch[selectedMatch.id].length > 0) && messageQueueRef.current.length === 0 ? (
              <div className="empty-state">No commentary available for this match yet.</div>
            ) : (
              <div className="commentary-feed">
                {(commentaryByMatch[selectedMatch.id] || []).map((item) => (
                  <CommentaryItem key={item.id} commentary={item} />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
