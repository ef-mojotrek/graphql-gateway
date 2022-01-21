const waitOn = require('wait-on');
const express = require('express');
const { graphqlHTTP } = require('express-graphql');
const { introspectSchema } = require('@graphql-tools/wrap');
const { stitchSchemas } = require('@graphql-tools/stitch');

// const makeRemoteExecutor = require('./lib/make_remote_executor');

async function makeGatewaySchema() {
  // Make remote executors:
  // these are simple functions that query a remote GraphQL API for JSON.
  const userExec = makeRemoteExecutor('http://localhost:4001/graphql');
  const locationExec = makeRemoteExecutor('http://localhost:4002/graphql');
  const feedbackExec = makeRemoteExecutor('http://localhost:4003/graphql');
  const workflowFacadeExec = makeRemoteExecutor('http://3.235.246.229:8080/graphql');
  const internalAuditExec = makeRemoteExecutor('http://3.235.246.229:8081/graphql');
  const adminContext = { authHeader: 'Bearer my-app-to-app-token' };

  return stitchSchemas({
    subschemas: [
      {
        schema: await introspectSchema(workflowFacadeExec, adminContext),
        executor: workflowFacadeExec,
        batch: true
      },
      {
        schema: await introspectSchema(internalAuditExec, adminContext),
        executor: internalAuditExec,
        batch: true
      },
      {  
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
          Feedback: {
            selectionSet: `{ id }`,
            fieldName: `feedbacks`,
            key: ({ id }) => id,
            argsFromKeys: (ids) => ({ ids }),
          },
          User: {
            selectionSet: `{ id }`,
            fieldName: '_user',
            args: ({ id }) => ({ id })
          }
        }
      }
    ],
    // Add additional schema directly into the gateway proxy layer.
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


const { fetch } = require('cross-fetch');
const { print } = require('graphql');

// Builds a remote schema executor function,
// customize any way that you need (auth, headers, etc).
// Expects to receive an object with "document" and "variable" params,
// and asynchronously returns a JSON response from the remote.
function makeRemoteExecutor(url) {
  return async ({ document, variables, context }) => {
    const query = typeof document === 'string' ? document : print(document);
    const fetchResult = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': context.authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });
    return fetchResult.json();
  };
};

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