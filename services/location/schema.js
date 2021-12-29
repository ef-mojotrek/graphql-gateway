const { makeExecutableSchema } = require('@graphql-tools/schema');
const readFileSync = require('../../lib/read_file_sync');
const typeDefs = readFileSync(__dirname, 'schema.graphql');

const locations = [
    { id: '1', city: 'New York', state: 'New York' },
    { id: '2', city: 'Chicago', state: 'Illinois' },
  ];

module.exports = makeExecutableSchema({
  typeDefs,
  resolvers: {
    Query: {
        location: (root, { id }) => locations.find(location => location.id === id)
    }
  }
});



