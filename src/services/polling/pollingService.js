import { db } from '../../db/db.js';
import { matches, commentary } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { sportsProvider } from '../sports/sportsProvider.js';
import { upsertMatches } from '../matchService.js';

class PollingService {
    constructor(appLocals) {
        this.appLocals = appLocals;
        this.timeoutId = null;
        this.isPolling = false;
        this.POLLING_INTERVAL_MS = parseInt(process.env.POLLING_INTERVAL_MS || '60000', 10);
        this.IDLE_INTERVAL_MS = parseInt(process.env.POLLING_IDLE_INTERVAL_MS || '180000', 10); // 3 mins when no live matches
    }

    start() {
        if (this.timeoutId) return;
        console.log(`[PollingService] Started background sports data synchronizer.`);
        this.scheduleNextPoll(1000); // Initial poll after 1s
    }

    stop() {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
            console.log('[PollingService] Stopped.');
        }
    }

    scheduleNextPoll(delayMs) {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
        }
        this.timeoutId = setTimeout(() => this.poll(), delayMs);
    }

    async poll() {
        if (this.isPolling) {
            console.warn('[PollingService] Previous poll still in progress. Skipping cycle.');
            return;
        }

        this.isPolling = true;
        try {
            console.log("[PollingService] Polling sports fixtures and live events...");
            const sports = Object.keys(sportsProvider.services);
            let activeLiveMatchCount = 0;

            for (const sport of sports) {
                try {
                    // Force refresh to bypass cache and fetch freshest provider data
                    const fixtures = await sportsProvider.getMatches(sport, true);

                    for (const fixture of fixtures) {
                        if (fixture.status === 'live' || fixture.isInPlay) {
                            activeLiveMatchCount++;
                        }
                        await this.processFixture(sport, fixture);
                    }
                } catch (e) {
                    console.error(`[PollingService] Error polling sport ${sport}:`, e.message);
                }
            }

            // Adaptive backoff: poll faster when matches are actively in-play
            if (activeLiveMatchCount === 0) {
                console.log(`[PollingService] No active live matches currently playing. Next poll in ${this.IDLE_INTERVAL_MS / 1000}s.`);
                this.scheduleNextPoll(this.IDLE_INTERVAL_MS);
            } else {
                console.log(`[PollingService] ${activeLiveMatchCount} active live matches found. Next poll in ${this.POLLING_INTERVAL_MS / 1000}s.`);
                this.scheduleNextPoll(this.POLLING_INTERVAL_MS);
            }
        } catch (err) {
            console.error("[PollingService] Unexpected error during polling cycle:", err.message);
            this.scheduleNextPoll(this.POLLING_INTERVAL_MS);
        } finally {
            this.isPolling = false;
        }
    }

    async processFixture(sport, fixtureData) {
        try {
            const resolvedId = fixtureData.id || fixtureData.externalId;
            let matchRecord = null;
            try {
                matchRecord = await db.query.matches.findFirst({
                    where: eq(matches.externalId, fixtureData.externalId)
                });
            } catch {
                // If DB is offline, continue with in-memory fixture
            }

            let isNew = false;
            let statusChanged = false;
            let scoreChanged = false;
            let minuteChanged = false;

            if (!matchRecord) {
                let inserted = { ...fixtureData, id: resolvedId };
                try {
                    const [res] = await upsertMatches([fixtureData]);
                    if (res) inserted = res;
                } catch {
                    // Fall back to in-memory object
                }
                matchRecord = inserted;
                isNew = true;

                if (this.appLocals?.broadcastMatchCreated) {
                    this.appLocals.broadcastMatchCreated(matchRecord);
                }
            } else {
                statusChanged = matchRecord.status !== fixtureData.status || matchRecord.statusDetail !== fixtureData.statusDetail;
                scoreChanged = matchRecord.homeScore !== fixtureData.homeScore || matchRecord.awayScore !== fixtureData.awayScore;
                minuteChanged = matchRecord.elapsed !== fixtureData.elapsed;

                if (statusChanged || scoreChanged || minuteChanged) {
                    let updated = {
                        ...matchRecord,
                        ...fixtureData,
                        id: matchRecord.id || resolvedId
                    };

                    try {
                        const [res] = await db.update(matches)
                            .set({
                                status: fixtureData.status,
                                statusDetail: fixtureData.statusDetail || matchRecord.statusDetail,
                                homeScore: fixtureData.homeScore,
                                awayScore: fixtureData.awayScore,
                                elapsed: fixtureData.elapsed ?? matchRecord.elapsed,
                                leagueName: fixtureData.leagueName || matchRecord.leagueName,
                                leagueLogo: fixtureData.leagueLogo || matchRecord.leagueLogo,
                                homeLogo: fixtureData.homeLogo || matchRecord.homeLogo,
                                awayLogo: fixtureData.awayLogo || matchRecord.awayLogo,
                                venue: fixtureData.venue || matchRecord.venue,
                                lastRefreshedAt: new Date(),
                                endTime: fixtureData.endTime || matchRecord.endTime
                            })
                            .where(eq(matches.id, matchRecord.id))
                            .returning();
                        if (res) updated = res;
                    } catch {
                        // DB offline fallback
                    }

                    matchRecord = updated;

                    // Real-time broadcast for match updates (score and status change)
                    if (this.appLocals?.broadcastMatchUpdated) {
                        this.appLocals.broadcastMatchUpdated(matchRecord);
                    }
                }
            }

            // Sync commentary events if match is live, just finished, or score changed
            if (matchRecord.status === 'live' || statusChanged || scoreChanged) {
                try {
                    const events = await sportsProvider.getMatchEvents(sport, fixtureData.externalId);

                    for (const eventData of events) {
                        if (!eventData.externalId) continue;

                        let existingEvent = null;
                        try {
                            existingEvent = await db.query.commentary.findFirst({
                                where: eq(commentary.externalId, eventData.externalId)
                            });
                        } catch {
                            // DB offline
                        }

                        if (!existingEvent) {
                            let insertedEvent = {
                                ...eventData,
                                matchId: matchRecord.id || resolvedId
                            };

                            try {
                                const [dbResult] = await db.insert(commentary).values({
                                    externalId: eventData.externalId,
                                    matchId: matchRecord.id || resolvedId,
                                    minute: eventData.minute,
                                    sequence: eventData.sequence,
                                    period: eventData.period,
                                    eventType: eventData.eventType,
                                    actor: eventData.actor,
                                    team: eventData.team,
                                    message: eventData.message,
                                    metadata: eventData.metadata
                                }).returning();
                                if (dbResult) insertedEvent = dbResult;
                            } catch {
                                // DB offline fallback
                            }

                            if (this.appLocals?.broadcastCommentary) {
                                this.appLocals.broadcastCommentary(matchRecord.id || resolvedId, insertedEvent);
                            }
                        }
                    }
                } catch (eventsErr) {
                    // Suppress provider commentary fetch failure in background
                }
            }
        } catch (err) {
            console.error(`[PollingService] Error processing fixture ${fixtureData?.externalId}:`, err.message);
        }
    }
}

export const startPolling = (appLocals) => {
    const service = new PollingService(appLocals);
    service.start();
    return service;
};
