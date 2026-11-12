# Instalação do GCPShot no macOS e no Linux

Desenvolvido por Bruno Albertini · Gestão Cultural Pro

## macOS 14 ou posterior

Use o DMG **arm64** para Macs Apple Silicon (M1 ou posterior), ou **x64** para Macs Intel.
Abra o DMG e arraste o GCPShot para Aplicativos. Os pacotes têm assinatura ad-hoc, mas
não têm certificado Developer ID nem notarização Apple. Se o macOS bloquear a primeira
abertura, use *Ajustes do Sistema › Privacidade e Segurança › Abrir Mesmo Assim*.

Na primeira captura ou no Live Color, autorize a gravação de tela para o GCPShot.
Se solicitado, feche e abra o aplicativo novamente depois de conceder a permissão.
Câmera e microfone são opcionais e só são usados quando habilitados.

## Debian 12+, Ubuntu 22.04+ e Linux Mint 21+ (`.deb`)

Abra o arquivo `.deb` pelo instalador de aplicativos da distribuição, ou na pasta do arquivo:

```sh
sudo apt install ./GCPShot-*-Linux-amd64.deb
```

## Fedora e openSUSE (`.rpm`)

```sh
sudo dnf install ./GCPShot-*-Linux-x86_64.rpm
```

## Arch, BigLinux e Manjaro (`.pkg.tar.zst`)

```sh
sudo pacman -U ./gcpshot-*-x86_64.pkg.tar.zst
```

## Captura e Live Color no Wayland

- **KDE Plasma / BigLinux:** a captura é silenciosa pelo KWin e usa o monitor onde está o mouse,
  sem a janela "Compartilhar tela". O GCPShot registra essa permissão sozinho na primeira execução.
- **GNOME e outros:** o portal de captura é usado sem o seletor de tela. Alguns sistemas pedem
  uma confirmação única na primeira vez.
- **Sway / Hyprland:** instale o `grim` para captura silenciosa.
- O **Live Color** mostra uma lupa com a cor sob o mouse em tempo real. As setas ajustam 1 pixel,
  Enter ou clique copia e Esc cancela.
- Atalhos globais: o GCPShot lê os atalhos já usados pelo KDE/GNOME e só sugere combinações livres.
  No Wayland, o sistema pode pedir uma confirmação única para liberar os atalhos do GCPShot.

## Atualizações

Depois de instalado, o GCPShot avisa quando houver versão nova e instala pelo próprio app
(*Configurações › Geral › Atualizações*). No Linux, o sistema pede a senha de administrador
para instalar o pacote.

As paletas e preferências ficam armazenadas localmente na conta do usuário.
