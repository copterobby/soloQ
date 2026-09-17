// Lista única de módulos de comando, para no duplicarla entre index.js, deploy-commands.js
// y /help como pasaba antes.
const loluser = require('./loluser');
const games = require('./games');
const leaderboard = require('./leaderboard');
const trackchannel = require('./trackchannel');
const syncgames = require('./syncgames');
const unlink = require('./unlink');
const rank = require('./rank');
const notifications = require('./notifications');
const trackqueue = require('./trackqueue');
const weekconfig = require('./weekconfig');
const weekcount = require('./weekcount');
const oneVsOne = require('./1vs1');
const startsoloqchallenge = require('./startsoloqchallenge');
const help = require('./help');
const status = require('./status');
const setup = require('./setup');

const commandModules = [
  loluser,
  games,
  leaderboard,
  trackchannel,
  syncgames,
  unlink,
  rank,
  notifications,
  trackqueue,
  weekconfig,
  weekcount,
  oneVsOne,
  startsoloqchallenge,
  help,
  status,
  setup,
];

module.exports = { commandModules };
