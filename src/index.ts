import multer, { MulterError } from "multer"
import type { Multer, Options } from "multer"
import type { NextFunction, Request, RequestHandler, Response } from "express"

/**
 * multer/busboy fire the `limit` event as soon as the stream reaches
 * exactly `fileSize` bytes, because they cannot tell in advance whether
 * more data is coming. That makes multer reject files whose size is
 * exactly the configured limit, not just files that exceed it.
 * See https://github.com/expressjs/multer/issues/1348
 *
 * safeLimit() works around it by asking multer for one extra byte of
 * headroom internally, then re-checking the real uploaded size against
 * the limit you actually configured. Anything over your limit still
 * fails with the same `MulterError('LIMIT_FILE_SIZE')` your error
 * handlers already expect; anything at or under it succeeds.
 */
export function safeLimit(options: Options = {}): Multer {
  const fileSize = options.limits?.fileSize

  const inner = multer(
    fileSize == null
      ? options
      : {
          ...options,
          limits: { ...options.limits, fileSize: fileSize + 1 },
        },
  )

  if (fileSize == null) {
    return inner
  }

  const wrap = (handler: RequestHandler): RequestHandler => {
    return (request: Request, response: Response, next: NextFunction) => {
      handler(request, response, (error?: unknown) => {
        if (error) return next(error)

        const oversized = findOversizedFile(request, fileSize)
        if (oversized) {
          return next(new MulterError("LIMIT_FILE_SIZE", oversized.fieldname))
        }

        next()
      })
    }
  }

  return {
    single: (fieldName) => wrap(inner.single(fieldName)),
    array: (fieldName, maxCount) => wrap(inner.array(fieldName, maxCount)),
    fields: (fields) => wrap(inner.fields(fields)),
    none: () => wrap(inner.none()),
    any: () => wrap(inner.any()),
  }
}

function findOversizedFile(
  request: Request,
  fileSize: number,
): Express.Multer.File | undefined {
  if (request.file && request.file.size > fileSize) {
    return request.file
  }

  if (!request.files) return undefined

  const files = Array.isArray(request.files)
    ? request.files
    : Object.values(request.files).flat()

  return files.find((file) => file.size > fileSize)
}

export { MulterError }
export default safeLimit
