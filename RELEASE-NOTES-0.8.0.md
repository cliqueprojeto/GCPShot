# GCPShot 0.8.0

Desenvolvido por **Bruno Albertini** · Gestão Cultural Pro

## Atualizações dentro do aplicativo

- Nova seção **Configurações › Geral › Atualizações**: mostra a versão instalada, a origem (GitHub `cliqueprojeto/GCPShot`) e a data da última verificação.
- Verificação automática configurável: **sempre que abrir o programa**, **uma vez por dia** ou **somente manualmente**. O botão **Verificar agora** e o item **Verificar atualizações** da bandeja funcionam a qualquer momento.
- Opção para receber **versões de desenvolvimento** (pré-lançamento).
- Download com barra de progresso e instalação pelo próprio app: Windows (instalador silencioso, reabre ao final), Linux (`.deb`, `.rpm` ou pacote Arch/BigLinux, com pedido de senha do sistema) e macOS (abre o DMG para substituir a versão).
- Canal público, sem login nem chave do GitHub. Cada instalador é conferido pelo **SHA-256** publicado na release antes de ser executado.

## Teclas de atalho que funcionam em cada sistema

- As sugestões agora são montadas **por sistema operacional** e testadas no próprio computador antes de serem atribuídas. A lista mostra todas as combinações livres, das mais fáceis para as menos fáceis.
- Combinações que roubariam teclas de outros programas deixaram de ser sugeridas: `Ctrl+Shift+letra` (Salvar como, Inspecionar…), `Ctrl+Alt` no Windows (é o AltGr dos teclados ABNT2), `Cmd+Shift+3/4/5/6` no macOS e `Ctrl+Alt+F1…F12/T/L` no Linux.
- No Linux, o GCPShot **lê os atalhos já usados pelo KDE Plasma e pelo GNOME** e os retira das sugestões. Se o Print Screen já abre o Spectacle ou a captura do GNOME, o app avisa em vez de disputar a tecla.
- Na primeira execução e ao restaurar padrões, cada função recebe automaticamente o atalho livre mais fácil.
- O seletor **Atalho principal de captura** usa somente sugestões verificadas.

## Linux: captura sem a janela "Compartilhar tela"

- No Wayland, **Capturar região** e **Capturar tela inteira** não abrem mais o seletor de tela do sistema. O GCPShot captura direto o **monitor onde está o mouse**.
- KDE Plasma/BigLinux: captura silenciosa pelo KWin, a mesma via usada pelo Spectacle. O app registra a permissão sozinho na primeira execução.
- GNOME e outros ambientes: portal de captura sem diálogo de escolha de tela. Sway/Hyprland: `grim`, quando instalado.
- Se nenhum método silencioso estiver disponível, o comportamento anterior continua como reserva.

## Linux: Live Color com lupa em tempo real

- No Wayland, o Live Color mostra a cor **dinamicamente sob o mouse**, com lupa ampliada (grade de pixels), HEX e RGB atualizados a cada movimento.
- **Setas** movem 1 pixel (Shift+setas: 10 px) para amostragem precisa. **Clique** ou **Enter** copia e salva no histórico. **Esc** ou o botão direito cancelam.
- O painel da lupa muda de lado perto das bordas e nunca sai da tela.

## Documentação

- Novo README com todas as funcionalidades ilustradas, guia de instalação atualizado para Windows, macOS, Debian/Ubuntu, Fedora e Arch/BigLinux.

## Correções

- O arrasto da webcam durante a gravação podia falhar ao limitar a posição na tela.
- O painel de gravação desaparecia enquanto o vídeo era salvo, sem mostrar "Salvando…".
- Diálogos de salvar e abrir passam a funcionar mesmo sem janela principal aberta.
- A verificação de tipos do projeto cobre agora todo o código do app e da interface, sem erros pendentes.

## Plataformas

Windows 10/11 x64 · macOS 14+ (Apple Silicon e Intel) · Debian 12+/Ubuntu 22.04+/Mint 21+ (`.deb`) · Fedora/openSUSE (`.rpm`) · Arch/BigLinux/Manjaro (`.pkg.tar.zst`).

macOS: assinatura ad-hoc, sem notarização Apple. Na primeira abertura use *Ajustes do Sistema › Privacidade e Segurança › Abrir Mesmo Assim*.

Quem usa a 0.7.0 ou anterior instala esta versão manualmente uma única vez. A partir dela, as próximas chegam pelo próprio app.
