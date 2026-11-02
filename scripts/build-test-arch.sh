#!/usr/bin/env bash
set -euo pipefail
pacman -Syu --noconfirm --needed base-devel nodejs xorg-server-xvfb xorg-xprop xorg-xsetroot xdotool dbus ttf-dejavu
mapfile -t dependencies < <(bash -c 'source /work/packaging/arch/PKGBUILD; printf "%s\n" "${depends[@]}"')
pacman -S --noconfirm --needed "${dependencies[@]}"
useradd --create-home builder
install -d -o builder -g builder /tmp/gcpshot-build
install -m 644 -o builder -g builder /work/packaging/arch/PKGBUILD /tmp/gcpshot-build/PKGBUILD
install -m 644 -o builder -g builder /work/release/linux-approved/GCPShot-0.7.0-Linux-amd64.deb /tmp/gcpshot-build/
runuser -u builder -- bash -c 'cd /tmp/gcpshot-build && makepkg --noconfirm'
pacman -U --noconfirm /tmp/gcpshot-build/gcpshot-*.pkg.tar.zst
pacman -Q gcpshot
pacman -Qkk gcpshot
test "$(readlink /usr/bin/gcpshot)" = /opt/GCPShot/gcpshot
test "$(stat -c %a /opt/GCPShot/chrome-sandbox)" = 4755
cmp /opt/GCPShot/resources/app.asar /tmp/gcpshot-build/pkg/gcpshot/opt/GCPShot/resources/app.asar
export DISPLAY=:99 GDK_BACKEND=x11 XDG_SESSION_TYPE=x11 GCP_TEST_NO_SANDBOX=1
Xvfb :99 -screen 0 1280x900x24 -nolisten tcp -noreset &
server=$!
trap 'kill "$server" || true' EXIT
for attempt in $(seq 1 50); do
  if xprop -root >/dev/null 2>&1; then break; fi
  sleep .1
done
dbus-run-session -- node scripts/test-packaged.cjs
install -d /work/release/BigLinux
install -m 644 /tmp/gcpshot-build/gcpshot-*.pkg.tar.zst /work/release/BigLinux/
