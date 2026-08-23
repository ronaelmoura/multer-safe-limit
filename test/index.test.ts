import assert from "node:assert/strict"
import test from "node:test"
import express from "express"
import { safeLimit } from "../src/index"

const FILE_SIZE_LIMIT = 1024

async function startServer() {
  const app = express()
  const upload = safeLimit({ limits: { fileSize: FILE_SIZE_LIMIT } })

  app.post("/upload", upload.single("arquivo"), (request, response) => {
    response.status(200).json({ size: request.file?.size })
  })

  app.use(
    (
      error: any,
      _request: express.Request,
      response: express.Response,
      _next: express.NextFunction,
    ) => {
      if (error?.code === "LIMIT_FILE_SIZE") {
        return response.status(413).json({ code: error.code })
      }
      response.status(500).json({ error: String(error) })
    },
  )

  return new Promise<{ server: import("http").Server; baseUrl: string }>(
    (resolve) => {
      const server = app.listen(0, "127.0.0.1", () => {
        const address = server.address()
        const port = typeof address === "object" && address ? address.port : 0
        resolve({ server, baseUrl: `http://127.0.0.1:${port}` })
      })
    },
  )
}

function fileOfSize(bytes: number) {
  const form = new FormData()
  form.append(
    "arquivo",
    new Blob([new Uint8Array(bytes)], { type: "application/octet-stream" }),
    "arquivo.bin",
  )
  return form
}

test("accepts a file whose size equals the configured limit", async () => {
  const { server, baseUrl } = await startServer()

  try {
    const response = await fetch(`${baseUrl}/upload`, {
      method: "POST",
      body: fileOfSize(FILE_SIZE_LIMIT),
    })
    const body = await response.json()

    assert.equal(response.status, 200)
    assert.equal(body.size, FILE_SIZE_LIMIT)
  } finally {
    server.close()
  }
})

test("rejects a file larger than the configured limit", async () => {
  const { server, baseUrl } = await startServer()

  try {
    const response = await fetch(`${baseUrl}/upload`, {
      method: "POST",
      body: fileOfSize(FILE_SIZE_LIMIT + 1),
    })
    const body = await response.json()

    assert.equal(response.status, 413)
    assert.equal(body.code, "LIMIT_FILE_SIZE")
  } finally {
    server.close()
  }
})

test("accepts a file well under the configured limit", async () => {
  const { server, baseUrl } = await startServer()

  try {
    const response = await fetch(`${baseUrl}/upload`, {
      method: "POST",
      body: fileOfSize(10),
    })
    const body = await response.json()

    assert.equal(response.status, 200)
    assert.equal(body.size, 10)
  } finally {
    server.close()
  }
})

test("array(): rejects a file larger than the limit but accepts one at the limit", async () => {
  const app = express()
  const upload = safeLimit({ limits: { fileSize: FILE_SIZE_LIMIT } })

  app.post("/upload", upload.array("arquivos"), (request, response) => {
    const files = Array.isArray(request.files) ? request.files : []
    response.status(200).json({ sizes: files.map((file) => file.size) })
  })

  app.use(
    (
      error: any,
      _request: express.Request,
      response: express.Response,
      _next: express.NextFunction,
    ) => {
      if (error?.code === "LIMIT_FILE_SIZE") {
        return response.status(413).json({ code: error.code })
      }
      response.status(500).json({ error: String(error) })
    },
  )

  const server = await new Promise<import("http").Server>((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s))
  })
  const address = server.address()
  const port = typeof address === "object" && address ? address.port : 0
  const baseUrl = `http://127.0.0.1:${port}`

  try {
    const okForm = new FormData()
    okForm.append("arquivos", new Blob([new Uint8Array(FILE_SIZE_LIMIT)]), "a.bin")
    okForm.append("arquivos", new Blob([new Uint8Array(10)]), "b.bin")
    const okResponse = await fetch(`${baseUrl}/upload`, { method: "POST", body: okForm })
    assert.equal(okResponse.status, 200)
    assert.deepEqual((await okResponse.json()).sizes, [FILE_SIZE_LIMIT, 10])

    const tooBigForm = new FormData()
    tooBigForm.append("arquivos", new Blob([new Uint8Array(10)]), "a.bin")
    tooBigForm.append("arquivos", new Blob([new Uint8Array(FILE_SIZE_LIMIT + 1)]), "b.bin")
    const rejectedResponse = await fetch(`${baseUrl}/upload`, { method: "POST", body: tooBigForm })
    assert.equal(rejectedResponse.status, 413)
    assert.equal((await rejectedResponse.json()).code, "LIMIT_FILE_SIZE")
  } finally {
    server.close()
  }
})

