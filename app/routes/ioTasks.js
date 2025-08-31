const express = require('express');
const { handleIoTasks } = require('../controllers/ioTasksController');

module.exports = (tracer) => {
  const router = express.Router();
  router.get('/io_tasks', (req, res) => handleIoTasks(req, res, tracer));
  return router;
};
