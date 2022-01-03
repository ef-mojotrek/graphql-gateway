const waitOn = require('wait-on');
const express = require('express');
const { graphqlHTTP } = require('express-graphql');
const { introspectSchema } = require('@graphql-tools/wrap');
const { stitchSchemas } = require('@graphql-tools/stitch');
const { buildSchema } = require('graphql');

const makeRemoteExecutor = require('./lib/make_remote_executor');

async function makeGatewaySchema() {
  // Make remote executors:
  // these are simple functions that query a remote GraphQL API for JSON.
  const userExec = makeRemoteExecutor('http://localhost:4001/graphql');
  const locationExec = makeRemoteExecutor('http://localhost:4002/graphql');
  const feedbackExec = makeRemoteExecutor('http://localhost:4003/graphql');
  const adminContext = { authHeader: 'Bearer my-app-to-app-token' };

  return stitchSchemas({
    subschemas: [
      {
        // 1. Introspect a remote schema. Simple, but there are caveats:
        // - Remote server must enable introspection.
        // - Custom directives are not included in introspection.
        schema: await introspectSchema(userExec, adminContext),
        executor: userExec,
        batch: true,
        merge: {
          Location: {
            selectionSet: `{ id }`,
            fieldName: '_location',
            args: ({ id }) => ({ id })
          },
          User: {
            selectionSet: `{ id }`,
            fieldName: 'user',
            args: ({ id }) => ({ id: id })
          }
        }
      },
      {
        // 2. Manually fetch a remote SDL string, then build it into a simple schema.
        // - Use any strategy to load the SDL: query it via GraphQL, load it from a repo, etc.
        // - Allows the remote schema to include custom directives.
        // schema: buildSchema(await fetchRemoteSDL(locationExec)),
        schema: await introspectSchema(locationExec, adminContext),
        executor: locationExec,
        batch: true,
        merge: {
          Location: {
            selectionSet: `{ id }`,
            fieldName: 'location',
            args: ({ id }) => ({ id })
          }
        }
      },
      {
        schema: await introspectSchema(feedbackExec, adminContext),
        executor: feedbackExec,
        batch: true,
        merge: {
          Feedback: {
            selectionSet: `{ id }`,
            fieldName: 'feedback',
            args: ({ id }) => ({ id })
          },
          User: {
            selectionSet: `{ id }`,
            fieldName: '_user',
            args: ({ id }) => ({ id })
          }
        }
      }
    ],
    // 5. Add additional schema directly into the gateway proxy layer.
    // Under the hood, `stitchSchemas` is a wrapper for `makeExecutableSchema`,
    // and accepts all of its same options. This allows extra type definitions
    // and resolvers to be added directly into the top-level gateway proxy schema.
    typeDefs: 'type Query { heartbeat: String! }',
    resolvers: {
      Query: {
        heartbeat: () => 'OK'
      }
    }
  });
}

// Custom fetcher that queries a remote schema for an "sdl" field.
// This is NOT a standard GraphQL convention – it's just a simple way
// for a remote API to provide its own schema, complete with custom directives.
async function fetchRemoteSDL(executor, context) {
  const result = await executor({ document: '{ _sdl }', context });
  return result.data._sdl;
}

waitOn({ resources: ['tcp:4001', 'tcp:4002', 'tcp:4003'] }, async () => {
  const schema = await makeGatewaySchema();
  const app = express();
  app.use('/graphql', graphqlHTTP((req) => ({
    schema,
    context: { authHeader: req.headers.authorization },
    graphiql: true
  })));
  app.listen(4000, () => console.log('gateway running at http://localhost:4000/graphql'));
});