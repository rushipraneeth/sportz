import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { WebSocket } from 'ws';
import { attachWebSocketServer } from '../src/ws/server.js';

describe('Real-Time WebSocket Communication Suite', () => {
  let server;
  let port;
  let broadcastMatchCreated;
  let broadcastMatchUpdated;
  let broadcastCommentary;

  before((t, done) => {
    server = http.createServer((req, res) => res.end('OK'));
    const wsExports = attachWebSocketServer(server);
    broadcastMatchCreated = wsExports.broadcastMatchCreated;
    broadcastMatchUpdated = wsExports.broadcastMatchUpdated;
    broadcastCommentary = wsExports.broadcastCommentary;

    server.listen(0, '127.0.0.1', () => {
      port = server.address().port;
      done();
    });
  });

  after((t, done) => {
    server.close(done);
  });

  it('receives welcome message on initial connection and responds to ping', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);

    await new Promise((resolve, reject) => {
      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'ping' }));
      });

      let gotWelcome = false;
      let gotPong = false;

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'welcome') {
          gotWelcome = true;
        } else if (msg.type === 'pong') {
          gotPong = true;
        }

        if (gotWelcome && gotPong) {
          ws.close();
          resolve();
        }
      });

      ws.on('error', reject);
    });
  });

  it('receives match_updated broadcast for scores and status changes', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);

    await new Promise((resolve, reject) => {
      ws.on('open', () => {
        // Broadcast a simulated score change
        setTimeout(() => {
          broadcastMatchUpdated({
            id: 42,
            sport: 'football',
            homeTeam: 'Liverpool',
            awayTeam: 'Man City',
            status: 'live',
            statusDetail: '2H',
            homeScore: 3,
            awayScore: 2,
            elapsed: 88
          });
        }, 50);
      });

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'match_updated') {
          assert.strictEqual(msg.data.id, 42);
          assert.strictEqual(msg.data.homeScore, 3);
          assert.strictEqual(msg.data.awayScore, 2);
          assert.strictEqual(msg.data.elapsed, 88);
          ws.close();
          resolve();
        }
      });

      ws.on('error', reject);
    });
  });

  it('delivers commentary event to subscribed match client only', async () => {
    const clientSubscribed = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const clientUnsubscribed = new WebSocket(`ws://127.0.0.1:${port}/ws`);

    await new Promise((resolve, reject) => {
      let subOpened = false;
      let unsubOpened = false;

      function checkReady() {
        if (subOpened && unsubOpened) {
          // Subscribe client 1 to match 777
          clientSubscribed.send(JSON.stringify({ type: 'subscribe', matchId: 777 }));
        }
      }

      clientSubscribed.on('open', () => {
        subOpened = true;
        checkReady();
      });

      clientUnsubscribed.on('open', () => {
        unsubOpened = true;
        checkReady();
      });

      let unsubReceivedCommentary = false;
      clientUnsubscribed.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'commentary' && msg.data?.matchId === 777) {
          unsubReceivedCommentary = true;
        }
      });

      clientSubscribed.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'subscribed') {
          // Once subscribed, broadcast an event for match 777
          broadcastCommentary(777, {
            id: 501,
            matchId: 777,
            minute: 90,
            eventType: 'goal',
            message: 'GOAL! Stoppage time winner!'
          });
        } else if (msg.type === 'commentary') {
          assert.strictEqual(msg.data.matchId, 777);
          assert.strictEqual(msg.data.eventType, 'goal');
          assert.strictEqual(unsubReceivedCommentary, false);
          clientSubscribed.close();
          clientUnsubscribed.close();
          resolve();
        }
      });

      clientSubscribed.on('error', reject);
      clientUnsubscribed.on('error', reject);
    });
  });
});
