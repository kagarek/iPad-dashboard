// routes/time.js — GET /api/time
// Returns the server's current time. Used by the frontend as a sanity check
// and to display the correct timezone label if needed.

'use strict';

var express = require('express');
var router  = express.Router();

router.get('/', function(req, res) {
  res.json({
    iso:      new Date().toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
});

module.exports = router;
