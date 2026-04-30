!include nsDialogs.nsh

Var Dialog
Var ServerCheckbox
Var InstallServer

; Inject our custom page right after the directory selection
Page custom ServerOptionsPage ServerOptionsLeave

Function ServerOptionsPage
    nsDialogs::Create 1018
    Pop $Dialog

    ${NSD_CreateLabel} 0 0 100% 24u "Would you like to install the Local Master Server?$\r$\n(Requires the external 'Server_Runtime' folder to be present next to this installer)"
    Pop $0

    ${NSD_CreateCheckbox} 10u 30u 100% 15u "Install OpenPrix Master Server"
    Pop $ServerCheckbox

    ; Check if the external folder exists relative to where the .exe is running from
    IfFileExists "$EXEDIR\Server_Runtime\*.*" FolderExists FolderMissing

    FolderMissing:
        EnableWindow $ServerCheckbox 0 ; Disable the checkbox
        ${NSD_CreateLabel} 10u 50u 100% 15u "⚠️ External 'Server_Runtime' payload not found. Server install disabled."
        Pop $0
        SetCtlColors $0 0xFF0000 transparent
        Goto EndPage

    FolderExists:
        ${NSD_Check} $ServerCheckbox ; Check it by default if the folder exists

    EndPage:
    nsDialogs::Show
FunctionEnd

Function ServerOptionsLeave
    ; Save the checkbox state
    ${NSD_GetState} $ServerCheckbox $InstallServer
FunctionEnd

!macro customInstall
    ; This runs during the actual file copy phase
    
    ${If} $InstallServer == ${BST_CHECKED}
        DetailPrint "Installing Master Server payload..."
        SetOutPath "$INSTDIR\Server_Runtime"
        
        ; Magically copy the external files into the installation directory
        CopyFiles /SILENT "$EXEDIR\Server_Runtime\*.*" "$INSTDIR\Server_Runtime"

        ; Create the Server Shortcut on the Desktop
        CreateShortCut "$DESKTOP\OpenPrix Master Server.lnk" "$INSTDIR\Server_Runtime\start-server.bat" "" "$INSTDIR\Server_Runtime\public\icon.ico"
    ${EndIf}
!macroend

!macro customUnInstall
    ; Clean up the server files if the user uninstalls OpenPrix
    Delete "$DESKTOP\OpenPrix Master Server.lnk"
    RMDir /r "$INSTDIR\Server_Runtime"
!macroend