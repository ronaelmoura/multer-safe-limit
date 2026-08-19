# multer-safe-limit

Drop-in [Multer](https://github.com/expressjs/multer) wrapper that stops rejecting uploads at exactly the configured `fileSize` limit.

## The bug

Multer (via [busboy](https://github.com/mscdex/busboy)) fires its size-limit event as soon as a stream reaches exactly `limits.fileSize` bytes — it can't know in advance whether more data is coming. That means a file whose size is **exactly** the configured limit gets rejected with `LIMIT_FILE_SIZE`, even though it never exceeded it.

```js
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } })
// a file of exactly 10 MiB → rejected
// a file of 10 MiB - 1 byte → accepted
```

This is tracked upstream as [expressjs/multer#1348](https://github.com/expressjs/multer/issues/1348). At the time of writing it's unresolved, with a few competing PRs open.

## The fix

`multer-safe-limit` wraps `multer()` with the same options you'd normally pass. Internally it asks multer for one extra byte of headroom, then re-checks the real uploaded size against the limit you configured. Anything over your limit still fails with the same `MulterError('LIMIT_FILE_SIZE')` your error handlers already expect; anything at or under it now succeeds.

## Install

```bash
npm install multer-safe-limit
```

`multer` and `express` are peer dependencies — install them if you don't already have them.

## Usage

Same API as `multer()` — `single`, `array`, `fields`, `none`, `any` all work the same way. Just swap the import:

```js
// before
import multer from 'multer'
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } })

// after
import { safeLimit } from 'multer-safe-limit'
const upload = safeLimit({ limits: { fileSize: 10 * 1024 * 1024 } })
```

```js
app.post('/upload', upload.single('file'), (request, response) => {
  response.json({ size: request.file.size })
})

app.use((error, request, response, next) => {
  if (error?.code === 'LIMIT_FILE_SIZE') {
    return response.status(413).json({ message: 'File too large.' })
  }
  next(error)
})
```

If you don't set `limits.fileSize`, `safeLimit()` behaves exactly like `multer()` — no behavior change, no overhead.

## Why not just use `fileSize + 1` myself?

You can! That's exactly what this package does under the hood. It exists because getting the re-check right for `single`/`array`/`fields`/`any` — and keeping the resulting error shaped like a real `MulterError` so existing error handlers don't need to change — is easy to get subtly wrong by hand.

## License

MIT
