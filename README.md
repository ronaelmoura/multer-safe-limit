# Multer Safe Limit

Wrapper para [Multer](https://github.com/expressjs/multer) criado para tratar de forma previsível o limite exato de tamanho de arquivos em uploads.

O projeto nasceu de um problema específico: arquivos exatamente no limite configurado podiam ser tratados de forma diferente do esperado no comportamento padrão do upload. A solução adiciona uma camada pequena de controle, sem exigir mudanças na API usada pela aplicação.

## O que este projeto demonstra

- Investigação de comportamento de biblioteca
- Manipulação de uploads e limites de arquivo
- Compatibilidade com os modos de uso do Multer
- Testes automatizados
- Desenvolvimento de uma solução pequena e reutilizável

## Por que criei isso?

Nem todo problema de engenharia exige uma aplicação enorme. Uma inconsistência de limite em uma biblioteca pode gerar bugs difíceis de identificar; este projeto mostra como isolar, reproduzir, testar e transformar esse caso em uma solução reutilizável.

## O problema

Multer (via [busboy](https://github.com/mscdex/busboy)) dispara o evento de limite assim que o stream alcança exatamente `limits.fileSize` bytes — antes de saber se haverá mais dados. Como consequência, um arquivo com o tamanho exato configurado pode receber `LIMIT_FILE_SIZE`.

## A solução

`multer-safe-limit` chama o Multer com um byte extra de margem interna e verifica novamente o tamanho real contra o limite configurado. Arquivos acima do limite continuam falhando com `MulterError('LIMIT_FILE_SIZE')`; arquivos no limite ou abaixo passam a ser aceitos.

## Install

Not on npm yet. Install straight from the repository — the `prepare` script
builds it on install, so you get `dist/` without extra steps:

```bash
npm install github:ronaelmoura/multer-safe-limit
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

## Engineering case: exact-limit uploads

**Problem.** A file with exactly the configured maximum size should be accepted, while a larger file should still fail. The README's reproduction describes the boundary behavior this wrapper addresses.

**Implementation.** [safeLimit](src/index.ts) gives Multer one additional byte of internal headroom, then checks the actual file sizes against the original limit. It preserves the `LIMIT_FILE_SIZE` error shape. The adapter handles the single-file object, arrays, and named-field collections; without a configured size limit, it returns the underlying Multer instance.

**Trade-off.** Applying `fileSize + 1` alone would change the acceptance boundary. The second check is necessary. Keeping a small wrapper avoids maintaining a fork, but makes behavior dependent on Multer and the configured storage engine. These are design comparisons, not claims of an upstream contribution or adoption.

**Evidence.** The [test directory](test) includes HTTP upload scenarios for files below, at, and above the limit and multiple upload methods. Run `npm ci` followed by `npm test` to reproduce the repository's suite. No new test execution or benchmark is claimed by this documentation change.

**Limitations.** A size limit is not content validation or malware detection. Storage-engine cleanup, aggregate upload limits, and compatibility across every supported Multer version require separate verification; the included examples do not establish universal compatibility.
