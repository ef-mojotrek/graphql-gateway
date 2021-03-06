const { makeExecutableSchema } = require('@graphql-tools/schema');
const readFileSync = require('../../lib/read_file_sync');
const typeDefs = readFileSync(__dirname, 'schema.graphql');

const users = [
    { id: '1', name: 'Ada Lovelace', email: 'ada_lovelace@email.com', locationId: "1" },
    { id: '2', name: 'Alan Turing', email: 'alan_turing@email.com', locationId: "2" },
    { id: '3', name: 'Someone Else', email: 'someone_else@email.com', locationId: "1" },
  ];

const locations = [
  { id: '1', country: 'USA' },
  { id: '2', country: 'notUSA' }
]

module.exports = makeExecutableSchema({
  typeDefs,
  resolvers: {
    User: {
      location: (user) => ({ id: user.locationId })
    },
    Query: {
        _location: (root, { id }) => ({ id, users: users.filter(user => user.locationId === id) }),
        user: (root, { id }) => users.find(user => user.id === id)
    }
  }
});