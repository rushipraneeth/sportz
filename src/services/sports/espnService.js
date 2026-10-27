/**
 * ESPN Open Soccer Provider
 * Completely free, requires no API key, and provides real-time scoreboards, team logos, and live commentary.
 */

import { normalizeMatchStatus } from '../../utils/statusNormalizer.js';

const SOCCER_LEAGUES = [
    { code: 'eng.1', name: 'English Premier League' },
    { code: 'uefa.champions', name: 'UEFA Champions League' },
    { code: 'esp.1', name: 'Spanish La Liga' },
    { code: 'ita.1', name: 'Italian Serie A' },
    { code: 'ger.1', name: 'German Bundesliga' },
    { code: 'fra.1', name: 'French Ligue 1' }
];

export async function fetchEspnSoccerMatches() {
    const allMatches = [];

    for (const league of SOCCER_LEAGUES) {
        try {
            const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${league.code}/scoreboard`;
            const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
            if (!res.ok) continue;

            const json = await res.json();
            const events = json.events || [];

            for (const ev of events) {
                const competition = ev.competitions?.[0];
                if (!competition) continue;

                const competitors = competition.competitors || [];
                const homeComp = competitors.find(c => c.homeAway === 'home') || competitors[0];
                const awayComp = competitors.find(c => c.homeAway === 'away') || competitors[1];

                if (!homeComp || !awayComp) continue;

                const shortDetail = ev.status?.type?.shortDetail || ev.status?.type?.detail || '';
                const completed = Boolean(ev.status?.type?.completed);
                const inProgress = ev.status?.type?.state === 'in';

                // Map ESPN status codes to our status normalizer
                let normalizedCode = 'NS';
                if (shortDetail.includes('FT') || completed) normalizedCode = 'FT';
                else if (shortDetail.includes('HT') || shortDetail.toLowerCase().includes('half')) normalizedCode = 'HT';
                else if (inProgress) normalizedCode = '1H';
                else if (shortDetail.includes('PST') || shortDetail.toLowerCase().includes('postponed')) normalizedCode = 'PST';
                else if (shortDetail.includes('CANC') || shortDetail.toLowerCase().includes('cancelled')) normalizedCode = 'CANC';

                const normalized = normalizeMatchStatus(normalizedCode, 'football');

                // Extract elapsed minute from displayClock e.g. "45'+2'" or "72'"
                const rawClock = ev.status?.displayClock || '';
                const matchMinute = parseInt(rawClock.replace(/[^0-9]/g, ''), 10) || null;

                const matchIdInt = parseInt(ev.id, 10);
                const safeExternalId = isNaN(matchIdInt) ? Math.abs(ev.id.split('').reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0)) : matchIdInt;

                allMatches.push({
                    externalId: safeExternalId,
                    sport: 'football',
                    homeTeam: homeComp.team?.displayName || 'Home Team',
                    awayTeam: awayComp.team?.displayName || 'Away Team',
                    status: normalized.dbStatus,
                    statusDetail: normalizedCode === 'FT' ? 'FT' : (normalizedCode === 'HT' ? 'HT' : (inProgress ? 'LIVE' : 'NS')),
                    displayText: normalized.displayText,
                    isInPlay: inProgress,
                    startTime: ev.date ? new Date(ev.date) : null,
                    endTime: completed ? new Date() : null,
                    homeScore: parseInt(homeComp.score || '0', 10),
                    awayScore: parseInt(awayComp.score || '0', 10),
                    leagueName: league.name,
                    leagueLogo: json.leagues?.[0]?.logos?.[0]?.href || null,
                    homeLogo: homeComp.team?.logo || null,
                    awayLogo: awayComp.team?.logo || null,
                    venue: competition.venue?.fullName || null,
                    elapsed: matchMinute,
                    league: {
                        name: league.name,
                        logo: json.leagues?.[0]?.logos?.[0]?.href || null
                    },
                    teamsInfo: {
                        home: { name: homeComp.team?.displayName, logo: homeComp.team?.logo },
                        away: { name: awayComp.team?.displayName, logo: awayComp.team?.logo }
                    },
                    fixtureInfo: {
                        venue: { name: competition.venue?.fullName },
                        status: { short: normalizedCode, elapsed: matchMinute }
                    }
                });
            }
        } catch (err) {
            console.warn(`[EspnService] Error fetching ${league.name}:`, err.message);
        }
    }

    return allMatches;
}

export async function fetchEspnSoccerEvents(eventId) {
    if (!eventId) return [];

    for (const league of SOCCER_LEAGUES) {
        try {
            const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${league.code}/summary?event=${eventId}`;
            const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
            if (!res.ok) continue;

            const json = await res.json();
            const commentaryList = json.commentary || [];

            if (commentaryList.length > 0) {
                return commentaryList.map((item, index) => {
                    const text = item.text || '';
                    let eventType = 'event';

                    if (/goal|scores!/i.test(text)) eventType = 'goal';
                    else if (/yellow card/i.test(text)) eventType = 'yellow_card';
                    else if (/red card/i.test(text)) eventType = 'red_card';
                    else if (/substitution/i.test(text)) eventType = 'substitution';
                    else if (/penalty/i.test(text)) eventType = 'penalty';
                    else if (/offside/i.test(text)) eventType = 'foul';

                    const minuteMatch = (item.time?.displayValue || '').match(/(\d+)/);
                    const minute = minuteMatch ? parseInt(minuteMatch[1], 10) : (item.time?.value ? Math.floor(item.time.value / 60) : 0);

                    const safeExternalId = Math.abs(((Number(eventId % 100000) * 31 + minute * 17 + index) % 2147483640) + 1);

                    return {
                        externalId: safeExternalId,
                        minute,
                        sequence: item.sequence ?? index,
                        period: minute > 45 ? '2nd Half' : '1st Half',
                        eventType,
                        actor: null,
                        team: null,
                        message: text,
                        metadata: {
                            rawTime: item.time?.displayValue
                        }
                    };
                });
            }
        } catch {
            // Check next league
        }
    }

    return [];
}
