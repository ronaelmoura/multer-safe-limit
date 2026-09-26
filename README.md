# Multer Safe Limit

Wrapper compatível com a API do Multer para tratar corretamente uploads no limite exato de `fileSize`.

O projeto nasceu de um problema pequeno, mas concreto: o comportamento de limite de tamanho de arquivo pode rejeitar um arquivo exatamente no valor configurado. A solução adiciona uma camada mínima de controle sem exigir mudanças na API da aplicação.

## O que este projeto demonstra

- Investigação de comportamento de biblioteca
- Reprodução de uma condição de fronteira
- Solução mínima e reutilizável
- Preservação da interface e do formato de erro
- Testes abaixo, no limite e acima do limite
- Compatibilidade com diferentes modos de upload

## O problema

O fluxo de upload pode sinalizar `LIMIT_FILE_SIZE` quando o stream alcança o limite configurado antes de ser possível distinguir entre um arquivo exatamente no limite e um arquivo maior.

Para uma aplicação, a regra desejada é simples:

```text
arquivo < limite  → aceita
arquivo = limite  → aceita
arquivo > limite  → rejeita
```

## A solução

`safeLimit()` fornece ao Multer um byte adicional de margem interna e depois verifica o tamanho real do arquivo contra o limite original.

Assim:

- arquivos abaixo do limite são aceitos;
- arquivos exatamente no limite são aceitos;
- arquivos acima do limite continuam falhando com `MulterError('LIMIT_FILE_SIZE')`.

## Uso

A API permanece equivalente ao Multer:

```js
// antes
import multer from 'multer'
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } })

// depois
import { safeLimit } from 'multer-safe-limit'
const upload = safeLimit({ limits: { fileSize: 10 * 1024 * 1024 } })
```

Os modos `single`, `array`, `fields`, `none` e `any` são suportados.

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

Sem `limits.fileSize`, o wrapper retorna o comportamento normal do Multer.

## Instalação

Ainda não publicado no npm. Instale diretamente do GitHub:

```bash
npm install github:ronaelmoura/multer-safe-limit
```

`multer` e `express` são peer dependencies.

## Caso de engenharia

**Investigar → reproduzir → corrigir → preservar compatibilidade.**

O ponto central do projeto não é o tamanho do código, mas o processo:

1. identificar um comportamento de fronteira;
2. reproduzir o caso com testes;
3. aplicar a menor mudança possível;
4. manter a API e o erro esperado pela aplicação;
5. validar os modos de upload relevantes.

O wrapper evita a necessidade de manter um fork do Multer, mas continua dependente do comportamento da biblioteca e do storage configurado.

## Testes

A suíte cobre cenários abaixo, exatamente no limite e acima do limite, além dos diferentes modos de upload.

```bash
npm ci
npm test
```

## Limitações

Este projeto resolve uma regra de tamanho de arquivo; não substitui validação de conteúdo, proteção contra malware ou limites agregados de upload.

Compatibilidade com todas as versões do Multer e todos os storage engines requer validação específica.

## Licença

MIT

---

**Ronael Moura** · small engineering case · Node.js + TypeScript
