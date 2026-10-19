const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const source = ts.transpileModule(fs.readFileSync('src/shared/branding.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const context = { exports: {}, URL }
vm.runInNewContext(source, context)
const { isProjectSiteUrl } = context.exports
for (const url of ['https://gestaoculturalpro.com.br/', 'https://www.gestaoculturalpro.com.br/', 'https://gestaoculturalpro.com.br/projeto']) assert.equal(isProjectSiteUrl(url), true)
for (const url of ['https://www.gestaoculturalpro.com.br.evil.test/', 'https://gestaoculturalpro.com.br@evil.test/', 'https://name@gestaoculturalpro.com.br/', 'http://gestaoculturalpro.com.br/', 'javascript:alert(1)', 'not-a-url']) assert.equal(isProjectSiteUrl(url), false)
console.log('Project website allowlist accepts both official hosts and rejects lookalikes.')
