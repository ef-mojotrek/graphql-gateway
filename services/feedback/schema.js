const { makeExecutableSchema } = require('@graphql-tools/schema');
const readFileSync = require('../../lib/read_file_sync');
const typeDefs = readFileSync(__dirname, 'schema.graphql');

const feedbacks = [
    { id: '1', ownerId: '1', description: 'Good' },
    { id: '2', ownerId: '1', description: 'Great' },
    { id: '3', ownerId: '1', description: 'Poor' },
    { id: '4', ownerId: '2', description: 'Great' },
    { id: '5', ownerId: '2', description: 'Poor' },
  ];

module.exports = makeExecutableSchema({
  typeDefs,
  resolvers: {
    Feedback: {
        owner: (feedback) => ({ id: feedback.ownerId }),
    },
    User: {
        feedback: (user) => feedbacks.filter(feedback => feedback.ownerId === user.id),
    },
    Query: {
        _user: (root, { id }) => ({ id, feedbacks: feedbacks.filter(feedback => feedback.ownerId === id) }),
        feedback: (root, { id }) => feedbacks.find(feedback => feedback.id === id),
        feedbacks: (root, { ids }) => ids.map((id) => feedbacks.find(f => f.id === id)), 
        // feedbackByUser: (root, { ownerId }) => , 
    }
  }
});