test("fields(): rejects when a file in any named field exceeds the limit", async () => {
  const app = express()
  const upload = safeLimit({ limits: { fileSize: FILE_SIZE_LIMIT } })

  app.post(
    "/upload",
    upload.fields([
      { name: "avatar", maxCount: 1 },
      { name: "anexos", maxCount: 2 },
    ]),
    (_request, response) => response.status(200).json({ ok: true }),
  )

  app.use(
    (
      error: any,
      _request: express.Request,
      response: express.Response,
      _next: express.NextFunction,
    ) => {
      if (error?.code === "LIMIT_FILE_SIZE") {
        return response.status(413).json({ code: error.code })
      }
      response.status(500).json({ error: String(error) })
    },
  )

  const server = await new Promise<import("http").Server>((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s))
  })
  const address = server.address()
  const port = typeof address === "object" && address ? address.port : 0
  const baseUrl = `http://127.0.0.1:${port}`

  try {
    const form = new FormData()
    form.append("avatar", new Blob([new Uint8Array(10)]), "avatar.png")
    form.append("anexos", new Blob([new Uint8Array(FILE_SIZE_LIMIT + 1)]), "anexo.pdf")
    const response = await fetch(`${baseUrl}/upload`, { method: "POST", body: form })

    assert.equal(response.status, 413)
    assert.equal((await response.json()).code, "LIMIT_FILE_SIZE")
  } finally {
    server.close()
  }
})

test("any(): accepts a file exactly at the limit regardless of field name", async () => {
  const app = express()
  const upload = safeLimit({ limits: { fileSize: FILE_SIZE_LIMIT } })

  app.post("/upload", upload.any(), (request, response) => {
    const files = Array.isArray(request.files) ? request.files : []
    response.status(200).json({ sizes: files.map((file) => file.size) })
  })

  const server = await new Promise<import("http").Server>((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s))
  })
  const address = server.address()
  const port = typeof address === "object" && address ? address.port : 0
  const baseUrl = `http://127.0.0.1:${port}`

  try {
    const form = new FormData()
    form.append("qualquer-campo", new Blob([new Uint8Array(FILE_SIZE_LIMIT)]), "arquivo.bin")
    const response = await fetch(`${baseUrl}/upload`, { method: "POST", body: form })

    assert.equal(response.status, 200)
    assert.deepEqual((await response.json()).sizes, [FILE_SIZE_LIMIT])
  } finally {
    server.close()
  }
})

test("passes requests through untouched when no fileSize limit is set", async () => {
  const app = express()
  const upload = safeLimit()

  app.post("/upload", upload.single("arquivo"), (request, response) => {
    response.status(200).json({ size: request.file?.size })
  })

  const server = await new Promise<import("http").Server>((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s))
  })
  const address = server.address()
  const port = typeof address === "object" && address ? address.port : 0

  try {
    const response = await fetch(`http://127.0.0.1:${port}/upload`, {
      method: "POST",
      body: fileOfSize(5_000_000),
    })
    const body = await response.json()

    assert.equal(response.status, 200)
    assert.equal(body.size, 5_000_000)
  } finally {
    server.close()
  }
})
