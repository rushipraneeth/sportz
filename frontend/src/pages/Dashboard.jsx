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
  const [selectedSport, setSelectedSport] = useState('football');
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
      setLoadingMatches(true);
      try {
        setError(null);
        const data = await fetchMatches(selectedSport);
        setMatches(data);
        setSelectedMatch(null);
        setCommentaryByMatch({});
        messageQueueRef.current = [];
        processedIdsRef.current.clear();
        isFirstVisitRef.current.clear();
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
  }, [selectedSport]);

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
      
      // Keep data in chronological order for the feed
      const chronologicalData = [...data];
      
      const isFirstVisit = !isFirstVisitRef.current.has(match.id);
      isFirstVisitRef.current.add(match.id);
      
      if (match.status.toLowerCase() === 'finished' || ['FT', 'AET', 'PEN'].includes(match.fixtureInfo?.status?.short)) {
        // Render instantly for finished matches, don't queue slowly
        setCommentaryByMatch(prev => ({ ...prev, [match.id]: chronologicalData }));
      } else {
        // Slowly playback events for live matches
        if (isFirstVisit) {
          messageQueueRef.current = [...chronologicalData];
        } else {
          const unprocessed = chronologicalData.filter(item => !processedIdsRef.current.has(item.id || item.externalId));
          messageQueueRef.current = [...unprocessed];
        }
      }
    } catch (err) {
      console.error('Error fetching initial events', err);
      setError('Failed to fetch match events from the backend.');
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
          
          <div className="sports-selector mb-4" style={{ marginBottom: '1rem' }}>
            <select 
              value={selectedSport} 
              onChange={(e) => setSelectedSport(e.target.value)}
              style={{ 
                padding: '0.75rem', 
                borderRadius: '0.5rem', 
                width: '100%', 
                backgroundColor: 'rgba(255, 255, 255, 0.1)', 
                color: 'white', 
                border: '1px solid rgba(255, 255, 255, 0.2)',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="football" style={{ color: 'black' }}>⚽ Football</option>
              <option value="basketball" style={{ color: 'black' }}>🏀 Basketball</option>
              <option value="volleyball" style={{ color: 'black' }}>🏐 Volleyball</option>
              <option value="hockey" style={{ color: 'black' }}>🏒 Hockey</option>
            </select>
          </div>

          {loadingMatches ? (
            <div className="matches-list">
              {[1, 2, 3].map(i => (
                <div key={i} className="skeleton-card glass"></div>
              ))}
            </div>
          ) : (
            <div className="matches-list">
              {/* LIVE MATCHES */}
              <h3 className="section-subtitle">🔴 Live Matches</h3>
              {matches.filter(m => m.status === 'live').length === 0 ? (
                <div className="empty-state-small">No live {selectedSport} matches at the moment.</div>
              ) : (
                matches.filter(m => m.status === 'live').map(match => (
                  <MatchCard 
                    key={match.id} 
                    match={match} 
                    isSelected={selectedMatch?.id === match.id}
                    onClick={() => handleSelectMatch(match)}
                  />
                ))
              )}

              {/* UPCOMING MATCHES */}
              <h3 className="section-subtitle mt-4">🟡 Upcoming Matches</h3>
              {matches.filter(m => m.status === 'scheduled').length === 0 ? (
                <div className="empty-state-small">No upcoming {selectedSport} matches today.</div>
              ) : (
                matches.filter(m => m.status === 'scheduled').map(match => (
                  <MatchCard 
                    key={match.id} 
                    match={match} 
                    isSelected={selectedMatch?.id === match.id}
                    onClick={() => handleSelectMatch(match)}
                  />
                ))
              )}

              {/* FINISHED MATCHES */}
              <h3 className="section-subtitle mt-4">⚪ Finished Matches</h3>
              {matches.filter(m => m.status === 'finished').length === 0 ? (
                <div className="empty-state-small">No finished {selectedSport} matches today.</div>
              ) : (
                matches.filter(m => m.status === 'finished').map(match => (
                  <MatchCard 
                    key={match.id} 
                    match={match} 
                    isSelected={selectedMatch?.id === match.id}
                    onClick={() => handleSelectMatch(match)}
                  />
                ))
              )}
            </div>
          )}
        </aside>

        <main className="commentary-column glass">
          <div className="commentary-header-sticky">
            <h2 className="section-title mb-0">Match Events</h2>
            {selectedMatch && (
              <div className="detailed-match-header">
                <div className="detailed-score-row">
                   <div className="detailed-team">
                     {selectedMatch.teamsInfo?.home?.logo && <img src={selectedMatch.teamsInfo.home.logo} alt="Home" />}
                     <span>{selectedMatch.homeTeam}</span>
                   </div>
                   <div className="detailed-score">
                     {selectedMatch.homeScore} - {selectedMatch.awayScore}
                   </div>
                   <div className="detailed-team">
                     {selectedMatch.teamsInfo?.away?.logo && <img src={selectedMatch.teamsInfo.away.logo} alt="Away" />}
                     <span>{selectedMatch.awayTeam}</span>
                   </div>
                </div>
                <div className="detailed-meta-row text-accent">
                   {selectedMatch.league?.name && <span>🏆 {selectedMatch.league.name}</span>}
                   {selectedMatch.fixtureInfo?.venue?.name && <span>🏟️ {selectedMatch.fixtureInfo.venue.name}</span>}
                   {selectedMatch.fixtureInfo?.referee && <span>👤 {selectedMatch.fixtureInfo.referee}</span>}
                </div>
              </div>
            )}
          </div>
          
          <div className="commentary-list-container" ref={commentaryListRef}>
            {!selectedMatch ? (
              <div className="empty-state">Select a match to view events</div>
            ) : selectedMatch.status === 'scheduled' ? (
              <div className="empty-state">This match has not started yet.</div>
            ) : loadingCommentary ? (
              <div className="commentary-feed">
                {[1, 2, 3, 4].map(i => (
                   <div key={i} className="skeleton-event glass"></div>
                ))}
              </div>
            ) : !(commentaryByMatch[selectedMatch.id] && commentaryByMatch[selectedMatch.id].length > 0) && messageQueueRef.current.length === 0 ? (
              <div className="empty-state">
                {selectedMatch.status.toLowerCase() === 'finished' || ['FT', 'AET', 'PEN'].includes(selectedMatch.fixtureInfo?.status?.short) 
                  ? "No events are available for this match." 
                  : "No match events yet."}
              </div>
            ) : (
              <div className="commentary-feed">
                {(commentaryByMatch[selectedMatch.id] || []).map((item) => (
                  <CommentaryItem key={item.id || item.externalId} commentary={item} />
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
