export type ResolvedLanguage = 'pt-BR' | 'en' | 'es'
export type AppLanguage = 'auto' | ResolvedLanguage

export type TranslationKey =
  | 'appName'
  | 'appEyebrow'
  | 'settings'
  | 'captureRegion'
  | 'captureFullscreen'
  | 'readyToCapture'
  | 'heroTag'
  | 'heroTitle'
  | 'heroSubtitle'
  | 'featureTray'
  | 'featureTrayDesc'
  | 'featureAnnotate'
  | 'featureAnnotateDesc'
  | 'featureExport'
  | 'featureExportDesc'
  | 'featureStudio'
  | 'featureStudioDesc'
  | 'openStudio'
  | 'studioBack'
  | 'studioEyebrow'
  | 'studioTitle'
  | 'studioImport'
  | 'studioExport'
  | 'studioModeEdit'
  | 'studioModeCollage'
  | 'studioLibrary'
  | 'studioLibraryEmpty'
  | 'studioCanvasEmptyTitle'
  | 'studioCanvasEmptyHint'
  | 'studioCollageEmptyTitle'
  | 'studioCollageEmptyHint'
  | 'studioAdjustments'
  | 'studioBrightness'
  | 'studioContrast'
  | 'studioSaturation'
  | 'studioReset'
  | 'studioSaveVariant'
  | 'studioCollageLayout'
  | 'studioLayout2col'
  | 'studioLayout2row'
  | 'studioLayout3col'
  | 'studioLayoutGrid2x2'
  | 'studioLayoutHeroLeft'
  | 'studioLayoutHeroTop'
  | 'studioCollageGap'
  | 'studioCollagePadding'
  | 'studioCollageBackground'
  | 'studioSlot'
  | 'studioSlotEmpty'
  | 'studioAutoFill'
  | 'studioImported'
  | 'studioExported'
  | 'studioSavedToLibrary'
  | 'studioFootnote'
  | 'studioAddedFromCapture'
  | 'studioRendering'
  | 'studioRenderFailed'
  | 'credit'
  | 'developedBy'
  | 'contributeBadge'
  | 'contributeTitle'
  | 'contributeLead'
  | 'contributeNote'
  | 'contributePixTitle'
  | 'contributePixKey'
  | 'contributePixScan'
  | 'contributeStripeTitle'
  | 'contributeStripeButton'
  | 'contributeStripeHint'
  | 'contributeStripeLink'
  | 'contributeFooter'
  | 'contributeCopy'
  | 'contributeCopied'
  | 'preferences'
  | 'settingsTitle'
  | 'tabGeneral'
  | 'tabShortcuts'
  | 'tabFormats'
  | 'startWithWindows'
  | 'minimizeToTray'
  | 'showNotifications'
  | 'keepSelection'
  | 'captureCursor'
  | 'mainShortcut'
  | 'recordShortcut'
  | 'recording'
  | 'record'
  | 'listening'
  | 'printScreenCapture'
  | 'defaultFormat'
  | 'language'
  | 'languageAuto'
  | 'resetSettings'
  | 'settingsUpdated'
  | 'settingsReset'
  | 'custom'
  | 'dragSelect'
  | 'areaSelected'
  | 'adjustSelection'
  | 'selectionResizeDone'
  | 'fullscreenSelected'
  | 'selectionTooSmall'
  | 'confirmArea'
  | 'drawing'
  | 'annotationAdded'
  | 'undoDone'
  | 'redoDone'
  | 'moveElement'
  | 'elementMoved'
  | 'copying'
  | 'copied'
  | 'copyFailed'
  | 'saving'
  | 'saved'
  | 'saveFailed'
  | 'printing'
  | 'printDone'
  | 'printFailed'
  | 'whatsappOpening'
  | 'whatsappReady'
  | 'whatsappFailed'
  | 'helpHint'
  | 'toolSelect'
  | 'toolMove'
  | 'toolPen'
  | 'toolArrow'
  | 'toolMagnifier'
  | 'toolBlur'
  | 'toolPixelate'
  | 'toolText'
  | 'toolBubble'
  | 'toolStamp'
  | 'toolShapes'
  | 'toolRect'
  | 'toolEllipse'
  | 'toolLine'
  | 'toolStar'
  | 'toolColors'
  | 'toolThickness'
  | 'toolIntensity'
  | 'copyAction'
  | 'saveAction'
  | 'printAction'
  | 'whatsappAction'
  | 'undoAction'
  | 'redoAction'
  | 'clearAllAction'
  | 'clearAllDone'
  | 'cancelAction'
  | 'moveToolbar'
  | 'bubbleSpeech'
  | 'bubbleCaption'
  | 'bubbleThought'
  | 'bgFilled'
  | 'bgTransparent'
  | 'bgOutline'
  | 'magnifierRect'
  | 'magnifierEllipse'
  | 'magnifierWidth'
  | 'magnifierHeight'
  | 'magnifierRounded'
  | 'magnifierCorners'
  | 'toolOutline'
  | 'stampPlaceholder'
  | 'enterBubbleText'
  | 'enterText'
  | 'shortcutCapture'
  | 'shortcutCopy'
  | 'shortcutSave'
  | 'shortcutPrint'
  | 'shortcutWhatsapp'
  | 'shortcutUndo'
  | 'shortcutRedo'
  | 'shortcutSelect'
  | 'shortcutMove'
  | 'shortcutPen'
  | 'shortcutArrow'
  | 'shortcutMagnifier'
  | 'shortcutBlur'
  | 'shortcutPixelate'
  | 'shortcutText'
  | 'shortcutBubble'
  | 'shortcutStamp'
  | 'shortcutRect'
  | 'shortcutEllipse'
  | 'shortcutLine'
  | 'shortcutStar'
  | 'shortcutCancel'
  | 'settingsArrowHint'
  | 'shortcutFullscreen'
  | 'shortcutStudio'
  | 'shortcutLiveColor'
  | 'shortcutRecordRegion'
  | 'shortcutRecordFullscreen'
  | 'shortcutRecordPause'
  | 'shortcutNumStamp'
  | 'toolNumStamp'
  | 'tabVideo'
  | 'tabAudio'
  | 'videoQuality'
  | 'videoQualityBalanced'
  | 'videoQualitySharp'
  | 'videoQualityFluid'
  | 'videoFps'
  | 'videoResolution'
  | 'videoResolutionAuto'
  | 'videoFormatHint'
  | 'videoOpfsHint'
  | 'webcamEnabled'
  | 'webcamShape'
  | 'webcamShapeCircle'
  | 'webcamShapeRounded'
  | 'webcamShapeSquare'
  | 'webcamSize'
  | 'webcamFrameColor'
  | 'recordAudio'
  | 'audioSource'
  | 'audioSourceNone'
  | 'audioSourceMic'
  | 'audioSourceSystem'
  | 'audioSourceBoth'
  | 'microphoneGain'
  | 'recordRegion'
  | 'recordFullscreen'
  | 'recordSelectArea'
  | 'recordReady'
  | 'recordActive'
  | 'recordActiveWithCodec'
  | 'recordPaused'
  | 'recordResume'
  | 'recordPause'
  | 'recordStop'
  | 'recordStart'
  | 'recordClear'
  | 'recordCleared'
  | 'recordTitle'
  | 'recordSaved'
  | 'recordFailed'
  | 'recordSaving'
  | 'recordingCodecH264'
  | 'recordingCodecVp8'
  | 'recordingCodecVp9'
  | 'recordingCodecDefault'

