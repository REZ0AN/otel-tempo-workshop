const { SpanStatusCode } = require('@opentelemetry/api');


async function traceSpan(tracer, name, parent, fn, attributes = {}) {
  const span = tracer.startSpan(name, { parent });
  try {
    span.setAttributes(attributes);
    const result = await fn(span);
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.recordException(error);
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
    throw error;
  } finally {
    span.end();
  }
}

module.exports = { traceSpan };
