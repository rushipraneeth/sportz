import { pgTable, serial, text, timestamp, pgEnum, integer, jsonb, index } from 'drizzle-orm/pg-core';

export const matchStatusEnum = pgEnum('match_status', ['scheduled', 'live', 'finished']);

export const matches = pgTable('matches', {
  id: serial('id').primaryKey(),
  externalId: integer('external_id').unique(),
  sport: text('sport').notNull(),
  homeTeam: text('home_team').notNull(),
  awayTeam: text('away_team').notNull(),
  status: matchStatusEnum('status').default('scheduled').notNull(),
  statusDetail: text('status_detail'), // e.g., '1H', 'HT', '2H', 'ET', 'P', 'FT', 'PST'
  startTime: timestamp('start_time'),
  endTime: timestamp('end_time'),
  homeScore: integer('home_score').default(0).notNull(),
  awayScore: integer('away_score').default(0).notNull(),
  leagueName: text('league_name'),
  leagueLogo: text('league_logo'),
  homeLogo: text('home_logo'),
  awayLogo: text('away_logo'),
  venue: text('venue'),
  elapsed: integer('elapsed'),
  lastRefreshedAt: timestamp('last_refreshed_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('matches_sport_status_idx').on(table.sport, table.status),
  index('matches_start_time_idx').on(table.startTime),
  index('matches_external_id_idx').on(table.externalId)
]);

export const commentary = pgTable('commentary', {
  id: serial('id').primaryKey(),
  externalId: integer('external_id').unique(),
  matchId: integer('match_id')
    .references(() => matches.id)
    .notNull(),
  minute: integer('minute'),
  sequence: integer('sequence'),
  period: text('period'),
  eventType: text('event_type'),
  actor: text('actor'),
  team: text('team'),
  message: text('message'),
  metadata: jsonb('metadata'),
  tags: text('tags').array(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('commentary_match_id_idx').on(table.matchId),
  index('commentary_external_id_idx').on(table.externalId)
]);
