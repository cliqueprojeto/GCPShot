# GCPShot 0.6.0

- Configuracoes com a mesma identidade visual do workspace, navegacao lateral com icones, controles consistentes e layout responsivo.
- Atalho Configuracoes com icone no menu da bandeja, disponivel com clique esquerdo e direito.
- Captura de regiao usa os limites completos da tela, incluindo barra de tarefas e Dock.
- Monitores identificados por ID, nome, resolucao e escala, inclusive em coordenadas negativas. Fontes nao identificadas nao sao duplicadas em outros monitores.
- Exportacao de selecoes em um unico monitor preserva sua resolucao nativa; selecoes entre monitores usam a maior densidade disponivel.
- Editor com recorte interativo, proporcoes, rotacao livre, espelhamento horizontal/vertical, zoom, ajuste a tela e tamanho real.
- Brilho, exposicao, contraste, destaques, sombras, saturacao, temperatura, matiz e vinheta.
- Filtros com miniaturas, aprimoramento, caneta, marca-texto, borracha, clonagem e suavizacao local.
- Fundo: selecao de regiao continua por cor, tolerancia, remover, desfocar ou substituir por uma cor.
- Historico com desfazer/refazer, restauracao do original e copia editada na biblioteca. PNG exportado mantem transparencia e dimensoes.

## Limites claros

Retoque e selecao de fundo sao locais, sem envio de imagens e sem IA generativa.
A selecao de fundo por cor funciona melhor com fundos uniformes; nao equivale a segmentacao semantica do aplicativo Fotos.
No Wayland, a disponibilidade de fontes e identificadores de monitores depende do portal de captura do sistema. Para selecao multimonitor completa, use X11.
macOS 14 ou superior; pacotes Apple Silicon e Intel separados, assinatura ad-hoc, sem notarizacao Apple.
Linux amd64: Debian 12+, Ubuntu 22.04+ e Mint 21+.

## Verificacao

Testes de captura: barra inferior, fontes em ordem invertida, escala nativa, clipboard, fechamento da selecao, arquivo local e notificacao clicavel.
Testes de editor: transparencia do fundo, desfazer/refazer, giro/espelhamento, recorte, exposicao, pincel e copia na biblioteca.
Os testes graficos sao executados contra o aplicativo empacotado em Windows, macOS arm64, macOS x64 e Linux.
