#!/bin/bash
# CastMate .deb post-remove script.
# Cleans up the udev rule installed by after-install.sh. The user is *not*
# removed from the `input` group here — that group is shared with other apps
# and shouldn't be touched on uninstall.

set -e

UDEV_DST=/etc/udev/rules.d/99-castmate-uinput.rules

if [ -f "$UDEV_DST" ]; then
    rm -f "$UDEV_DST"
    if command -v udevadm >/dev/null 2>&1; then
        udevadm control --reload >/dev/null 2>&1 || true
        udevadm trigger >/dev/null 2>&1 || true
    fi
fi

exit 0
