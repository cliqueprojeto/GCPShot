#!/usr/bin/env bash
set -euo pipefail
dnf install -y /work/release/*.rpm nodejs xorg-x11-server-Xvfb xprop xsetroot xdotool dbus-daemon gtk3 nss alsa-lib mesa-libgbm libdrm libsecret at-spi2-atk libX11-xcb libxkbcommon cups-libs liberation-sans-fonts
rpm -q gcpshot
export DISPLAY=:99 GDK_BACKEND=x11 XDG_SESSION_TYPE=x11 GCP_TEST_NO_SANDBOX=1
Xvfb :99 -screen 0 1280x900x24 -nolisten tcp -noreset &
server=$!
trap 'kill "$server" || true' EXIT
for attempt in $(seq 1 50); do
  if xprop -root >/dev/null 2>&1; then break; fi
  sleep .1
done
dbus-run-session -- node scripts/test-packaged.cjs
