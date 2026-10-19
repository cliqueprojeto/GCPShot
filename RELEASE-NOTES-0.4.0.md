# GCPShot 0.4.0

- Color Lab com seletor de cor, entrada HEX, copia HEX/RGB/HSL e contraste WCAG AA/AAA.
- Harmonias analogas, complementares, triade e monocromatica.
- Live Color com conta-gotas nativo, lupa, copia automatica do HEX e historico.
- Atalho global padrao Ctrl+Shift+C, configuravel nas preferencias.
- Minhas Paletas: criar, editar cores, renomear, buscar, copiar e excluir.
- Importacao de paletas JSON do GCPstudioDesigner e exportacao JSON/CSS.
- Migracao inicial das paletas e do historico do Designer instalado, preservando os arquivos originais.
- Acesso ao Color Lab, Minhas Paletas e Live Color pelo menu da bandeja.
- Fluxo de captura preservado, sem reabrir a janela principal ao concluir ou cancelar.

## Verificacao

Testes de conversao, contraste, harmonias, validacao e migracao de dados.
Testes no Electron/Windows de copia para a area de transferencia, criacao,
renomeacao, persistencia, exclusao, importacao/exportacao, atalho registrado,
cancelamento da lupa e selecao real da amostra #12A4B6.
Regressao: cancelar a captura nao reabre a janela principal.

O projeto ja possui erros de tipagem anteriores nas telas de captura/gravacao;
o comando typecheck atual da raiz nao percorre esses subprojetos.
Os fluxos desta entrega foram verificados com testes funcionais.
