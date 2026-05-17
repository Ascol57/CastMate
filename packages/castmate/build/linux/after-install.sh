#!/bin/bash
# CastMate .deb post-install script.
#
# The udev rule and AppStream metainfo are installed directly to their
# canonical system paths by fpm (see `deb.fpm` in electron-builder-config).
# This script only runs the "hot apply" steps so the changes take effect
# without a reboot.

set -e

# --- udev rule applies immediately (M9 input simulation on Wayland) ----------
if [ -f /etc/udev/rules.d/99-castmate-uinput.rules ]; then
    if command -v udevadm >/dev/null 2>&1; then
        udevadm control --reload >/dev/null 2>&1 || true
        udevadm trigger >/dev/null 2>&1 || true
    fi

    echo "CastMate: udev rule for /dev/uinput is active."
    echo "  Most desktop sessions (GNOME/KDE/Cinnamon with systemd-logind) grant"
    echo "  the active user immediate access via the rule's TAG+=\"uaccess\"."
    echo "  On systems without logind ACLs, add yourself to the 'input' group:"
    echo "    sudo usermod -aG input <your-username>     (then log out and back in)"
fi

# --- AppStream cache refresh so Discover/GNOME Software pick up the metainfo -
if command -v appstreamcli >/dev/null 2>&1; then
    appstreamcli refresh-cache --force >/dev/null 2>&1 || \
        appstreamcli refresh --force    >/dev/null 2>&1 || true
fi

exit 0
