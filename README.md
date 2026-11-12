<p align="center"><img src="build/icon-256.png" width="112" alt="GCPShot"></p>

<h1 align="center">GCPShot</h1>

<p align="center"><strong>Capture. Crie. Compartilhe.</strong><br>Captura de tela, estúdio de imagem e Color Lab para Windows, macOS e Linux.</p>

<p align="center">Desenvolvido por <strong>Bruno Albertini</strong> · <a href="https://gestaoculturalpro.com.br/">Gestão Cultural Pro</a></p>

---

## Recursos

- **Capturar região** e **capturar tela inteira**, com editor completo: setas, formas, texto, balões, carimbos, numeração, lupa, desfoque, pixelização e régua calibrada em centímetros.
- Copiar, salvar (PNG, JPEG, PDF), imprimir ou preparar para o WhatsApp Web em um clique.
- **Estúdio** com o histórico das capturas, colagens e editor de fotos.
- **Color Lab**: Live Color (conta-gotas com lupa em tempo real), paletas, harmonias, contraste WCAG e exportação JSON/CSS.
- Gravação de tela com áudio e webcam.
- Atalhos globais sugeridos conforme o sistema, sem conflito com teclas já usadas.
- **Atualizações automáticas** pelas releases deste repositório.

## Download

Baixe o instalador do seu sistema na página de [Releases](https://github.com/cliqueprojeto/GCPShot/releases/latest):

| Sistema | Arquivo |
| --- | --- |
| Windows 10/11 | `GCPShot-<versão>-Windows-x64.exe` |
| macOS 14+ Apple Silicon | `GCPShot-<versão>-macOS-arm64.dmg` |
| macOS 14+ Intel | `GCPShot-<versão>-macOS-x64.dmg` |
| Debian, Ubuntu, Mint | `GCPShot-<versão>-Linux-amd64.deb` |
| Fedora, openSUSE | `GCPShot-<versão>-Linux-x86_64.rpm` |
| Arch, BigLinux, Manjaro | `gcpshot-<versão>-1-x86_64.pkg.tar.zst` |

Instruções detalhadas para macOS e Linux em [INSTALL-MAC-LINUX.md](INSTALL-MAC-LINUX.md).

## Atualizações

Em **Configurações › Geral › Atualizações** você escolhe se o GCPShot verifica novas versões ao abrir, uma vez por dia ou só manualmente, e se deseja receber versões de desenvolvimento. O canal é público: não precisa de conta nem chave do GitHub.

## Desenvolvimento

```bash
npm ci
npm run dev        # modo desenvolvimento
npm test           # testes unitários
npm run typecheck  # verificação de tipos
npm run build      # build de produção
```

Os instaladores são gerados pelo GitHub Actions. Uma tag `v*` publica a release com todos os pacotes e o manifesto de atualização.

---

© Bruno Albertini · Gestão Cultural Pro. Todos os direitos reservados.
