# GCPShot 0.8.1

Desenvolvido por **Bruno Albertini** · Gestão Cultural Pro

Versão de correções para Linux, com foco em vários monitores e teclas de atalho no KDE Plasma/BigLinux (Wayland).

## Capturas com vários monitores

- **Monitor certo, tamanho certo.** No Wayland o GCPShot pergunta ao KWin qual é o monitor ativo (onde está o mouse) e captura exatamente esse monitor. Antes, com dois monitores de mesma resolução física (ex.: notebook 1920×1080 a 125% e monitor externo 1920×1080 a 100%), o app podia escolher o monitor errado e aplicar o tamanho de um no outro.
- **Região exata.** A janela de seleção agora ocupa exatamente o monitor (no Plasma ela ficava maior que a tela, deslocando a seleção). Uma região de 400×200 em uma tela a 125% sai com 500×250 pixels nativos.
- **Tela inteira com a barra de tarefas.** A captura de tela inteira inclui a barra de tarefas/dock e os desenhos feitos no editor, na resolução nativa do monitor.
- **Live Color** também abre no tamanho exato do monitor ativo.

## Captura pelo ícone da bandeja

- Ao escolher **Capturar região**, **Capturar tela inteira** ou **Live Color** no menu da bandeja, o GCPShot espera o menu fechar antes de capturar. O menu não aparece mais no print.

## Teclas de atalho que funcionam no Linux

- Novos atalhos padrão no Linux: **Alt+1** capturar região, **Alt+2** tela inteira, **Alt+3** Estúdio, **Alt+4** Live Color. Se algum estiver ocupado, o próximo livre é sugerido (`Alt+5…Alt+8`, `Alt+Shift+letra`, `Ctrl+Alt+número`…).
- **KDE Plasma (Wayland):** os atalhos são registrados direto no serviço de atalhos do Plasma, e cada sugestão é testada ao vivo antes de ser oferecida. Antes, o registro pelo portal do Chromium ficava inativo e nenhum atalho disparava. Os atalhos aparecem em *Configurações do Sistema › Atalhos › GCPShot*.
- `Shift+número` não é mais sugerido nem aceito no Linux: o sistema converte em símbolo ou tecla do teclado numérico (`Alt+Shift+2` virava `Meta+Shift+Num+Left`) e o atalho nunca disparava.
- Entradas antigas e quebradas que versões anteriores deixaram no KDE são removidas automaticamente, e os atalhos do próprio GCPShot deixaram de ser tratados como "ocupados pelo sistema".
- Quem atualiza recebe os novos atalhos uma única vez, de forma automática. Depois disso, as escolhas feitas em **Configurações › Atalhos** são mantidas.

## Plataformas

Windows 10/11 x64 · macOS 14+ (Apple Silicon e Intel) · Debian 12+/Ubuntu 22.04+/Mint 21+ (`.deb`) · Fedora/openSUSE (`.rpm`) · Arch/BigLinux/Manjaro (`.pkg.tar.zst`).

Quem já usa a 0.8.0 recebe esta versão pelo próprio app (**Configurações › Geral › Atualizações** ou **Verificar atualizações** na bandeja).
