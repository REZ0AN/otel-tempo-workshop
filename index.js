const express = require('express');
const dotenv = require('dotenv');
const fs = require('fs/promises');
const path = require('path');
const bodyParser = require('body-parser');
const {trace, SpanStatusCode, SpanKind} = require('@opentelemetry/api');

dotenv.config();

const app = express();
const SERVICE_NAME = process.env.SERVICE_NAME;
const SERVICE_VERSION = process.env.SERVICE_VERSION;

const tracer = trace.getTracer(SERVICE_NAME,SERVICE_VERSION);


app.use(bodyParser.json());

app.get('/io_tasks', async (req, res) => {
  const mainSpan = tracer.startSpan('io-tasks-handler', {
    attributes: {
      'operation.type': 'file-operations'
    }
  });

  try {
    // Generate random content
    const generateSpan = tracer.startSpan('generate-random-content', { parent: mainSpan });
    const randomContent = {
      id: Math.random().toString(36).substring(7),
      timestamp: new Date().toISOString(),
      data: Array.from({ length: 10 }, () => Math.random().toString(36).substring(7)),
      message: 'This is random test data for file operations'
    };
    const contentString = JSON.stringify(randomContent, null, 2);
    
    generateSpan.setAttributes({
      'content.size_bytes': contentString.length,
      'content.id': randomContent.id
    });
    generateSpan.end();

    // Create filename with timestamp
    const filename = `temp_${randomContent.id}_${Date.now()}.json`;
    const filepath = path.join(__dirname, 'temp', filename);
    
    // Ensure temp directory exists
    const dirSpan = tracer.startSpan('ensure-directory', { parent: mainSpan });
    try {
      await fs.mkdir(path.dirname(filepath), { recursive: true });
      dirSpan.setAttributes({ 'directory.path': path.dirname(filepath) });
    } catch (error) {
      dirSpan.recordException(error);
      throw error;
    } finally {
      dirSpan.end();
    }

    // Write file
    const writeSpan = tracer.startSpan('write-file', {
      parent: mainSpan,
      kind: SpanKind.CLIENT,
      attributes: {
        'file.path': filepath,
        'file.operation': 'write',
        'file.size_bytes': contentString.length
      }
    });

    try {
      const writeStartTime = Date.now();
      await fs.writeFile(filepath, contentString, 'utf8');
      const writeDuration = Date.now() - writeStartTime;
      
      writeSpan.setAttributes({
        'file.write.duration_ms': writeDuration,
        'file.write.success': true
      });
      writeSpan.addEvent('File written successfully');
    } catch (error) {
      writeSpan.recordException(error);
      writeSpan.setStatus({
        code: SpanStatusCode.ERROR,
        message: `Write failed: ${error.message}`
      });
      throw error;
    } finally {
      writeSpan.end();
    }

    // Read file back
    const readSpan = tracer.startSpan('read-file', {
      parent: mainSpan,
      kind: SpanKind.CLIENT,
      attributes: {
        'file.path': filepath,
        'file.operation': 'read'
      }
    });

    let readContent;
    try {
      const readStartTime = Date.now();
      const fileContent = await fs.readFile(filepath, 'utf8');
      readContent = JSON.parse(fileContent);
      const readDuration = Date.now() - readStartTime;
      
      readSpan.setAttributes({
        'file.read.duration_ms': readDuration,
        'file.read.size_bytes': fileContent.length,
        'file.read.success': true
      });
      readSpan.addEvent('File read and parsed successfully');
    } catch (error) {
      readSpan.recordException(error);
      readSpan.setStatus({
        code: SpanStatusCode.ERROR,
        message: `Read failed: ${error.message}`
      });
      throw error;
    } finally {
      readSpan.end();
    }

    // Verify content matches
    const verifySpan = tracer.startSpan('verify-content', { parent: mainSpan });
    const contentMatches = readContent.id === randomContent.id;
    verifySpan.setAttributes({
      'verification.content_matches': contentMatches,
      'verification.original_id': randomContent.id,
      'verification.read_id': readContent.id
    });
    
    if (!contentMatches) {
      const error = new Error('Content verification failed');
      verifySpan.recordException(error);
      verifySpan.setStatus({
        code: SpanStatusCode.ERROR,
        message: 'Content mismatch'
      });
      throw error;
    }
    verifySpan.end();

    // Delete file
    const deleteSpan = tracer.startSpan('delete-file', {
      parent: mainSpan,
      kind: SpanKind.CLIENT,
      attributes: {
        'file.path': filepath,
        'file.operation': 'delete'
      }
    });

    try {
      const deleteStartTime = Date.now();
      await fs.unlink(filepath);
      const deleteDuration = Date.now() - deleteStartTime;
      
      deleteSpan.setAttributes({
        'file.delete.duration_ms': deleteDuration,
        'file.delete.success': true
      });
      deleteSpan.addEvent('File deleted successfully');
    } catch (error) {
      deleteSpan.recordException(error);
      deleteSpan.setStatus({
        code: SpanStatusCode.ERROR,
        message: `Delete failed: ${error.message}`
      });
      throw error;
    } finally {
      deleteSpan.end();
    }

    // Success response
    mainSpan.setAttributes({
      'operation.success': true,
      'operation.file_processed': filename,
      'operation.content_id': randomContent.id
    });
    
    mainSpan.addEvent('All file operations completed successfully');

    res.json({
      success: true,
      message: 'File I/O operations completed successfully',
      operations: {
        generated: true,
        written: true,
        read: true,
        verified: true,
        deleted: true
      },
      metadata: {
        filename: filename,
        contentId: randomContent.id,
        contentSize: contentString.length,
        timestamp: new Date().toISOString()
      },
      traceId: mainSpan.spanContext().traceId
    });

  } catch (error) {
    mainSpan.recordException(error);
    mainSpan.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message
    });

    res.status(500).json({
      success: false,
      error: 'File I/O operation failed',
      message: error.message,
      traceId: mainSpan.spanContext().traceId
    });
  } finally {
    mainSpan.end();
  }
});

// Health check endpoint (optional)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  if (req.span) {
    req.span.recordException(error);
    req.span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message
    });
  }
  
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || '5010';
app.listen(PORT, ()=>{
    console.log(`Server running http://localhost:${PORT}`);
});