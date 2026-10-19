# GCPShot 0.6.2

- Icone do GCPShot aplicado explicitamente nas janelas, identidade/reabertura da barra de tarefas Windows e Dock macOS.
- Icone ICO externo ao app.asar no Windows, alem do icone embutido no executavel e nos atalhos.
- Linux: identificador da janela alinhado ao arquivo desktop, com icones de 16 a 512 px nos tamanhos padrao do tema hicolor.
- Todos os avisos passam pelo painel personalizado GCPShot, incluindo aplicativo ativo na bandeja, salvamento, impressao, exportacao e erros de atalhos. Nenhum uso de Notification generica do Electron.
- Enter copia e fecha a selecao. Durante edicao de texto, o primeiro Enter confirma a anotacao; o proximo copia. Campos e controles preservam seu comportamento de teclado.
- Salvar PNG/JPEG/PDF, imprimir com sucesso ou preparar o WhatsApp Web fecha automaticamente a selecao.
- Cancelar ou falhar ao salvar, imprimir ou abrir o WhatsApp preserva a selecao para tentar novamente.
- A preferencia antiga para manter a selecao nao interfere mais nessas acoes e foi retirada da interface.
- Capturas salvas, impressas e preparadas para WhatsApp tambem sao arquivadas no Estudio. O WhatsApp recebe a imagem pelo clipboard; o usuario ainda escolhe a conversa e cola/envia.
- Acoes sao serializadas para evitar comandos duplicados; a conclusao so fecha a janela que iniciou a operacao.

## Verificacao

Icone Windows verificado pelos pixels do recurso do executavel e do HICON real da janela, nao apenas pelo nome do arquivo.
macOS: nome e recurso de icone do bundle. Linux: desktop entry, StartupWMClass e icone instalado.
PNG/PDF gerados e inspecionados; Enter, anotacao de texto, cancelamento e falha exercitados.
Impressao validada com callback de spool simulado, sem consumir papel. WhatsApp simulado, sem envio de mensagens.
Regressoes de Color Lab, paletas, captura multimonitor, editor e identidade da pagina inicial mantidas nos testes.

## Plataformas

Windows x64; macOS 14+ Apple Silicon e Intel; Debian 12+/Ubuntu 22.04+/Mint 21+ amd64.
macOS: assinatura ad-hoc, sem notarizacao Apple. Linux multimonitor completo via X11; Wayland depende do portal do sistema.
