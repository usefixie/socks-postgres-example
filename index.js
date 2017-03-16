'use strict';

const express = require('express');
const pg = require('pg');
const SocksConnection = require('socksjs');
const url = require('url');

const app = express();
const fixieUrl = process.env.FIXIE_SOCKS_HOST;
const fixieValues = fixieUrl.split(new RegExp('[/(:\\/@)/]+'));
const httpPort = process.env.PORT || 8080;

function handleError(err, res) {
  console.log(err);
  res.send(err);
}

function pgConnect(config, callback) {
  const connectionConfig = {
    user: config.user,
    password: config.password,
    database: config.database,
  };

  if (config.useSocks) {
    const pgServer = {
      host: config.host,
      port: config.port
    };
    const fixieConnection = new SocksConnection(pgServer, {
      user: fixieValues[0],
      pass: fixieValues[1],
      host: fixieValues[2],
      port: fixieValues[3],
    });
    connectionConfig.stream = fixieConnection;
  } else {
    connectionConfig.host = config.host;
    connectionConfig.port = config.port;
  }

  var client = new pg.Client(connectionConfig);

  client.connect(err => {
    callback(err, client);
  });
}

function requestHandler(req, res) {
  const dbURL = req.query.url;
  let config;
  try {
    const parsedURL = url.parse(dbURL);
    const auth = parsedURL.auth.split(':');
    config = {
      user: auth[0],
      password: auth[1],
      host: parsedURL.hostname,
      port: parsedURL.port,
      database: parsedURL.pathname.substr(1)
    }
  } catch (e) {
    return res.send('Invalid DB URL');
  }
  if (req.query.useSocks && req.query.useSocks.toLowerCase() == 'true') {
    config.useSocks = true;
  }

  pgConnect(config, (err, client) => {
    if (err) return handleError(err, res);
    client.query('SELECT 1+1 as sum', function (err, result) {
      if (err) return handleError(err, res);
      client.end(function (err) {
        if (err) return handleError(err, res);
        res.send('1+1 is: ' + JSON.stringify(result.rows[0]));
      });
    });
  });
}

app.get('/', function(req, res) {
  res.send('Hello world!<br /><br />To test, go to /test?useSocks=true&url=DATABASE_URL_OF_DB');
});

app.get('/test', requestHandler);

app.listen(httpPort, function() {
  console.log('App is running on port ' + httpPort);
});
