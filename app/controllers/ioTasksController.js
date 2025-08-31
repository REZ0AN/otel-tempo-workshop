const { traceSpan } = require('../utils/tracing');
const {
  generateRandomContent,
  buildFilePath,
  ensureDir,
  writeFile,
  readFile,
  deleteFile
} = require('../utils/fileUtils');

async function handleIoTasks(req, res, tracer) {
  const mainSpan = tracer.startSpan('io-tasks-handler', {
    parent: req.span ,
    attributes: { 'operation.type': 'file-operations' }
  });

  try {
    // 1. Generate
    const { content, stringified } = await traceSpan(
      tracer, 'generate-random-content', mainSpan,
      async (span) => {
        const {content, stringified} = generateRandomContent();
        span.setAttributes({
          'content.size_bytes': stringified.length,
          'content.id': content.id
        });
        return { content, stringified };
      }
    );

    // 2. File path + ensure dir
    const { filename, filepath } = buildFilePath(content.id);
    await traceSpan(tracer, 'ensure-directory', mainSpan,
      async (span) => {
        await ensureDir(require('path').dirname(filepath));
        span.setAttribute('directory.path', require('path').dirname(filepath));
      }
    );

    // 3. Write
    await traceSpan(tracer, 'write-file', mainSpan,
      async (span) => {
        const start = Date.now();
        await writeFile(filepath, stringified);
        span.setAttributes({
          'file.path': filepath,
          'file.operation': 'write',
          'file.size_bytes': stringified.length,
          'file.write.duration_ms': Date.now() - start,
          'file.write.success': true
        });
        span.addEvent('File written successfully');
      }
    );

    // 4. Read
    const readContent = await traceSpan(tracer, 'read-file', mainSpan,
      async (span) => {
        const start = Date.now();
        const parsed = await readFile(filepath);
        span.setAttributes({
          'file.path': filepath,
          'file.operation': 'read',
          'file.read.duration_ms': Date.now() - start,
          'file.read.size_bytes': JSON.stringify(parsed).length,
          'file.read.success': true
        });
        span.addEvent('File read and parsed successfully');
        return parsed;
      }
    );

    // 5. Verify
    await traceSpan(tracer, 'verify-content', mainSpan,
      async (span) => {
        const matches = readContent.id === content.id;
        span.setAttributes({
          'verification.content_matches': matches,
          'verification.original_id': content.id,
          'verification.read_id': readContent.id
        });
        if (!matches) throw new Error('Content verification failed');
      }
    );

    // 6. Delete
    await traceSpan(tracer, 'delete-file', mainSpan,
      async (span) => {
        const start = Date.now();
        await deleteFile(filepath);
        span.setAttributes({
          'file.path': filepath,
          'file.operation': 'delete',
          'file.delete.duration_ms': Date.now() - start,
          'file.delete.success': true
        });
        span.addEvent('File deleted successfully');
      }
    );

    mainSpan.setAttributes({
      'operation.success': true,
      'operation.file_processed': filename,
      'operation.content_id': content.id
    });
    mainSpan.addEvent('All file operations completed successfully');

    res.json({
      success: true,
      message: 'File I/O operations completed successfully',
      operations: {
        generated: true, written: true, read: true, verified: true, deleted: true
      },
      metadata: {
        filename, contentId: content.id, contentSize: stringified.length,
        timestamp: new Date().toISOString()
      },
      traceId: mainSpan.spanContext().traceId
    });

  } catch (error) {
    mainSpan.recordException(error);
    mainSpan.setStatus({ code: 2, message: error.message }); // SpanStatusCode.ERROR
    res.status(500).json({
      success: false,
      error: 'File I/O operation failed',
      message: error.message,
      traceId: mainSpan.spanContext().traceId
    });
  } finally {
    mainSpan.end();
  }
}

module.exports = { handleIoTasks };
