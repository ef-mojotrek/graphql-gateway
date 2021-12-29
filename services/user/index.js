const makeServer = require('../../lib/make_server');
makeServer(require('./schema'), 'user', 4001);
