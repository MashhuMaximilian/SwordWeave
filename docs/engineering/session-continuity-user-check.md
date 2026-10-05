# Test a saved session across devices

Use a test character or a private monster play copy. Sign in to the same account on both devices and open the **same sheet or play-copy URL**. Two different monster copies intentionally have separate sessions.

## Normal synchronization

1. On your phone, change current Vitality, toggle a capability/effect, or add a consequence.
2. Wait for **Session saved** in the Session synchronization panel.
3. Bring the laptop tab into focus; refresh if needed. The same values should appear.
4. Make a change on the laptop and repeat in the other direction.

## Offline continuation

1. Open the sheet online first and wait for Session saved.
2. Disconnect that device from the internet. Keep the sheet open.
3. Change Vitality or a toggle. The panel should report **Offline · session edits stay on this device** and queued changes.
4. Reconnect and bring the tab into focus. Wait for Session saved, then check the other device.

An uncached sheet cannot be opened for the first time offline. Authoring, adding library entries, and publishing require a connection.

## Merging and conflicts

For a reproducible check, take the phone offline with the sheet already open. On the laptop, change Vitality and wait for Session saved. On the offline phone, change an effect toggle, then reconnect: both different-field changes should survive.

Repeat with **both devices changing current Vitality** to different values. On reconnect, the phone should show a conflict with This device and Saved session values. Choose **Keep local changes** or **Use saved session**, then verify the selected value on both devices. Nothing should apply damage twice during retries.

## Backup and restore

1. Choose **Export session JSON** and keep the downloaded file.
2. Change a test value and wait for Session saved.
3. Choose **Preview session backup**, select that file, and review the proposed changes.
4. Choose **Restore session values** to restore them, or Cancel to leave the session unchanged.

The file restores gameplay values for this exact accessible sheet and compatible build. It is not a full character/template import, and another monster play copy is a different subject. Export before testing if you want to restore your starting state.
