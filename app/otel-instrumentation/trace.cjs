const {NodeSDK} = require('@opentelemetry/sdk-node');
const {OTLPTraceExporter} = require('@opentelemetry/exporter-trace-otlp-http')
const {resourceFromAttributes} = require('@opentelemetry/resources')
const {ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION} = require('@opentelemetry/semantic-conventions')
const dotenv = require('dotenv')

dotenv.config();

const SERVICE_NAME = process.env.SERVICE_NAME || 'tracer-app';
const SERVICE_VERSION = process.env.SERVICE_VERSION || '1.0';
const TRACER_ENDPOINT = process.env.TRACER_ENDPOINT;


const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: SERVICE_NAME,
    [ATTR_SERVICE_VERSION]: SERVICE_VERSION,
})

const traceExporter = new OTLPTraceExporter({
    url: TRACER_ENDPOINT,
})

const sdk = new NodeSDK({
    resource,
    traceExporter:traceExporter,
    instrumentations:[],

})

sdk.start();
console.log('OpenTelemetry manual tracing initialized');

// Handle shutdown gracefully
process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log('Tracing terminated'))
    .catch((error) => console.log('Error terminating tracing', error))
    .finally(() => process.exit(0));
});