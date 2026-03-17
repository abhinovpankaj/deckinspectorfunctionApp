"use strict";
require('dotenv').config();
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const express = require('express');
const app =  express();
var path = require('path');
var bodyParser = require('body-parser');
const cors = require('cors');

//var router   = require('routes');
var couchbase = require('./database/couchbase');

app.use(cors());
app.timeout = 600000;

require('./routes')(app);

app.use(bodyParser.json());
//app.use('/api', router);

// ERROR Handler 400
//Swagger details
const options = {
    definition: {
      openapi: "3.0.0",
      info: {
        title: "Library API",
        version: "1.0.0",
        description: "DeckInspectors Library API",
        termsOfService: "http://example.com/terms/",
        contact: {
          name: "API Support",
          url: "http://www.exmaple.com/support",
          email: "support@example.com",
        },
      },
  
      servers: [
        {
          url: "https://deckinspectorswebapi.azurewebsites.net",
          description: "Prod Deck Inspectors Documentation",
        },
        {
          url: "http://localhost:3000",
          description: "Local Deck Inspectors Documentation",
        },
      ],
    },
    apis: ['./api-docs/*.yaml'],
  };
  
  
const specs = swaggerJsdoc(options);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs));

// Initialize SERVER & DB connection once
(async () => {
  try {
    await couchbase.connectToDatabase();
    console.log('✓ Couchbase connection successful');
    app.set('port', process.env.PORT || 3000);
    var server = app.listen(app.get('port'), function () {
      console.log('Express server listening on port ' + server.address().port);
    });
  } catch (error) {
    console.error('✗ Failed to connect to Couchbase:', error.message);
    process.exit(1);
  }
})();

