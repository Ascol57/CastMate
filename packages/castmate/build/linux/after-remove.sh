#!/bin/bash
# CastMate .deb post-remove script.
#
# The udev rule and AppStream metainfo are owned by dpkg (placed natively
# via `deb.fpm`), so dpkg removes them automatically. This script only
# rehoms the system after their removal so the changes take effect
# immediately.

set -e

# udev pick up the deleted rule
if command -v udevadm >/dev/null 2>&1; then
    udevadm control --reload >/dev/null 2>&1 || true
    udevadm trigger >/dev/null 2>&1 || true
fi

# AppStream cache no longer references CastMate
if command -v appstreamcli >/dev/null 2>&1; then
    appstreamcli refresh-cache --force >/dev/null 2>&1 || \
        appstreamcli refresh --force    >/dev/null 2>&1 || true
fi

exit 0
