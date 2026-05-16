#!/bin/bash
# CastMate .deb post-install script.
# Installed by electron-builder's `deb.afterInstall`. Runs as root after dpkg
# unpacks the package. Currently installs a udev rule that lets desktop users
# write to /dev/uinput so CastMate's Wayland-native input simulation works
# without the user being root.

set -e

INSTALL_DIR=/opt/CastMate
UDEV_SRC="$INSTALL_DIR/resources/linux/99-castmate-uinput.rules"
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

exit 0
