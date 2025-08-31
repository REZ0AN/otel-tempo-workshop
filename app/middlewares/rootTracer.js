const { SpanKind, SpanStatusCode } = require('@opentelemetry/api');

function rootTracer(tracer) {
    return (req, res, next) => {
  const span = tracer.startSpan(`HTTP ${req.method} ${req.path}`, {
    kind: SpanKind.SERVER,
    attributes: {
      'http.method': req.method,
      'http.url': req.url,
      'http.user_agent': req.get('User-Agent') || 'unknown',
    }
  });

  req.span = span;
  
  res.on('finish', () => {
    span.setAttributes({
      'http.status_code': res.statusCode,
    });
    
    if (res.statusCode >= 400) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: `HTTP ${res.statusCode}`
      });
    }
    
    span.end();
  });
  
  next();
}
}

module.exports = rootTracer;