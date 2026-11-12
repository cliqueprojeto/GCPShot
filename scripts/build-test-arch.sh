#!/usr/bin/env bash
set -euo pipefail
pacman -Syu --noconfirm --needed base-devel nodejs xorg-server-xvfb xorg-xprop xorg-xsetroot xdotool dbus ttf-dejavu
mapfile -t dependencies < <(bash -c 'source /work/packaging/arch/PKGBUILD; printf "%s\n" "${depends[@]}"')
pacman -S --noconfirm --needed "${dependencies[@]}"
useradd --create-home builder
install -d -o builder -g builder /tmp/gcpshot-build
deb=$(ls /work/release/linux-approved/GCPShot-*-Linux-amd64.deb | head -n1)
test -f "$deb"
debver=$(basename "$deb" | sed -E 's/^GCPShot-(.+)-Linux-amd64\.deb$/\1/')
sha=$(sha256sum "$deb" | cut -d' ' -f1)
install -m 644 -o builder -g builder /work/packaging/arch/PKGBUILD /tmp/gcpshot-build/PKGBUILD
sed -i -E "s/^_debver=.*/_debver=${debver}/; s/^pkgver=.*/pkgver=${debver//-/_}/; s/^sha256sums=.*/sha256sums=('${sha}')/" /tmp/gcpshot-build/PKGBUILD
install -m 644 -o builder -g builder "$deb" /tmp/gcpshot-build/
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