const translations: Record<ResolvedLanguage, Record<TranslationKey, string>> = {
  'pt-BR': {
    appName: 'GCPShot',
    appEyebrow: 'Gestão Cultural Pro Shot',
    settings: 'Configurações',
    captureRegion: 'Capturar região',
    captureFullscreen: 'Tela inteira',
    readyToCapture: 'Pronto para capturar com {shortcut} ou Print Screen.',
    heroTag: 'Capturas rápidas para pessoas exigentes',
    heroTitle: 'Capture, desenhe e compartilhe sem sair do fluxo.',
    heroSubtitle:
      'O GCPShot fica na bandeja, aceita atalhos globais, abre com o Windows e oferece ferramentas de marcação no próprio print: caneta, seta, retângulo, texto, copiar, salvar e imprimir.',
    featureTray: 'Bandeja ativa',
    featureTrayDesc: 'Fechar minimiza o app; os atalhos continuam funcionando.',
    featureAnnotate: 'Anotações no print',
    featureAnnotateDesc: 'Caneta, linha, seta, retângulo, texto, desfazer e cores rápidas.',
    featureExport: 'Exportação premium',
    featureExportDesc: 'Copiar, salvar PNG/JPG e imprimir direto da seleção.',
    featureStudio: 'Estúdio GCPShot',
    featureStudioDesc: 'Edite capturas, ajuste cores e monte colagens premium em segundos.',
    openStudio: 'Abrir estúdio',
    studioBack: 'Início',
    studioEyebrow: 'Estúdio premium',
    studioTitle: 'Estúdio de imagens e colagens',
    studioImport: 'Importar imagens',
    studioExport: 'Exportar PNG',
    studioModeEdit: 'Editar imagem',
    studioModeCollage: 'Criar colagem',
    studioLibrary: 'Biblioteca de capturas',
    studioLibraryEmpty: 'Importe imagens ou envie capturas copiadas/salvas para montar seu acervo.',
    studioCanvasEmptyTitle: 'Selecione uma imagem',
    studioCanvasEmptyHint: 'Use a biblioteca à esquerda ou importe arquivos PNG/JPG.',
    studioCollageEmptyTitle: 'Monte sua colagem',
    studioCollageEmptyHint: 'Escolha um layout, selecione imagens e clique nos slots para posicionar.',
    studioAdjustments: 'Ajustes finos',
    studioBrightness: 'Brilho',
    studioContrast: 'Contraste',
    studioSaturation: 'Saturação',
    studioReset: 'Restaurar ajustes',
    studioSaveVariant: 'Salvar versão editada',
    studioCollageLayout: 'Layout da colagem',
    studioLayout2col: '2 colunas',
    studioLayout2row: '2 linhas',
    studioLayout3col: '3 colunas',
    studioLayoutGrid2x2: 'Grade 2×2',
    studioLayoutHeroLeft: 'Destaque à esquerda',
    studioLayoutHeroTop: 'Destaque no topo',
    studioCollageGap: 'Espaço entre fotos',
    studioCollagePadding: 'Margem externa',
    studioCollageBackground: 'Fundo da colagem',
    studioSlot: 'Slot {index}',
    studioSlotEmpty: 'vazio',
    studioAutoFill: 'Preencher automaticamente',
    studioImported: '{count} imagem(ns) importada(s).',
    studioExported: 'Exportado em {path}',
    studioSavedToLibrary: 'Versão editada salva na biblioteca.',
    studioFootnote: 'Capturas copiadas ou salvas entram automaticamente na biblioteca do estúdio.',
    studioAddedFromCapture: 'Captura adicionada ao estúdio.',
    studioRendering: 'Processando imagem...',
    studioRenderFailed: 'Não foi possível processar a imagem. Tente outra captura ou reduza o tamanho.',
    credit: 'Desenvolvido por Bruno Albertini 2026',
    developedBy: 'Desenvolvido por Bruno Albertini',
    contributeBadge: 'Premium · Apoie o projeto',
    contributeTitle: 'Contribua com o desenvolvimento',
    contributeLead: 'O GCPShot é gratuito com recursos premium.',
    contributeNote: 'Sua contribuição, com qualquer valor, ajuda a manter e evoluir o projeto.',
    contributePixTitle: 'Contribuir via PIX (Brasil)',
    contributePixKey: 'Chave PIX (copiar)',
    contributePixScan: 'Escaneie com a câmera do celular',
    contributeStripeTitle: 'Contribuir via Stripe (internacional)',
    contributeStripeButton: 'Contribuir via Stripe (internacional)',
    contributeStripeHint: 'Pagamento seguro via Stripe Checkout — cartão internacional.',
    contributeStripeLink: 'Link Stripe (copiar ou abrir)',
    contributeFooter: 'PIX recomendado no Brasil · Stripe para contribuições internacionais',
    contributeCopy: 'Copiar chave PIX',
    contributeCopied: 'Chave PIX copiada!',
    preferences: 'Preferências',
    settingsTitle: 'Configurações do GCPShot',
    tabGeneral: 'Geral',
    tabShortcuts: 'Teclas de atalho',
    tabFormats: 'Formatos',
    startWithWindows: 'Iniciar com o sistema',
    minimizeToTray: 'Minimizar para a bandeja ao fechar',
    showNotifications: 'Mostrar notificações ao copiar e salvar',
    keepSelection: 'Manter posição da área selecionada',
    captureCursor: 'Capturar cursor na imagem',
    mainShortcut: 'Atalho principal de captura',
    recordShortcut: 'Gravar atalho personalizado',
    recording: 'Pressione a combinação...',
    record: 'Gravar',
    listening: 'Escutando',
    printScreenCapture: 'Usar Print Screen para capturar',
    defaultFormat: 'Formato padrão',
    language: 'Idioma',
    languageAuto: 'Automático (sistema)',
    resetSettings: 'Restaurar configurações padrão',
    settingsUpdated: 'Configurações atualizadas.',
    settingsReset: 'Configurações restauradas para o padrão.',
    custom: 'Personalizado',
    dragSelect: 'Arraste para selecionar uma área.',
    areaSelected: 'Área selecionada. Copie ou salve a captura.',
    adjustSelection: 'Arraste cantos, bordas ou o centro para ajustar a seleção.',
    selectionResizeDone: 'Seleção ajustada.',
    fullscreenSelected: 'Tela inteira selecionada. Edite, copie, salve ou imprima.',
    selectionTooSmall: 'Seleção muito pequena. Arraste novamente.',
    confirmArea: 'Solte o mouse para confirmar a área.',
    drawing: 'Desenhando anotação...',
    annotationAdded: 'Anotação adicionada.',
    undoDone: 'Última anotação removida.',
    redoDone: 'Anotação refeita.',
    moveElement: 'Arraste para reposicionar o último elemento.',
    elementMoved: 'Elemento reposicionado.',
    copying: 'Copiando para a área de transferência...',
    copied: 'Captura copiada.',
    copyFailed: 'Falha ao copiar.',
    saving: 'Abrindo salvamento...',
    saved: 'Salvo em {path}',
    saveFailed: 'Falha ao salvar.',
    printing: 'Abrindo impressão...',
    printDone: 'Impressão enviada.',
    printFailed: 'Falha ao imprimir.',
    whatsappOpening: 'Copiando e abrindo WhatsApp Web...',
    whatsappReady: 'Imagem copiada. Cole no WhatsApp Web com Ctrl+V.',
    whatsappFailed: 'Falha ao compartilhar.',
    helpHint: 'Esc cancela · Enter confirma ferramentas · Alt+Delete limpa',
    toolSelect: 'Ajustar seleção',
    toolMove: 'Mover último elemento',
    toolPen: 'Caneta',
    toolArrow: 'Seta',
    toolMagnifier: 'Lupa',
    toolBlur: 'Desfocar privacidade',
    toolPixelate: 'Pixelizar privacidade',
    toolText: 'Texto',
    toolBubble: 'Balão',
    toolStamp: 'Carimbo',
    toolShapes: 'Formas',
    toolRect: 'Retângulo',
    toolEllipse: 'Círculo',
    toolLine: 'Linha',
    toolStar: 'Estrela',
    toolColors: 'Cores e paletas',
    toolThickness: 'Espessura',
    toolIntensity: 'Intensidade',
    copyAction: 'Copiar imagem editada',
    saveAction: 'Salvar',
    printAction: 'Imprimir',
    whatsappAction: 'WhatsApp Web',
    undoAction: 'Desfazer',
    redoAction: 'Refazer',
    clearAllAction: 'Limpar tudo',
    clearAllDone: 'Anotações removidas. A seleção foi mantida.',
    cancelAction: 'Cancelar',
    moveToolbar: 'Mover barra',
    bubbleSpeech: 'Balão fala',
    bubbleCaption: 'Legenda',
    bubbleThought: 'Pensamento',
    bgFilled: 'Fundo branco',
    bgTransparent: 'Transparente',
    bgOutline: 'Só borda',
    magnifierRect: 'Retangular',
    magnifierEllipse: 'Oval',
    magnifierWidth: 'Largura',
    magnifierHeight: 'Altura',
    magnifierRounded: 'Cantos arredondados',
    magnifierCorners: 'Raio dos cantos',
    toolOutline: 'Contorno',
    stampPlaceholder: 'CARIMBO',
    enterBubbleText: 'Digite o texto do balão.',
    enterText: 'Digite o texto.',
    shortcutCapture: 'Capturar região / tela',
    shortcutCopy: 'Copiar imagem editada',
    shortcutSave: 'Salvar',
    shortcutPrint: 'Imprimir',
    shortcutWhatsapp: 'Enviar para WhatsApp',
    shortcutUndo: 'Desfazer',
    shortcutRedo: 'Refazer',
    shortcutSelect: 'Selecionar área',
    shortcutMove: 'Mover último elemento',
    shortcutPen: 'Caneta',
    shortcutArrow: 'Seta',
    shortcutMagnifier: 'Lupa',
    shortcutBlur: 'Blur / privacidade',
    shortcutPixelate: 'Pixelizar',
    shortcutText: 'Texto',
    shortcutBubble: 'Balão',
    shortcutStamp: 'Carimbo',
    shortcutRect: 'Retângulo',
    shortcutEllipse: 'Elipse',
    shortcutLine: 'Linha',
    shortcutStar: 'Estrela',
    shortcutCancel: 'Cancelar captura',
    settingsArrowHint: 'Atalhos',
    shortcutFullscreen: 'Capturar tela inteira',
    shortcutStudio: 'Abrir estúdio',
    shortcutLiveColor: 'Live Color (conta-gotas)',
    shortcutRecordRegion: 'Gravar região',
    shortcutRecordFullscreen: 'Gravar tela inteira',
    shortcutRecordPause: 'Pausar / retomar gravação',
    shortcutNumStamp: 'Numeração sequencial',
    toolNumStamp: 'Numeração',
    tabVideo: 'Captura e vídeo',
    tabAudio: 'Áudio da gravação',
    videoQuality: 'Qualidade',
    videoQualityBalanced: 'Equilibrada — nitidez + fluidez',
    videoQualitySharp: 'Nítida — mais detalhe',
    videoQualityFluid: 'Fluida — menos CPU/RAM',
    videoFps: 'FPS',
    videoResolution: 'Resolução do vídeo',
    videoResolutionAuto: 'Automática / tamanho real da área',
    videoFormatHint:
      'Formato: H.264 com aceleração por GPU quando disponível; fallback VP8/VP9. Gravação incremental via OPFS (disco local) para economizar RAM.',
    videoOpfsHint:
      'Gravação local otimizada (OPFS): os blocos vão para o disco a cada segundo, mantendo o uso de memória baixo mesmo em tutoriais longos.',
    webcamEnabled: 'Exibir webcam do apresentador',
    webcamShape: 'Forma',
    webcamShapeCircle: 'Circular',
    webcamShapeRounded: 'Arredondado',
    webcamShapeSquare: 'Quadrado',
    webcamSize: 'Tamanho',
    webcamFrameColor: 'Cor do frame',
    recordAudio: 'Gravar áudio',
    audioSource: 'Fonte de áudio',
    audioSourceNone: 'Sem áudio',
    audioSourceMic: 'Microfone',
    audioSourceSystem: 'Sistema',
    audioSourceBoth: 'Microfone + sistema',
    microphoneGain: 'Ganho do microfone',
    recordRegion: 'Gravar região',
    recordFullscreen: 'Gravar tela inteira',
    recordSelectArea: 'Selecione a área para gravar.',
    recordReady: 'Área pronta. Inicie a gravação quando quiser.',
    recordActive: 'Gravando...',
    recordActiveWithCodec: 'Gravando ({codec} · {storage}) · OPFS ativo',
    recordPaused: 'Gravação pausada.',
    recordResume: 'Retomar',
    recordPause: 'Pausar',
    recordStop: 'Parar e salvar',
    recordStart: 'Gravar',
    recordClear: 'Limpar anotações',
    recordCleared: 'Anotações removidas.',
    recordTitle: 'Gravação',
    recordSaved: 'Gravação salva em {path}',
    recordFailed: 'Falha na gravação.',
    recordSaving: 'Finalizando e salvando...',
    recordingCodecH264: 'H.264 (hardware preferido)',
    recordingCodecVp8: 'VP8',
    recordingCodecVp9: 'VP9',
    recordingCodecDefault: 'WebM padrão'
  },
  en: {
    appName: 'GCPShot',
    appEyebrow: 'Gestão Cultural Pro Shot',
    settings: 'Settings',
    captureRegion: 'Capture region',
    captureFullscreen: 'Full screen',
    readyToCapture: 'Ready to capture with {shortcut} or Print Screen.',
    heroTag: 'Fast captures for demanding people',
    heroTitle: 'Capture, annotate and share without leaving your flow.',
    heroSubtitle:
      'GCPShot stays in the tray, supports global shortcuts, starts with Windows and offers markup tools on the screenshot: pen, arrow, rectangle, text, copy, save and print.',
    featureTray: 'Active tray',
    featureTrayDesc: 'Closing minimizes the app; shortcuts keep working.',
    featureAnnotate: 'On-screenshot notes',
    featureAnnotateDesc: 'Pen, line, arrow, rectangle, text, undo and quick colors.',
    featureExport: 'Premium export',
    featureExportDesc: 'Copy, save PNG/JPG and print from the selection.',
    featureStudio: 'GCPShot Studio',
    featureStudioDesc: 'Edit captures, tune colors and build premium collages in seconds.',
    openStudio: 'Open studio',
    studioBack: 'Home',
    studioEyebrow: 'Premium studio',
    studioTitle: 'Image & collage studio',
    studioImport: 'Import images',
    studioExport: 'Export PNG',
    studioModeEdit: 'Edit image',
    studioModeCollage: 'Create collage',
    studioLibrary: 'Capture library',
    studioLibraryEmpty: 'Import images or send copied/saved captures to build your library.',
    studioCanvasEmptyTitle: 'Select an image',
    studioCanvasEmptyHint: 'Use the library on the left or import PNG/JPG files.',
    studioCollageEmptyTitle: 'Build your collage',
    studioCollageEmptyHint: 'Pick a layout, select images and click slots to assign them.',
    studioAdjustments: 'Fine adjustments',
    studioBrightness: 'Brightness',
    studioContrast: 'Contrast',
    studioSaturation: 'Saturation',
    studioReset: 'Reset adjustments',
    studioSaveVariant: 'Save edited version',
    studioCollageLayout: 'Collage layout',
    studioLayout2col: '2 columns',
    studioLayout2row: '2 rows',
    studioLayout3col: '3 columns',
    studioLayoutGrid2x2: '2×2 grid',
    studioLayoutHeroLeft: 'Hero left',
    studioLayoutHeroTop: 'Hero top',
    studioCollageGap: 'Photo spacing',
    studioCollagePadding: 'Outer margin',
    studioCollageBackground: 'Collage background',
    studioSlot: 'Slot {index}',
    studioSlotEmpty: 'empty',
    studioAutoFill: 'Auto-fill slots',
    studioImported: '{count} image(s) imported.',
    studioExported: 'Exported to {path}',
    studioSavedToLibrary: 'Edited version saved to library.',
    studioFootnote: 'Copied or saved captures are automatically added to the studio library.',
    studioAddedFromCapture: 'Capture added to studio.',
    studioRendering: 'Processing image...',
    studioRenderFailed: 'Could not process the image. Try another capture or reduce its size.',
    credit: 'Developed by Bruno Albertini 2026',
    developedBy: 'Developed by Bruno Albertini',
    contributeBadge: 'Premium · Support the project',
    contributeTitle: 'Support development',
    contributeLead: 'GCPShot is free with premium features.',
    contributeNote: 'Any contribution helps maintain and improve the project.',
    contributePixTitle: 'Contribute via PIX (Brazil)',
    contributePixKey: 'PIX key (copy)',
    contributePixScan: 'Scan with your phone camera',
    contributeStripeTitle: 'Contribute via Stripe (international)',
    contributeStripeButton: 'Contribute via Stripe (international)',
    contributeStripeHint: 'Secure payment via Stripe Checkout — international cards.',
    contributeStripeLink: 'Stripe link (copy or open)',
    contributeFooter: 'PIX recommended in Brazil · Stripe for international contributions',
    contributeCopy: 'Copy PIX key',
    contributeCopied: 'PIX key copied!',
    preferences: 'Preferences',
    settingsTitle: 'GCPShot Settings',
    tabGeneral: 'General',
    tabShortcuts: 'Shortcuts',
    tabFormats: 'Formats',
    startWithWindows: 'Start with the system',
    minimizeToTray: 'Minimize to tray on close',
    showNotifications: 'Show notifications on copy and save',
    keepSelection: 'Keep selection area position',
    captureCursor: 'Capture cursor in image',
    mainShortcut: 'Main capture shortcut',
    recordShortcut: 'Record custom shortcut',
    recording: 'Press the key combination...',
    record: 'Record',
    listening: 'Listening',
    printScreenCapture: 'Use Print Screen to capture',
    defaultFormat: 'Default format',
    language: 'Language',
    languageAuto: 'Automatic (system)',
    resetSettings: 'Restore default settings',
    settingsUpdated: 'Settings updated.',
    settingsReset: 'Settings restored to defaults.',
    custom: 'Custom',
    dragSelect: 'Drag to select an area.',
    areaSelected: 'Area selected. Copy or save the capture.',
    adjustSelection: 'Drag corners, edges or the center to fine-tune the selection.',
    selectionResizeDone: 'Selection adjusted.',
    fullscreenSelected: 'Full screen selected. Edit, copy, save or print.',
    selectionTooSmall: 'Selection too small. Drag again.',
    confirmArea: 'Release the mouse to confirm the area.',
    drawing: 'Drawing annotation...',
    annotationAdded: 'Annotation added.',
    undoDone: 'Last annotation removed.',
    redoDone: 'Annotation restored.',
    moveElement: 'Drag to reposition the last element.',
    elementMoved: 'Element repositioned.',
    copying: 'Copying to clipboard...',
    copied: 'Capture copied.',
    copyFailed: 'Failed to copy.',
    saving: 'Opening save dialog...',
    saved: 'Saved to {path}',
    saveFailed: 'Failed to save.',
    printing: 'Opening print dialog...',
    printDone: 'Sent to print.',
    printFailed: 'Failed to print.',
    whatsappOpening: 'Copying and opening WhatsApp Web...',
    whatsappReady: 'Image copied. Paste in WhatsApp Web with Ctrl+V.',
    whatsappFailed: 'Failed to share.',
    helpHint: 'Esc cancel · Enter confirms tools · Alt+Delete clears',
    toolSelect: 'Adjust selection',
    toolMove: 'Move last element',
    toolPen: 'Pen',
    toolArrow: 'Arrow',
    toolMagnifier: 'Magnifier',
    toolBlur: 'Blur privacy',
    toolPixelate: 'Pixelate privacy',
    toolText: 'Text',
    toolBubble: 'Bubble',
    toolStamp: 'Stamp',
    toolShapes: 'Shapes',
    toolRect: 'Rectangle',
    toolEllipse: 'Circle',
    toolLine: 'Line',
    toolStar: 'Star',
    toolColors: 'Colors and palettes',
    toolThickness: 'Thickness',
    toolIntensity: 'Intensity',
    copyAction: 'Copy edited image',
    saveAction: 'Save',
    printAction: 'Print',
    whatsappAction: 'WhatsApp Web',
    undoAction: 'Undo',
    redoAction: 'Redo',
    clearAllAction: 'Clear all',
    clearAllDone: 'Annotations cleared. Selection kept.',
    cancelAction: 'Cancel',
    moveToolbar: 'Move toolbar',
    bubbleSpeech: 'Speech bubble',
    bubbleCaption: 'Caption',
    bubbleThought: 'Thought bubble',
    bgFilled: 'White background',
    bgTransparent: 'Transparent',
    bgOutline: 'Border only',
    magnifierRect: 'Rectangle',
    magnifierEllipse: 'Oval',
    magnifierWidth: 'Width',
    magnifierHeight: 'Height',
    magnifierRounded: 'Rounded corners',
    magnifierCorners: 'Corner radius',
    toolOutline: 'Outline',
    stampPlaceholder: 'STAMP',
    enterBubbleText: 'Enter bubble text.',
    enterText: 'Enter text.',
    shortcutCapture: 'Capture region / screen',
    shortcutCopy: 'Copy edited image',
    shortcutSave: 'Save',
    shortcutPrint: 'Print',
    shortcutWhatsapp: 'Send to WhatsApp',
    shortcutUndo: 'Undo',
    shortcutRedo: 'Redo',
    shortcutSelect: 'Select area',
    shortcutMove: 'Move last element',
    shortcutPen: 'Pen',
    shortcutArrow: 'Arrow',
    shortcutMagnifier: 'Magnifier',
    shortcutBlur: 'Blur / privacy',
    shortcutPixelate: 'Pixelate',
    shortcutText: 'Text',
    shortcutBubble: 'Bubble',
    shortcutStamp: 'Stamp',
    shortcutRect: 'Rectangle',
    shortcutEllipse: 'Ellipse',
    shortcutLine: 'Line',
    shortcutStar: 'Star',
    shortcutCancel: 'Cancel capture',
    settingsArrowHint: 'Shortcuts',
    shortcutFullscreen: 'Capture full screen',
    shortcutStudio: 'Open studio',
    shortcutLiveColor: 'Live Color (eyedropper)',
    shortcutRecordRegion: 'Record region',
    shortcutRecordFullscreen: 'Record full screen',
    shortcutRecordPause: 'Pause / resume recording',
    shortcutNumStamp: 'Sequential numbering',
    toolNumStamp: 'Numbering',
    tabVideo: 'Capture & video',
    tabAudio: 'Recording audio',
    videoQuality: 'Quality',
    videoQualityBalanced: 'Balanced — sharpness + fluidity',
    videoQualitySharp: 'Sharp — more detail',
    videoQualityFluid: 'Fluid — lower CPU/RAM',
    videoFps: 'FPS',
    videoResolution: 'Video resolution',
    videoResolutionAuto: 'Automatic / actual area size',
    videoFormatHint:
      'Format: H.264 with GPU acceleration when available; VP8/VP9 fallback. Incremental OPFS recording to save RAM.',
    videoOpfsHint:
      'Optimized local recording (OPFS): chunks are written to disk every second, keeping memory low even on long tutorials.',
    webcamEnabled: 'Show presenter webcam',
    webcamShape: 'Shape',
    webcamShapeCircle: 'Circle',
    webcamShapeRounded: 'Rounded',
    webcamShapeSquare: 'Square',
    webcamSize: 'Size',
    webcamFrameColor: 'Frame color',
    recordAudio: 'Record audio',
    audioSource: 'Audio source',
    audioSourceNone: 'No audio',
    audioSourceMic: 'Microphone',
    audioSourceSystem: 'System',
    audioSourceBoth: 'Mic + system',
    microphoneGain: 'Microphone gain',
    recordRegion: 'Record region',
    recordFullscreen: 'Record full screen',
    recordSelectArea: 'Select the area to record.',
    recordReady: 'Area ready. Start recording when you want.',
    recordActive: 'Recording...',
    recordActiveWithCodec: 'Recording ({codec} · {storage}) · OPFS on',
    recordPaused: 'Recording paused.',
    recordResume: 'Resume',
    recordPause: 'Pause',
    recordStop: 'Stop & save',
    recordStart: 'Record',
    recordClear: 'Clear annotations',
    recordCleared: 'Annotations cleared.',
    recordTitle: 'Recording',
    recordSaved: 'Recording saved to {path}',
    recordFailed: 'Recording failed.',
    recordSaving: 'Finishing and saving...',
    recordingCodecH264: 'H.264 (hardware preferred)',
    recordingCodecVp8: 'VP8',
    recordingCodecVp9: 'VP9',
    recordingCodecDefault: 'Default WebM'
  },
  es: {
    appName: 'GCPShot',
    appEyebrow: 'Gestão Cultural Pro Shot',
    settings: 'Configuración',
    captureRegion: 'Capturar región',
    captureFullscreen: 'Pantalla completa',
    readyToCapture: 'Listo para capturar con {shortcut} o Print Screen.',
    heroTag: 'Capturas rápidas para personas exigentes',
    heroTitle: 'Capture, dibuje y comparta sin salir del flujo.',
    heroSubtitle:
      'GCPShot permanece en la bandeja, acepta atajos globales, inicia con Windows y ofrece herramientas de marcado en la captura: lápiz, flecha, rectángulo, texto, copiar, guardar e imprimir.',
    featureTray: 'Bandeja activa',
    featureTrayDesc: 'Al cerrar minimiza la app; los atajos siguen funcionando.',
    featureAnnotate: 'Anotaciones en la captura',
    featureAnnotateDesc: 'Lápiz, línea, flecha, rectángulo, texto, deshacer y colores rápidos.',
    featureExport: 'Exportación premium',
    featureExportDesc: 'Copiar, guardar PNG/JPG e imprimir desde la selección.',
    featureStudio: 'Estudio GCPShot',
    featureStudioDesc: 'Edita capturas, ajusta colores y crea collages premium en segundos.',
    openStudio: 'Abrir estudio',
    studioBack: 'Inicio',
    studioEyebrow: 'Estudio premium',
    studioTitle: 'Estudio de imágenes y collages',
    studioImport: 'Importar imágenes',
    studioExport: 'Exportar PNG',
    studioModeEdit: 'Editar imagen',
    studioModeCollage: 'Crear collage',
    studioLibrary: 'Biblioteca de capturas',
    studioLibraryEmpty: 'Importa imágenes o envía capturas copiadas/guardadas para armar tu acervo.',
    studioCanvasEmptyTitle: 'Selecciona una imagen',
    studioCanvasEmptyHint: 'Usa la biblioteca a la izquierda o importa archivos PNG/JPG.',
    studioCollageEmptyTitle: 'Arma tu collage',
    studioCollageEmptyHint: 'Elige un layout, selecciona imágenes y haz clic en los slots.',
    studioAdjustments: 'Ajustes finos',
    studioBrightness: 'Brillo',
    studioContrast: 'Contraste',
    studioSaturation: 'Saturación',
    studioReset: 'Restaurar ajustes',
    studioSaveVariant: 'Guardar versión editada',
    studioCollageLayout: 'Layout del collage',
    studioLayout2col: '2 columnas',
    studioLayout2row: '2 filas',
    studioLayout3col: '3 columnas',
    studioLayoutGrid2x2: 'Cuadrícula 2×2',
    studioLayoutHeroLeft: 'Destacado a la izquierda',
    studioLayoutHeroTop: 'Destacado arriba',
    studioCollageGap: 'Espacio entre fotos',
    studioCollagePadding: 'Margen externo',
    studioCollageBackground: 'Fondo del collage',
    studioSlot: 'Slot {index}',
    studioSlotEmpty: 'vacío',
    studioAutoFill: 'Rellenar automáticamente',
    studioImported: '{count} imagen(es) importada(s).',
    studioExported: 'Exportado en {path}',
    studioSavedToLibrary: 'Versión editada guardada en la biblioteca.',
    studioFootnote: 'Las capturas copiadas o guardadas entran automáticamente en la biblioteca del estudio.',
    studioAddedFromCapture: 'Captura añadida al estudio.',
    studioRendering: 'Procesando imagen...',
    studioRenderFailed: 'No se pudo procesar la imagen. Prueba otra captura o reduce el tamaño.',
    credit: 'Desarrollado por Bruno Albertini 2026',
    developedBy: 'Desarrollado por Bruno Albertini',
    contributeBadge: 'Premium · Apoya el proyecto',
    contributeTitle: 'Contribuye al desarrollo',
    contributeLead: 'GCPShot es gratuito con funciones premium.',
    contributeNote: 'Tu contribución, de cualquier valor, ayuda a mantener y evolucionar el proyecto.',
    contributePixTitle: 'Contribuir vía PIX (Brasil)',
    contributePixKey: 'Clave PIX (copiar)',
    contributePixScan: 'Escanea con la cámara del celular',
    contributeStripeTitle: 'Contribuir vía Stripe (internacional)',
    contributeStripeButton: 'Contribuir vía Stripe (internacional)',
    contributeStripeHint: 'Pago seguro vía Stripe Checkout — tarjeta internacional.',
    contributeStripeLink: 'Enlace Stripe (copiar o abrir)',
    contributeFooter: 'PIX recomendado en Brasil · Stripe para contribuciones internacionales',
    contributeCopy: 'Copiar clave PIX',
    contributeCopied: '¡Clave PIX copiada!',
    preferences: 'Preferencias',
    settingsTitle: 'Configuración de GCPShot',
    tabGeneral: 'General',
    tabShortcuts: 'Atajos de teclado',
    tabFormats: 'Formatos',
    startWithWindows: 'Iniciar con el sistema',
    minimizeToTray: 'Minimizar a la bandeja al cerrar',
    showNotifications: 'Mostrar notificaciones al copiar y guardar',
    keepSelection: 'Mantener posición del área seleccionada',
    captureCursor: 'Capturar cursor en la imagen',
    mainShortcut: 'Atajo principal de captura',
    recordShortcut: 'Grabar atajo personalizado',
    recording: 'Presione la combinación...',
    record: 'Grabar',
    listening: 'Escuchando',
    printScreenCapture: 'Usar Print Screen para capturar',
    defaultFormat: 'Formato predeterminado',
    language: 'Idioma',
    languageAuto: 'Automático (sistema)',
    resetSettings: 'Restaurar configuración predeterminada',
    settingsUpdated: 'Configuración actualizada.',
    settingsReset: 'Configuración restaurada a los valores predeterminados.',
    custom: 'Personalizado',
    dragSelect: 'Arrastre para seleccionar un área.',
    areaSelected: 'Área seleccionada. Copie o guarde la captura.',
    adjustSelection: 'Arrastre esquinas, bordes o el centro para ajustar la selección.',
    selectionResizeDone: 'Selección ajustada.',
    fullscreenSelected: 'Pantalla completa seleccionada. Edite, copie, guarde o imprima.',
    selectionTooSmall: 'Selección muy pequeña. Arrastre de nuevo.',
    confirmArea: 'Suelte el mouse para confirmar el área.',
    drawing: 'Dibujando anotación...',
    annotationAdded: 'Anotación agregada.',
    undoDone: 'Última anotación eliminada.',
    redoDone: 'Anotación rehecha.',
    moveElement: 'Arrastre para reposicionar el último elemento.',
    elementMoved: 'Elemento reposicionado.',
    copying: 'Copiando al portapapeles...',
    copied: 'Captura copiada.',
    copyFailed: 'Error al copiar.',
    saving: 'Abriendo guardado...',
    saved: 'Guardado en {path}',
    saveFailed: 'Error al guardar.',
    printing: 'Abriendo impresión...',
    printDone: 'Impresión enviada.',
    printFailed: 'Error al imprimir.',
    whatsappOpening: 'Copiando y abriendo WhatsApp Web...',
    whatsappReady: 'Imagen copiada. Pegue en WhatsApp Web con Ctrl+V.',
    whatsappFailed: 'Error al compartir.',
    helpHint: 'Esc cancelar · Enter confirma herramientas · Alt+Delete limpia',
    toolSelect: 'Ajustar selección',
    toolMove: 'Mover último elemento',
    toolPen: 'Lápiz',
    toolArrow: 'Flecha',
    toolMagnifier: 'Lupa',
    toolBlur: 'Desenfocar privacidad',
    toolPixelate: 'Pixelar privacidad',
    toolText: 'Texto',
    toolBubble: 'Globo',
    toolStamp: 'Sello',
    toolShapes: 'Formas',
    toolRect: 'Rectángulo',
    toolEllipse: 'Círculo',
    toolLine: 'Línea',
    toolStar: 'Estrella',
    toolColors: 'Colores y paletas',
    toolThickness: 'Grosor',
    toolIntensity: 'Intensidad',
    copyAction: 'Copiar imagen editada',
    saveAction: 'Guardar',
    printAction: 'Imprimir',
    whatsappAction: 'WhatsApp Web',
    undoAction: 'Deshacer',
    redoAction: 'Rehacer',
    clearAllAction: 'Limpiar todo',
    clearAllDone: 'Anotaciones eliminadas. La selección se mantuvo.',
    cancelAction: 'Cancelar',
    moveToolbar: 'Mover barra',
    bubbleSpeech: 'Globo de diálogo',
    bubbleCaption: 'Leyenda',
    bubbleThought: 'Pensamiento',
    bgFilled: 'Fondo blanco',
    bgTransparent: 'Transparente',
    bgOutline: 'Solo borde',
    magnifierRect: 'Rectangular',
    magnifierEllipse: 'Oval',
    magnifierWidth: 'Ancho',
    magnifierHeight: 'Alto',
    magnifierRounded: 'Esquinas redondeadas',
    magnifierCorners: 'Radio de esquinas',
    toolOutline: 'Contorno',
    stampPlaceholder: 'SELLO',
    enterBubbleText: 'Escriba el texto del globo.',
    enterText: 'Escriba el texto.',
    shortcutCapture: 'Capturar región / pantalla',
    shortcutCopy: 'Copiar imagen editada',
    shortcutSave: 'Guardar',
    shortcutPrint: 'Imprimir',
    shortcutWhatsapp: 'Enviar a WhatsApp',
    shortcutUndo: 'Deshacer',
    shortcutRedo: 'Rehacer',
    shortcutSelect: 'Seleccionar área',
    shortcutMove: 'Mover último elemento',
    shortcutPen: 'Lápiz',
    shortcutArrow: 'Flecha',
    shortcutMagnifier: 'Lupa',
    shortcutBlur: 'Blur / privacidad',
    shortcutPixelate: 'Pixelar',
    shortcutText: 'Texto',
    shortcutBubble: 'Globo',
    shortcutStamp: 'Sello',
    shortcutRect: 'Rectángulo',
    shortcutEllipse: 'Elipse',
    shortcutLine: 'Línea',
    shortcutStar: 'Estrella',
    shortcutCancel: 'Cancelar captura',
    settingsArrowHint: 'Atajos',
    shortcutFullscreen: 'Capturar pantalla completa',
    shortcutStudio: 'Abrir estudio',
    shortcutLiveColor: 'Live Color (cuentagotas)',
    shortcutRecordRegion: 'Grabar región',
    shortcutRecordFullscreen: 'Grabar pantalla completa',
    shortcutRecordPause: 'Pausar / reanudar grabación',
    shortcutNumStamp: 'Numeración secuencial',
    toolNumStamp: 'Numeración',
    tabVideo: 'Captura y vídeo',
    tabAudio: 'Audio de la grabación',
    videoQuality: 'Calidad',
    videoQualityBalanced: 'Equilibrada — nitidez + fluidez',
    videoQualitySharp: 'Nítida — más detalle',
    videoQualityFluid: 'Fluida — menos CPU/RAM',
    videoFps: 'FPS',
    videoResolution: 'Resolución del vídeo',
    videoResolutionAuto: 'Automática / tamaño real del área',
    videoFormatHint:
      'Formato: H.264 con aceleración GPU cuando esté disponible; fallback VP8/VP9. Grabación incremental OPFS para ahorrar RAM.',
    videoOpfsHint:
      'Grabación local optimizada (OPFS): los bloques se escriben en disco cada segundo, manteniendo bajo el uso de memoria.',
    webcamEnabled: 'Mostrar webcam del presentador',
    webcamShape: 'Forma',
    webcamShapeCircle: 'Circular',
    webcamShapeRounded: 'Redondeado',
    webcamShapeSquare: 'Cuadrado',
    webcamSize: 'Tamaño',
    webcamFrameColor: 'Color del marco',
    recordAudio: 'Grabar audio',
    audioSource: 'Fuente de audio',
    audioSourceNone: 'Sin audio',
    audioSourceMic: 'Micrófono',
    audioSourceSystem: 'Sistema',
    audioSourceBoth: 'Micrófono + sistema',
    microphoneGain: 'Ganio del micrófono',
    recordRegion: 'Grabar región',
    recordFullscreen: 'Grabar pantalla completa',
    recordSelectArea: 'Seleccione el área para grabar.',
    recordReady: 'Área lista. Inicie la grabación cuando quiera.',
    recordActive: 'Grabando...',
    recordActiveWithCodec: 'Grabando ({codec} · {storage}) · OPFS activo',
    recordPaused: 'Grabación en pausa.',
    recordResume: 'Reanudar',
    recordPause: 'Pausar',
    recordStop: 'Detener y guardar',
    recordStart: 'Grabar',
    recordClear: 'Limpiar anotaciones',
    recordCleared: 'Anotaciones eliminadas.',
    recordTitle: 'Grabación',
    recordSaved: 'Grabación guardada en {path}',
    recordFailed: 'Error en la grabación.',
    recordSaving: 'Finalizando y guardando...',
    recordingCodecH264: 'H.264 (hardware preferido)',
    recordingCodecVp8: 'VP8',
    recordingCodecVp9: 'VP9',
    recordingCodecDefault: 'WebM predeterminado'
  }
}

export function detectSystemLanguage(): ResolvedLanguage {
  const locale = (typeof navigator !== 'undefined' ? navigator.language : 'pt-BR').toLowerCase()

  if (locale.startsWith('es')) {
    return 'es'
  }

  if (locale.startsWith('en')) {
    return 'en'
  }

  return 'pt-BR'
}

export function resolveLanguage(language: AppLanguage): ResolvedLanguage {
  if (language === 'auto') {
    return detectSystemLanguage()
  }

  return language
}

export function t(language: AppLanguage, key: TranslationKey, vars?: Record<string, string>): string {
  const resolved = resolveLanguage(language)
  let text = translations[resolved][key] ?? translations['pt-BR'][key] ?? key

  if (vars) {
    Object.entries(vars).forEach(([name, value]) => {
      text = text.replace(`{${name}}`, value)
    })
  }

  return text
}
