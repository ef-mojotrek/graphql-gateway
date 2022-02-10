const express = require('express');
const { introspectSchema, RenameTypes } = require('@graphql-tools/wrap');
const { graphqlHTTP } = require('express-graphql');
const { stitchSchemas } = require('@graphql-tools/stitch');

async function makeGatewaySchema(subgraphs) {
  const adminContext = { authHeader: 'Bearer my-app-to-app-token' };
  const subschemas = [];
  // Make remote executors:
  // these are simple functions that query a remote GraphQL API for JSON.

  // 
  for(let subgraph of subgraphs) {
    const remoteExecutor = makeRemoteExecutor(subgraph.url);
    const schema = await introspectSchema(remoteExecutor, adminContext);

    if(remoteExecutor && schema) {
      const subschema = {
        schema: schema,
        executor: remoteExecutor,
        batch: true,
        merge: subgraph.merge,
        transforms: subgraph.transforms || []
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
  const subgrahs = [
    {
      url: 'https://workflowfacade-api-dev.ehs.dev/graphql/',
      merge: {
        Workflow: {
          selectionSet: `{ id }`,
          fieldName: 'workflow',
          args: ({ id }) => ({ id })
        }
      }
    },
    {
      url:'https://internalaudit-api-dev.ehs.dev/graphql/' ,
      merge: {
        InternalAuditGraphQueryModel: [
          {
            selectionSet: `{ id }`,
            fieldName: 'InternalAuditGraphQueryModel',
            args: ({ id }) => ({ id })
          }
        ],
        // Workflow: [
        //   {
        //     selectionSet: `{ id }`,
        //     fieldName: `workflow`,
        //     args: ({ id }) => ({ id })
        //   }
        // ]
      },
      transforms: [
        new RenameTypes((name) => {return name.includes(`WorkflowGraphQueryModel`) ? `_Workflow` : name})
        // new RenameRootFields((op, name) => `rainforest${name.charAt(0).toUpperCase()}${name.slice(1)}`),
      ]
    },
    {
      url: 'https://notifications-api-dev.ehs.dev/graphql/',
      merge: {}
    },
    {
      url: 'http://localhost:4001/graphql',
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
      url: 'http://localhost:4002/graphql',
      merge: {
        Location: {
          selectionSet: `{ id }`,
          fieldName: 'location',
          args: ({ id }) => ({ id })
        }
      }
    },
    {
      url: 'http://localhost:4003/graphql',
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
  ]
  const schema = await makeGatewaySchema(subgrahs);
  const app = express();
  app.use('/graphql', graphqlHTTP((req) => ({
    schema,
    context: { authHeader: req.headers.authorization },
    graphiql: true
  })));
  app.listen(4000, () => console.log('gateway running at http://localhost:4000/graphql'));
}

startServer();
  