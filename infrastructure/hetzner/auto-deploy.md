# SwordWeave releases from GitHub main

The VPS reads GitHub's public `main` over HTTPS every two minutes. No GitHub token, Actions runner or inbound deployment port is needed. A newer push can supersede a release still being built. Only approved maintainers should be able to write to `main`: the released application runs with the ordinary production application credentials.

The build uses the selected Git tree, locked dependencies and two public build settings. The current app stays up while the candidate builds and passes its private readiness check. The deploy then briefly recreates the app container and checks it again. If the check fails, it restores the last good image. If an interruption occurs during the switch, the next run restores the recorded image before processing another push. Caddy, DNS, backups and AIDM are outside this service's release scope.

Changes to database schema or migration files require a coordinated manual release. The deploy never runs database migrations. The host's Compose, Caddy and operational scripts are installed separately and are not replaced from GitHub by the timer.

## Activate after the migration cutover

1. Verify the public site is live on Hetzner. Production must run under the `swordweave-production` Compose project on port 3100. Install its reviewed Compose file as `/etc/swordweave/production/compose.yml` and place the approved public Google measurement ID in `/etc/swordweave/production/ga-measurement-id`.
2. Install the Python script under `/opt/swordweave/operations/` and the service and timer under `/etc/systemd/system/`. Confirm that the source revision of the active image is on GitHub and that the Hetzner deployment source is on `main`. Run the following with the reviewed values as root:

   ```sh
   python3 /opt/swordweave/operations/deploy-main.py --initialize INITIAL_COMMIT sha256:INITIAL_IMAGE_DIGEST
   install -m 600 /dev/null /etc/swordweave/production/autodeploy-enabled
   systemctl daemon-reload
   systemctl enable --now swordweave-deploy-main.timer
   systemctl start swordweave-deploy-main.service
   ```

3. Inspect `journalctl -u swordweave-deploy-main.service`, the active record at `/var/lib/swordweave/deploy-main/active.json`, and public availability. Once active, a push to `main` triggers a release at the next check. A failed revision is skipped on subsequent checks; fix it with a new commit or remove `rejected.json` after investigating to retry that revision.

To pause releases, remove `/etc/swordweave/production/autodeploy-enabled` and stop the timer. Let a running release finish or roll back before manually changing the production service. The recovery records identify the previous image. A manual change of the running image requires reconciling the active record before resuming.
