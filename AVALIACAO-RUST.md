# Avaliacao de migracao do GCPShot para Rust

Data: 2026-10-19. Base avaliada: GCPShot 0.6.1.
Status: avaliacao tecnica; nenhuma migracao nem medicao de desempenho de uma versao Rust foi realizada.

## Conclusao

A migracao e viavel. Para preservar a interface atual, o caminho recomendado e Rust + Tauri 2, mantendo React/TypeScript/CSS.
Isso substitui o processo principal e a distribuicao do Electron, mas nao significa um aplicativo 100% escrito em Rust.
Uma interface tambem escrita em Rust exigiria outra implementacao grafica e uma nova validacao visual e funcional.
Nao ha conversao automatica que garanta identidade exata e paridade entre os sistemas.

## Potencial de reducao

Tauri usa o WebView do sistema em vez de incluir Chromium no pacote. E uma base favoravel para reduzir o instalador.
O ganho real de memoria, CPU e inicializacao precisa ser medido somando todos os processos e dependencias.
Nao foi prometida uma porcentagem de reducao. Este ambiente nao apresentou cargo/rustc no PATH durante a verificacao.

## Partes reaproveitaveis

- React/CSS do workspace, Color Lab, paletas, configuracoes e editor.
- Regras de cor e formatos JSON existentes.
- Recursos visuais e identidade dos instaladores.
- Contrato window.gcpshot: manter os metodos e trocar sua implementacao por comandos/eventos Tauri.

## Partes que precisam de portabilidade e testes

- src/main/index.ts: janelas, IPC, captura de tela, bandeja, atalhos, clipboard, notificacoes e arquivos.
- src/preload/index.ts: substituir a ponte Electron por um adaptador Tauri.
- Captura: substituir desktopCapturer; validar ID de monitor, DPI, coordenadas negativas, Dock/barra de tarefas e permissoes.
- Live Color: helpers atuais em C#, Swift e C podem ser mantidos inicialmente como processos auxiliares. Para uma base integralmente Rust, tambem precisam ser portados.
- Editor: validar Canvas, filtros, fontes, transparencia e exportacao nos WebViews diferentes de cada sistema.
- Video: ha uso de captureStream/MediaRecorder em Studio.tsx; nao assumir equivalencia no WebView do macOS e Linux.
- Bandeja: Tauri tem limitacoes documentadas para eventos de clique no Linux; reproduzir o comportamento exige testes por ambiente.
- Dados: preservar caminhos/JSON de capturas, paletas e configuracoes. O localStorage do Electron nao migra automaticamente para outro WebView; importar a biblioteca do editor exige um mecanismo de migracao.
- Distribuicao: gerar e testar Windows x64, macOS arm64, macOS x64 e Linux .deb novamente. Certificados/notarizacao continuam sendo requisitos separados.

## Etapas propostas

1. Registrar tamanho instalado, instalador, memoria total, CPU ociosa e latencia de captura da base atual.
2. Criar um prototipo Tauri com a mesma interface, bandeja, atalhos, uma captura e clipboard.
3. Comparar medidas e validar multimonitor/DPI, permissoes e comportamento dos WebViews nos quatro alvos.
4. Portar os demais comandos, Live Color, arquivos e migracao de dados, sem remover a versao estavel.
5. Validar editor, captura e gravacao antes de substituir os instaladores de producao.

## Fontes primarias

- Arquitetura/processos: https://v2.tauri.app/concept/process-model/
- Integracao de frontend React/Vite: https://v2.tauri.app/start/frontend/
- Bandeja e limitacoes de plataforma: https://v2.tauri.app/learn/system-tray/
- Atalhos globais: https://v2.tauri.app/plugin/global-shortcut/
- XCap, candidato para captura Rust multiplataforma (gravacao documentada como WIP): https://docs.rs/crate/xcap/latest/source/README.md
