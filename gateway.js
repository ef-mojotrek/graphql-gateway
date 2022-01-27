const express = require('express');
const { graphqlHTTP } = require('express-graphql');
const { introspectSchema } = require('@graphql-tools/wrap');
const { stitchSchemas } = require('@graphql-tools/stitch');

async function makeGatewaySchema(urls) {
  const adminContext = { authHeader: 'Bearer my-app-to-app-token' };
  const subschemas = [];
  // Make remote executors:
  // these are simple functions that query a remote GraphQL API for JSON.

  // 
  for(let url of urls) {
    const remoteExecutor = makeRemoteExecutor(url);
    const schema = await introspectSchema(remoteExecutor, adminContext);

    if(remoteExecutor && schema) {
      const subschema = {
        schema: schema,
        executor: remoteExecutor,
        batch: true,
        merge: {}
      };

      subschemas.push(subschema);
    }
  }

  return stitchSchemas({
    subschemas: subschemas
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

const startServer = async () => {
  const urls = [
    'https://workflowfacade-api-dev.ehs.dev/graphql/',
    'https://internalaudit-api-dev.ehs.dev/graphql/',
    'https://notifications-api-dev.ehs.dev/graphql/'
  ]
  const schema = await makeGatewaySchema(urls);
  const app = express();
  app.use('/graphql', graphqlHTTP((req) => ({
    schema,
    context: { authHeader: req.headers.authorization },
    graphiql: true
  })));
  app.listen(4000, () => console.log('gateway running at http://localhost:4000/graphql'));
}

startServer();
  