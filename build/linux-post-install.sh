#!/bin/bash
# Move the desktop shortcut into the global applications folder
cp /opt/OPENPRIX/Server_Runtime/build/openprix-server.desktop /usr/share/applications/openprix-server.desktop
chmod +x /opt/OPENPRIX/Server_Runtime/start-server.sh
chmod +x /usr/share/applications/openprix-server.desktop
update-desktop-database /usr/share/applications