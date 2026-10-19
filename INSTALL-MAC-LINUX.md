# GCPShot 0.4.2

## macOS 14 ou posterior

Use o DMG arm64 para Macs Apple Silicon (M1 ou posterior), ou x64 para Macs Intel.
Abra o DMG e arraste GCPShot para Aplicativos. Os pacotes possuem assinatura
ad-hoc, mas nao possuem certificado Developer ID nem notarizacao Apple.
Se o macOS bloquear a primeira abertura, use Ajustes do Sistema > Privacidade
e Seguranca > Abrir Mesmo Assim para autorizar este aplicativo.

Na primeira captura ou no Live Color, autorize a gravacao de tela para GCPShot.
Se solicitado, feche e abra novamente o aplicativo apos conceder a permissao.
Camera e microfone sao opcionais e so sao utilizados quando habilitados.

## Debian 12+, Ubuntu 22.04+ e Linux Mint 21+ (PC 64 bits)

Abra o arquivo .deb pelo instalador de aplicativos da distribuicao.
Tambem pode instalar na pasta do arquivo com:

```sh
sudo apt install ./GCPShot-0.4.2-Linux-amd64.deb
```

O pacote instala as dependencias e cria a entrada GCPShot no menu de aplicativos.
O Live Color usa o painel flutuante em X11. Em Wayland, utiliza o seletor
do sistema via portal; a aparencia e o suporte a atalhos globais dependem
do ambiente grafico. A captura em Wayland tambem depende do portal da distribuicao.

As paletas e preferencias ficam armazenadas localmente na conta do usuario.
