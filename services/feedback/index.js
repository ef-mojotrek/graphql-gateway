const makeServer = require('../../lib/make_server');
makeServer(require('./schema'), 'feedback', 4003);
