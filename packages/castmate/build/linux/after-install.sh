#!/bin/bash
# CastMate .deb post-install script.
# Installed by electron-builder's `deb.afterInstall`. Runs as root after dpkg
# unpacks the package. Currently installs a udev rule that lets desktop users
# write to /dev/uinput so CastMate's Wayland-native input simulation works
# without the user being root.

set -e

INSTALL_DIR=/opt/CastMate
RES_DIR="$INSTALL_DIR/resources/linux"

# --- 1. udev rule for /dev/uinput (M9 input simulation on Wayland) ----------
UDEV_SRC="$RES_DIR/99-castmate-uinput.rules"
UDEV_DST=/etc/udev/rules.d/99-castmate-uinput.rules

if [ -f "$UDEV_SRC" ]; then
    install -m 0644 "$UDEV_SRC" "$UDEV_DST"

    # Apply the rule immediately so the device permissions update without a
    # reboot. Both calls are best-effort — on minimal containers `udevadm`
    # may not be present, and that's fine: the rule will take effect at the
    # next boot regardless.
    if command -v udevadm >/dev/null 2>&1; then
        udevadm control --reload >/dev/null 2>&1 || true
        udevadm trigger >/dev/null 2>&1 || true
    fi

    echo "CastMate: installed udev rule for /dev/uinput at $UDEV_DST"
    echo "  On most desktops (GNOME/KDE/Cinnamon with systemd-logind) the rule's"
    echo "  TAG+=\"uaccess\" gives the active user immediate access — nothing else"
    echo "  to do."
    echo "  On systems without logind ACLs, add yourself to the 'input' group:"
    echo "    sudo usermod -aG input <your-username>     (then log out and back in)"
fi

# --- 2. AppStream metainfo (so Discover/GNOME Software show rich info) ------
APPSTREAM_SRC="$RES_DIR/com.lordtocs.castmate.metainfo.xml"
APPSTREAM_DST=/usr/share/metainfo/com.lordtocs.castmate.metainfo.xml

if [ -f "$APPSTREAM_SRC" ]; then
    install -D -m 0644 "$APPSTREAM_SRC" "$APPSTREAM_DST"
    # Some distros watch /usr/share/metainfo and refresh their cache
    # automatically; the ones that don't will pick it up at next reboot.
fi

exit 0
