# Changelog

## 0.1.0

- Initial release: `safeLimit()`, a drop-in `multer()` wrapper that fixes
  [expressjs/multer#1348](https://github.com/expressjs/multer/issues/1348) —
  multer/busboy reject uploads whose size is exactly equal to the configured
  `fileSize` limit, instead of only rejecting files that exceed it.
- Test coverage extended to `.array()`, `.fields()`, and `.any()`, in addition
  to the originally covered `.single()`.
