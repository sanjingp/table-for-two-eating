// Runtime config (plain script, loaded before the game).
//
// By default the game connects to the WebSocket server on the same host that
// served this page (ws(s)://<this host>/ws). If you host the static files
// somewhere else (e.g. GitHub Pages) and run server/server.js separately,
// set the full WebSocket URL here:
//
//   window.T42_WS_URL = 'wss://your-game-server.onrender.com/ws';
//
window.T42_WS_URL = window.T42_WS_URL || '';
