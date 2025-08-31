const express = require('express');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const {trace} = require('@opentelemetry/api');
const rootTracer = require('./middlewares/rootTracer');
const ioTasksRoute = require('./routes/ioTasks');

dotenv.config();

const SERVICE_NAME = process.env.SERVICE_NAME;
const SERVICE_VERSION = process.env.SERVICE_VERSION;


const tracer = trace.getTracer(SERVICE_NAME,SERVICE_VERSION);


const app = express();


// Middlewares
app.use(rootTracer(tracer));

app.use(bodyParser.json());

app.use('/api/v1', ioTasksRoute(tracer));

// Route for health checks
app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});


const PORT = process.env.PORT || '5010';

app.listen(PORT, ()=>{
    console.log(`Server running http://localhost:${PORT}`);
});