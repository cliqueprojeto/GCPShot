!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Bem-vindo ao GCPShot"
  !define MUI_WELCOMEPAGE_TEXT "Capture. Crie. Compartilhe.$\r$\n$\r$\nCapturas rapidas, estudio de imagem e ferramentas de cor em um unico espaco.$\r$\n$\r$\nClique em Avancar para instalar."
  !insertmacro MUI_PAGE_WELCOME
!macroend

!macro customInstall
  CreateShortCut "$INSTDIR\Desinstalar GCPShot.lnk" "$INSTDIR\${UNINSTALL_FILENAME}" "" "$INSTDIR\${UNINSTALL_FILENAME}" 0 "" "" "Desinstalar GCPShot"
!macroend

