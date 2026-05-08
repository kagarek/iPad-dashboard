// index.js — Express server entry point.
// Mounts API routes and serves the public/ folder as static files.

'use strict';

var express = require('express');
var path    = require('path');
var config  = require('./config/settings');

var weatherRoute = require('./routes/weather');
var newsRoute    = require('./routes/news');
var timeRoute    = require('./routes/time');

var app = express();

// --- Static files (dashboard frontend) ---
app.use(express.static(path.join(__dirname, '..', 'public')));

// --- API routes ---
app.use('/api/weather', weatherRoute);
app.use('/api/news',    newsRoute);
app.use('/api/time',    timeRoute);

// --- 404 fallback ---
app.use(function(req, res) {
  res.status(404).json({ error: 'Not found' });
});

// --- Start server, bind to all interfaces so iPad can reach it ---
app.listen(config.port, '0.0.0.0', function() {
  console.log('Dashboard server running on http://0.0.0.0:' + config.port);
  console.log('Open http://<this-machine-ip>:' + config.port + ' on your iPad');
});
