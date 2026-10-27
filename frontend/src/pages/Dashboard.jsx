import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Activity, Wifi, WifiOff, RefreshCw, Search, AlertCircle, Clock, CheckCircle, Radio } from 'lucide-react';
import MatchCard from '../components/MatchCard';
import { formatMatchKickoff } from '../utils/formatters';
import CommentaryItem from '../components/CommentaryItem';
import { fetchMatches, fetchCommentary } from '../services/api';
import { socketService } from '../services/socket';
import './Dashboard.css';

const Dashboard = () => {
  const [matches, setMatches] = useState([]);
  const [selectedSport, setSelectedSport] = useState('football');
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [commentaryByMatch, setCommentaryByMatch] = useState({});
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [loadingCommentary, setLoadingCommentary] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [connectionState, setConnectionState] = useState('Disconnected');
  const [error, setError] = useState(null);
  const [metaInfo, setMetaInfo] = useState(null);
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'live', 'upcoming', 'finished'
  const [searchQuery, setSearchQuery] = useState('');
  
  const commentaryListRef = useRef(null);
  const selectedMatchRef = useRef(selectedMatch);
  const processedEventIdsRef = useRef(new Set());

  useEffect(() => {
    selectedMatchRef.current = selectedMatch;
  }, [selectedMatch]);

  const loadMatches = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    } else {
      setLoadingMatches(true);
      setMatches([]);
    }

    try {
      setError(null);
      const res = await fetchMatches(selectedSport, isManualRefresh);
      setMatches(res.matches || []);
      setMetaInfo(res.meta || null);

      if (selectedMatchRef.current) {
        const updatedSelected = (res.matches || []).find(m => m.id === selectedMatchRef.current.id);
        if (updatedSelected) {
          setSelectedMatch(updatedSelected);
        }
      }
    } catch (err) {
      console.error('Error loading matches:', err);
      let errorMsg = err.message || 'Failed to connect to backend server.';
      if (err.isRateLimit) {
        errorMsg = 'External Sports API rate limit reached. Displaying cached data.';
      }
      setError(errorMsg);
      setMatches([]);
    } finally {
      setLoadingMatches(false);
      setRefreshing(false);
    }
  }, [selectedSport]);

  // Initial fetch and WebSocket connection
  useEffect(() => {
    loadMatches();
    socketService.connect();

    const unsubscribeConn = socketService.onConnectionChange((state) => {
      setConnectionState(state);
    });

    // Handle real-time match creation
    const unsubscribeCreated = socketService.on('match_created', (newMatch) => {
      if (newMatch?.sport?.toLowerCase() === selectedSport.toLowerCase()) {
        setMatches((prev) => {
          if (prev.some(m => m.id === newMatch.id || m.externalId === newMatch.externalId)) {
            return prev;
          }
          return [newMatch, ...prev];
        });
      }
    });

    // Handle real-time match updates (scores, status changes, minute updates)
    const unsubscribeUpdated = socketService.on('match_updated', (updatedMatch) => {
      if (!updatedMatch) return;
      const targetId = updatedMatch.id;
      const targetExtId = updatedMatch.externalId;

      setMatches((prevMatches) =>
        prevMatches.map((m) => {
          if ((targetId && m.id === targetId) || (targetExtId && m.externalId === targetExtId)) {
            return { ...m, ...updatedMatch };
          }
          return m;
        })
      );

      if (selectedMatchRef.current && (
        (targetId && selectedMatchRef.current.id === targetId) ||
        (targetExtId && selectedMatchRef.current.externalId === targetExtId)
      )) {
        setSelectedMatch((prev) => ({ ...prev, ...updatedMatch }));
      }
    });

    // Handle real-time commentary events
    const unsubscribeCommentary = socketService.on('commentary', (newCommentary) => {
      if (!newCommentary) return;
      const mId = newCommentary.matchId;
      if (!mId) return;

      const eventKey = newCommentary.id || newCommentary.externalId;
      if (eventKey && processedEventIdsRef.current.has(eventKey)) return;
      if (eventKey) processedEventIdsRef.current.add(eventKey);

      setCommentaryByMatch((prev) => {
        const currentList = prev[mId] || [];
        if (currentList.some(c => (c.id && c.id === newCommentary.id) || (c.externalId && c.externalId === newCommentary.externalId))) {
          return prev;
        }
        const updatedList = [...currentList, newCommentary];
        return {
          ...prev,
          [mId]: updatedList,
          ...(newCommentary.externalId ? { [newCommentary.externalId]: updatedList } : {})
        };
      });
    });

    return () => {
      unsubscribeConn();
      unsubscribeCreated();
      unsubscribeUpdated();
      unsubscribeCommentary();
      socketService.disconnect();
    };
  }, [selectedSport, loadMatches]);

  // Scroll to bottom when events update
  useEffect(() => {
    if (commentaryListRef.current) {
      commentaryListRef.current.scrollTop = commentaryListRef.current.scrollHeight;
    }
  }, [commentaryByMatch, selectedMatch]);

  const handleSelectMatch = async (match) => {
    const matchId = match.id || match.externalId;
    setSelectedMatch(match);
    setLoadingCommentary(true);

    try {
      const events = await fetchCommentary(matchId);
      events.forEach(e => {
        const key = e.id || e.externalId;
        if (key) processedEventIdsRef.current.add(key);
      });

      setCommentaryByMatch(prev => ({
        ...prev,
        [matchId]: events,
        [match.id]: events,
        ...(match.externalId ? { [match.externalId]: events } : {})
      }));
    } catch (err) {
      console.error('Error fetching commentary for match:', err);
    } finally {
      setLoadingCommentary(false);
    }

    socketService.subscribe(matchId);
  };

  // Filtered matches based on tab and team search
  const filteredMatches = useMemo(() => {
    let result = matches;

    if (activeTab === 'live') {
      result = result.filter(m => m.status === 'live');
    } else if (activeTab === 'upcoming') {
      result = result.filter(m => m.status === 'scheduled');
    } else if (activeTab === 'finished') {
      result = result.filter(m => m.status === 'finished');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(m =>
        (m.homeTeam && m.homeTeam.toLowerCase().includes(q)) ||
        (m.awayTeam && m.awayTeam.toLowerCase().includes(q)) ||
        (m.leagueName && m.leagueName.toLowerCase().includes(q))
      );
    }

    return result;
  }, [matches, activeTab, searchQuery]);

  const liveMatches = useMemo(() => matches.filter(m => m.status === 'live'), [matches]);
  const upcomingMatches = useMemo(() => matches.filter(m => m.status === 'scheduled'), [matches]);
  const finishedMatches = useMemo(() => matches.filter(m => m.status === 'finished'), [matches]);

  const currentMatchEvents = selectedMatch
    ? (commentaryByMatch[selectedMatch.id] || commentaryByMatch[selectedMatch.externalId] || [])
    : [];

  return (
    <div className="container">
      <header className="app-header">
        <div className="header-left">
          <h1 className="app-title text-accent">
            <Activity size={32} />
            Sportz
          </h1>
          <span className="live-pulse-badge">Real-Time Commentary</span>
        </div>

        <div className="header-right" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button 
            className="btn btn-secondary" 
            onClick={() => loadMatches(true)}
            disabled={refreshing || loadingMatches}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}
            title="Refresh match data"
          >
            <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
            {refreshing ? 'Updating...' : 'Refresh'}
          </button>

          <div className="connection-status glass">
            {connectionState === 'Connected' ? (
              <div className="status-connected">
                <Wifi size={16} /> Live Connected
              </div>
            ) : (
              <div className="status-disconnected">
                <WifiOff size={16} /> Reconnecting...
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Warning/Error Banners */}
      {error && (
        <div className="error-banner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', padding: '0.85rem 1.25rem', margin: '0.75rem 0', borderRadius: '0.5rem', border: '1px solid #ef4444' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
          <button className="btn btn-secondary" onClick={() => loadMatches(true)} style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem' }}>
            Retry
          </button>
        </div>
      )}

      {metaInfo?.isStale && !error && (
        <div className="stale-banner" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', padding: '0.75rem 1.25rem', margin: '0.75rem 0', borderRadius: '0.5rem', border: '1px solid #f59e0b' }}>
          <Clock size={18} />
          <span>Displaying cached match data. Live provider is temporarily unreachable or rate-limited.</span>
        </div>
      )}

      <div className="layout-grid">
        <aside className="matches-column">
          <div className="sidebar-controls" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
            {/* Sport Selector */}
            <select 
              value={selectedSport} 
              onChange={(e) => {
                setSelectedSport(e.target.value);
                setSelectedMatch(null);
              }}
              style={{ 
                padding: '0.75rem', 
                borderRadius: '0.5rem', 
                width: '100%', 
                backgroundColor: 'rgba(255, 255, 255, 0.1)', 
                color: 'white', 
                border: '1px solid rgba(255, 255, 255, 0.2)',
                outline: 'none',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              <option value="football" style={{ color: 'black' }}>⚽ Football (Soccer)</option>
              <option value="basketball" style={{ color: 'black' }}>🏀 Basketball</option>
              <option value="volleyball" style={{ color: 'black' }}>🏐 Volleyball</option>
              <option value="hockey" style={{ color: 'black' }}>🏒 Hockey</option>
            </select>

            {/* Team Search Bar */}
            <div className="search-bar" style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input 
                type="text" 
                placeholder="Search team or competition..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.6rem 0.75rem 0.6rem 2.25rem',
                  borderRadius: '0.5rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: 'white',
                  fontSize: '0.9rem',
                  outline: 'none'
                }}
              />
            </div>

            {/* Filter Tabs */}
            <div className="filter-tabs" style={{ display: 'flex', gap: '0.25rem', backgroundColor: 'rgba(255, 255, 255, 0.05)', padding: '0.25rem', borderRadius: '0.5rem' }}>
              {[
                { id: 'all', label: `All (${matches.length})` },
                { id: 'live', label: `🔴 Live (${liveMatches.length})` },
                { id: 'upcoming', label: `Upcoming (${upcomingMatches.length})` },
                { id: 'finished', label: `Finished (${finishedMatches.length})` }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    flex: 1,
                    padding: '0.45rem 0.25rem',
                    fontSize: '0.78rem',
                    borderRadius: '0.35rem',
                    border: 'none',
                    backgroundColor: activeTab === tab.id ? 'rgba(59, 130, 246, 0.8)' : 'transparent',
                    color: 'white',
                    fontWeight: activeTab === tab.id ? 'bold' : 'normal',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {loadingMatches ? (
            <div className="matches-list">
              {[1, 2, 3].map(i => (
                <div key={i} className="skeleton-card glass"></div>
              ))}
            </div>
          ) : filteredMatches.length === 0 ? (
            <div className="empty-state-card glass" style={{ padding: '2rem 1rem', textAlign: 'center', color: '#94a3b8' }}>
              <Radio size={32} style={{ margin: '0 auto 0.75rem', opacity: 0.5 }} />
              {activeTab === 'live' ? (
                <>
                  <div style={{ fontWeight: '600', color: '#f1f5f9', marginBottom: '0.25rem' }}>No live matches right now</div>
                  <div style={{ fontSize: '0.85rem' }}>Check the Upcoming tab for upcoming fixtures today.</div>
                </>
              ) : searchQuery ? (
                <div>No matches match "{searchQuery}"</div>
              ) : (
                <div>No {selectedSport} matches found for today.</div>
              )}
            </div>
          ) : (
            <div className="matches-list">
              {filteredMatches.map(match => (
                <MatchCard 
                  key={match.id} 
                  match={match} 
                  isSelected={selectedMatch?.id === match.id}
                  onClick={handleSelectMatch}
                />
              ))}
            </div>
          )}
        </aside>

        <main className="commentary-column glass">
          <div className="commentary-header-sticky">
            <h2 className="section-title mb-0">Match Timeline & Events</h2>
            {selectedMatch && (
              <div className="detailed-match-header">
                <div className="detailed-score-row">
                   <div className="detailed-team">
                     {(selectedMatch.homeLogo || selectedMatch.teamsInfo?.home?.logo) && (
                       <img src={selectedMatch.homeLogo || selectedMatch.teamsInfo?.home?.logo} alt="Home" onError={(e) => { e.target.style.display = 'none'; }} />
                     )}
                     <span>{selectedMatch.homeTeam}</span>
                   </div>
                   <div className="detailed-score">
                     {selectedMatch.homeScore ?? 0} - {selectedMatch.awayScore ?? 0}
                   </div>
                   <div className="detailed-team">
                     {(selectedMatch.awayLogo || selectedMatch.teamsInfo?.away?.logo) && (
                       <img src={selectedMatch.awayLogo || selectedMatch.teamsInfo?.away?.logo} alt="Away" onError={(e) => { e.target.style.display = 'none'; }} />
                     )}
                     <span>{selectedMatch.awayTeam}</span>
                   </div>
                </div>
                <div className="detailed-meta-row text-accent">
                   {(selectedMatch.leagueName || selectedMatch.league?.name) && <span>🏆 {selectedMatch.leagueName || selectedMatch.league?.name}</span>}
                   {(selectedMatch.venue || selectedMatch.fixtureInfo?.venue?.name) && <span>🏟️ {selectedMatch.venue || selectedMatch.fixtureInfo?.venue?.name}</span>}
                   {selectedMatch.startTime && <span>⏰ {formatMatchKickoff(selectedMatch.startTime)}</span>}
                </div>
              </div>
            )}
          </div>
          
          <div className="commentary-list-container" ref={commentaryListRef}>
            {!selectedMatch ? (
              <div className="empty-state">
                <Radio size={40} style={{ opacity: 0.4, marginBottom: '0.75rem' }} />
                <div>Select a match from the sidebar to view the live timeline and events.</div>
              </div>
            ) : selectedMatch.status === 'scheduled' ? (
              <div className="empty-state">
                <Clock size={40} style={{ opacity: 0.4, marginBottom: '0.75rem' }} />
                <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>Match has not kicked off yet</div>
                <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                  Scheduled kickoff: {formatMatchKickoff(selectedMatch.startTime)}
                </div>
              </div>
            ) : loadingCommentary ? (
              <div className="commentary-feed">
                {[1, 2, 3, 4].map(i => (
                   <div key={i} className="skeleton-event glass"></div>
                ))}
              </div>
            ) : currentMatchEvents.length === 0 ? (
              <div className="empty-state">
                {selectedMatch.status === 'finished' ? (
                  <>
                    <CheckCircle size={40} style={{ opacity: 0.4, marginBottom: '0.75rem', color: '#10b981' }} />
                    <div>Match concluded. No event log available for this fixture.</div>
                  </>
                ) : (
                  <>
                    <Radio size={40} style={{ opacity: 0.4, marginBottom: '0.75rem', color: '#ef4444' }} />
                    <div style={{ fontWeight: '600' }}>Match in progress ({selectedMatch.elapsed ? `${selectedMatch.elapsed}'` : 'Live'})</div>
                    <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.25rem' }}>Waiting for key events (goals, cards, substitutions)...</div>
                  </>
                )}
              </div>
            ) : (
              <div className="commentary-feed">
                {currentMatchEvents.map((item) => (
                  <CommentaryItem key={item.id || item.externalId || `${item.minute}-${item.sequence}`} commentary={item} />
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
