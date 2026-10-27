import { MATCH_STATUS } from '../validation/matches.js';
import { normalizeMatchStatus, DB_MATCH_STATUS } from './statusNormalizer.js';

/**
 * Derives a fallback match status if external provider status is completely missing.
 * Provider status must always be favored over wall-clock estimates.
 */
export function getMatchStatus(startTime, endTime, now = new Date()) {
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : null;

    if (Number.isNaN(start.getTime())) {
        return MATCH_STATUS.SCHEDULED;
    }

    if (now < start) {
        return MATCH_STATUS.SCHEDULED;
    }

    // Only mark finished if explicit endTime exists and now >= end
    if (end && !Number.isNaN(end.getTime()) && now >= end) {
        return MATCH_STATUS.FINISHED;
    }

    // If kickoff has passed and no end time or now < end, it might be in progress
    return MATCH_STATUS.LIVE;
}

/**
 * Synchronizes match status favoring the provider's authoritative status.
 */
export async function syncMatchStatus(match, updateStatus) {
    if (!match) return null;
    
    // If the match already has a provider status code, normalize it
    if (match.detailedStatus || match.status) {
        const normalized = normalizeMatchStatus(match.detailedStatus || match.status, match.sport);
        if (match.status !== normalized.dbStatus) {
            await updateStatus(normalized.dbStatus);
            match.status = normalized.dbStatus;
        }
        return match.status;
    }

    const nextStatus = getMatchStatus(match.startTime, match.endTime);
    if (!nextStatus) {
        return match.status;
    }
    if (match.status !== nextStatus) {
        await updateStatus(nextStatus);
        match.status = nextStatus;
    }
    return match.status;
}