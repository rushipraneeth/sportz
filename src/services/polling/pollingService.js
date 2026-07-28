import { db } from '../../db/db.js';
import { matches, commentary } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { sportsProvider } from '../sports/sportsProvider.js';

class PollingService {
    constructor(appLocals) {
        this.appLocals = appLocals;
        this.timeoutId = null;
        this.POLLING_INTERVAL_MS = parseInt(process.env.POLLING_INTERVAL_MS || '60000');
    }

    start() {
        if (this.timeoutId) return;
        console.log(`Starting PollingService.`);
        this.scheduleNextPoll(0); // Initial poll immediately
    }

    stop() {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
            console.log('PollingService stopped.');
        }
    }

    scheduleNextPoll(delayMs) {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
        }
        this.timeoutId = setTimeout(() => this.poll(), delayMs);
    }

    async poll() {
        try {
            console.log("Polling live matches across all sports...");
            const sports = Object.keys(sportsProvider.services);
            let totalLiveFixtures = 0;

            for (const sport of sports) {
                try {
                    const liveFixtures = await sportsProvider.getMatches(sport);
                    totalLiveFixtures += liveFixtures.length;

                    for (const fixture of liveFixtures) {
                        await this.processFixture(sport, fixture);
                    }
                } catch (e) {
                    console.error(`Error polling sport ${sport}:`, e);
                }
            }

            // Intelligent Polling Backoff
            if (totalLiveFixtures === 0) {
                const idleInterval = this.POLLING_INTERVAL_MS * 5; // 5x slower
                console.log(`No live matches found. Backing off polling to ${idleInterval}ms.`);
                this.scheduleNextPoll(idleInterval);
            } else {
                this.scheduleNextPoll(this.POLLING_INTERVAL_MS);
            }
        } catch (err) {
            console.error("Error during polling:", err);
            this.scheduleNextPoll(this.POLLING_INTERVAL_MS);
        }
    }

    async processFixture(sport, fixtureData) {
        try {
            // 1. Check if match exists in DB
            let matchRecord = await db.query.matches.findFirst({
                where: eq(matches.externalId, fixtureData.externalId)
            });

            let isNew = false;
            let statusChanged = false;
            let scoreChanged = false;

            if (!matchRecord) {
                // Insert new match
                const [inserted] = await db.insert(matches).values({
                    externalId: fixtureData.externalId,
                    sport: fixtureData.sport,
                    homeTeam: fixtureData.homeTeam,
                    awayTeam: fixtureData.awayTeam,
                    status: fixtureData.status,
                    startTime: fixtureData.startTime,
                    homeScore: fixtureData.homeScore,
                    awayScore: fixtureData.awayScore
                }).returning();
                matchRecord = inserted;
                isNew = true;

                if (this.appLocals && this.appLocals.broadcastMatchCreated) {
                    this.appLocals.broadcastMatchCreated(matchRecord);
                }
            } else {
                // Check for updates
                if (matchRecord.status !== fixtureData.status || 
                    matchRecord.homeScore !== fixtureData.homeScore || 
                    matchRecord.awayScore !== fixtureData.awayScore) {
                    
                    statusChanged = matchRecord.status !== fixtureData.status;
                    scoreChanged = matchRecord.homeScore !== fixtureData.homeScore || matchRecord.awayScore !== fixtureData.awayScore;

                    const [updated] = await db.update(matches)
                        .set({
                            status: fixtureData.status,
                            homeScore: fixtureData.homeScore,
                            awayScore: fixtureData.awayScore,
                            endTime: fixtureData.endTime
                        })
                        .where(eq(matches.id, matchRecord.id))
                        .returning();
                    matchRecord = updated;
                    
                    // Note: We might want to broadcast the updated match if frontend listens to it.
                    // Currently, frontend updates score via commentary events.
                }
            }

            // 2. Fetch and process events if it's new or score changed or just to keep up to date
            // To save API calls, we might only fetch events if it's live.
            if (matchRecord.status === 'live' || statusChanged || scoreChanged || isNew) {
                const events = await sportsProvider.getMatchEvents(sport, fixtureData.externalId);
                
                for (const eventData of events) {
                    // Check if event already exists
                    const existingEvent = await db.query.commentary.findFirst({
                        where: eq(commentary.externalId, eventData.externalId)
                    });

                    if (!existingEvent) {
                        const [insertedEvent] = await db.insert(commentary).values({
                            externalId: eventData.externalId,
                            matchId: matchRecord.id,
                            minute: eventData.minute,
                            sequence: eventData.sequence,
                            period: eventData.period,
                            eventType: eventData.eventType,
                            actor: eventData.actor,
                            team: eventData.team,
                            message: eventData.message,
                            metadata: eventData.metadata
                        }).returning();

                        if (this.appLocals && this.appLocals.broadcastCommentary) {
                            this.appLocals.broadcastCommentary(matchRecord.id, insertedEvent);
                        }
                    }
                }
            }

        } catch (err) {
            console.error(`Error processing fixture ${fixtureData.externalId}:`, err);
        }
    }
}

export const startPolling = (appLocals) => {
    const service = new PollingService(appLocals);
    service.start();
    return service;
};
