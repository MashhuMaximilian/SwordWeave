#!/usr/bin/env python3
"""Pull public GitHub main and deploy only after the Hetzner cutover."""
import fcntl
import hashlib
import http.client
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import time

REPOSITORY = "https://github.com/MashhuMaximilian/SwordWeave.git"
REF = "refs/heads/main"
CONFIG = Path("/etc/swordweave/production")
STATE = Path("/var/lib/swordweave/deploy-main")
CHECKOUT = STATE / "source.git"
ACTIVE = STATE / "active.json"
PENDING = STATE / "pending.json"
REJECTED = STATE / "rejected.json"
BUILDER = "swordweave-main-builder"
PROJECT = "swordweave-production"
COMPOSE = CONFIG / "compose.yml"
SERVICE = "swordweave"
LIVE_PORT = 3100
SCHEMA_PATHS = ("drizzle.config.ts", "src/db/schema", "src/db/migrations")
CONTEXT_PATHS = (
    ".dockerignore", "package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml",
    "next-env.d.ts", "next.config.ts", "tsconfig.json", "postcss.config.mjs",
    "tailwind.config.ts", "src", "data", "assets/character-pdf", "public",
    "scripts", "infrastructure/hetzner/Dockerfile",
)


class CapacityError(RuntimeError):
    """A transient constraint; retry without blocking this revision."""


def command(*args, capture=False, timeout=60, env=None):
    return subprocess.run(args, check=True, timeout=timeout, env=env,
                          stdout=subprocess.PIPE if capture else None,
                          text=True).stdout


def git(*args, timeout=90):
    return command("git", "-c", "credential.helper=", "-c", "http.followRedirects=false",
                   *args, capture=True, timeout=timeout,
                   env={**os.environ, "GIT_TERMINAL_PROMPT": "0", "GIT_CONFIG_NOSYSTEM": "1",
                        "GIT_CONFIG_GLOBAL": "/dev/null", "GIT_ASKPASS": "/bin/false"})


def main_revision():
    line = git("ls-remote", "--exit-code", REPOSITORY, REF).strip()
    match = re.fullmatch(r"([a-f0-9]{40})\trefs/heads/main", line)
    if not match:
        raise RuntimeError("GitHub returned an unexpected main reference")
    return match[1]


def get_record(path):
    return json.loads(path.read_text()) if path.exists() else {}


def save_record(path, record):
    with tempfile.NamedTemporaryFile(mode="w", dir=STATE, delete=False) as file:
        temp = Path(file.name)
        try:
            json.dump(record, file)
            file.write("\n")
            file.flush()
            os.fsync(file.fileno())
            os.replace(temp, path)
            directory = os.open(STATE, os.O_RDONLY | os.O_DIRECTORY)
            try:
                os.fsync(directory)
            finally:
                os.close(directory)
        finally:
            temp.unlink(missing_ok=True)


def active_record():
    record = get_record(ACTIVE)
    if not (re.fullmatch(r"[a-f0-9]{40}", record.get("revision", ""))
            and re.fullmatch(r"sha256:[a-f0-9]{64}", record.get("image", ""))
            and re.fullmatch(r"[a-f0-9]{64}", record.get("schema", ""))):
        raise RuntimeError("The verified initial production release has not been recorded")
    return record


def compose(image, *args, timeout=60, capture=False):
    env = {**os.environ, "SW_IMAGE": image, "SW_RUNTIME_ENV": str(CONFIG / "runtime.env"),
           "SW_UPLOAD_ALIAS_FILE_HOST": str(CONFIG / "upload-aliases.json")}
    return command("docker", "compose", "--env-file", "/dev/null", "-p", PROJECT,
                   "-f", str(COMPOSE), *args, timeout=timeout, capture=capture, env=env)


def running_image(image):
    container = compose(image, "ps", "--status", "running", "-q", SERVICE, capture=True).strip()
    if not re.fullmatch(r"[a-f0-9]{12,64}", container):
        raise RuntimeError("The production Compose service is not running")
    return command("docker", "inspect", "--format", "{{.Image}}", container, capture=True).strip()


def check(port, *, attempts=12):
    secret = (CONFIG / "readiness.secret").read_text().strip()
    if not re.fullmatch(r"[a-f0-9]{64}", secret):
        raise RuntimeError("The protected readiness key is missing or invalid")
    for attempt in range(attempts):
        conn = http.client.HTTPConnection("127.0.0.1", port, timeout=22)
        try:
            conn.request("GET", "/api/health/ready", headers={"X-SwordWeave-Readiness-Key": secret})
            response = conn.getresponse()
            receipt = json.loads(response.read(8192))
            if response.status == 200 and receipt.get("schemaVersion") == 1 and (
                receipt.get("checks") == dict.fromkeys(
                    ("configuration", "assets", "python", "database", "uploads"), "pass"
                )
            ):
                return
        except (OSError, http.client.HTTPException, ValueError):
            pass
        finally:
            conn.close()
        if attempt + 1 < attempts:
            time.sleep(2)
    raise RuntimeError("Protected readiness did not pass")


def activate(image):
    compose(image, "up", "-d", "--no-deps", "--pull", "never", "--wait",
            "--wait-timeout", "90", SERVICE, timeout=115)
    if running_image(image) != image:
        raise RuntimeError("Production did not start the intended image")
    check(LIVE_PORT, attempts=3)


def rehearsal(image):
    name = f"swordweave-main-smoke-{os.getpid()}"
    try:
        compose(image, "run", "-d", "--rm", "--no-deps", "--pull", "never",
                "--name", name, "-p", "127.0.0.1::3000", SERVICE, capture=True)
        address = command("docker", "port", name, "3000/tcp", capture=True).strip()
        match = re.fullmatch(r"127\.0\.0\.1:([0-9]{1,5})", address)
        if not match:
            raise RuntimeError("Candidate did not receive a loopback-only port")
        check(int(match[1]))
    finally:
        subprocess.run(["docker", "rm", "-f", name], stdout=subprocess.DEVNULL,
                       stderr=subprocess.DEVNULL, timeout=20)


def schema_digest(repo, revision):
    entries = git("--git-dir", str(repo), "ls-tree", revision, "--", *SCHEMA_PATHS)
    if len(entries.splitlines()) != len(SCHEMA_PATHS):
        raise RuntimeError("Candidate is missing required schema paths")
    return hashlib.sha256(entries.encode()).hexdigest()


def build(revision):
    # Build only the selected Git objects. No host env files or service credentials
    # enter the build context. Limit the worker to leave resources for AIDM and the app.
    tag = f"swordweave:main-{revision}"
    if shutil.disk_usage(STATE).free < 25 * 1024**3:
        raise CapacityError("SwordWeave deploy skipped: less than 25 GiB disk space")
    memory = re.search(r"^MemAvailable:\s+(\d+) kB$", Path("/proc/meminfo").read_text(), re.M)
    if not memory or int(memory[1]) < 4_300_000:
        raise CapacityError("SwordWeave deploy skipped: less than 4.3 GB available RAM")
    clerk = (CONFIG / "clerk-publishable.key").read_text().strip()
    ga = (CONFIG / "ga-measurement-id").read_text().strip()
    if not re.fullmatch(r"pk_live_[A-Za-z0-9_-]+={0,2}", clerk) or not re.fullmatch(r"G-[A-Z0-9]+", ga):
        raise RuntimeError("Public build settings are invalid")
    remove_builder()
    with tempfile.TemporaryDirectory(prefix="build-", dir=STATE) as work:
        archive = Path(work) / "context.tar"
        context = Path(work) / "context"
        context.mkdir()
        command("git", "--git-dir", str(CHECKOUT), "archive", "--output", str(archive),
                revision, "--", *CONTEXT_PATHS)
        command("tar", "-xf", str(archive), "-C", str(context))
        archive.unlink()
        try:
            command("docker", "buildx", "create", "--name", BUILDER, "--driver", "docker-container",
                    "--driver-opt", "memory=3g,memory-swap=3g,cpu-period=100000,cpu-quota=200000",
                    capture=True)
            command("docker", "buildx", "build", "--builder", BUILDER, "--platform", "linux/amd64",
                    "--load", "-t", tag, "-f", str(context / "infrastructure/hetzner/Dockerfile"),
                    "--label", f"org.opencontainers.image.revision={revision}",
                    "--build-arg", f"NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY={clerk}",
                    "--build-arg", f"NEXT_PUBLIC_GA_MEASUREMENT_ID={ga}", str(context), timeout=2400)
        finally:
            remove_builder()
    image = command("docker", "image", "inspect", "--format", "{{.Id}}", tag, capture=True).strip()
    if not re.fullmatch(r"sha256:[a-f0-9]{64}", image):
        raise RuntimeError("Candidate image was not loaded")
    return image


def remove_builder():
    subprocess.run(["docker", "buildx", "rm", BUILDER], stdout=subprocess.DEVNULL,
                   stderr=subprocess.DEVNULL, timeout=45)


def prune(keep):
    tags = command("docker", "image", "ls", "swordweave", "--format", "{{.Tag}}", capture=True)
    for tag in tags.splitlines():
        if re.fullmatch(r"main-[a-f0-9]{40}", tag) and tag[5:] not in keep:
            subprocess.run(["docker", "image", "rm", f"swordweave:{tag}"], timeout=30)


def fetch(revision, *, initial=False):
    if not CHECKOUT.exists():
        git("init", "--bare", str(CHECKOUT))
    source, destination = ((revision, "refs/swordweave/initial") if initial
                           else (REF, "refs/swordweave/main"))
    git("--git-dir", str(CHECKOUT), "fetch", "--depth=1", "--no-tags",
        REPOSITORY, f"+{source}:{destination}", timeout=240)
    if git("--git-dir", str(CHECKOUT), "rev-parse", destination).strip() != revision:
        raise RuntimeError("GitHub main changed during fetch; will retry")


def initialize(revision, image):
    if (ACTIVE.exists() or not re.fullmatch(r"[a-f0-9]{40}", revision)
            or not re.fullmatch(r"sha256:[a-f0-9]{64}", image)):
        raise RuntimeError("Expected an initial, reviewed commit and image digest")
    if running_image(image) != image:
        raise RuntimeError("Initial production image does not match")
    check(LIVE_PORT, attempts=3)
    fetch(revision, initial=True)
    save_record(ACTIVE, {"revision": revision, "image": image,
                         "schema": schema_digest(CHECKOUT, revision)})


def deploy():
    active = active_record()
    if PENDING.exists():
        # If a reboot interrupted a switch, restore the last recorded good image first.
        activate(active["image"])
        PENDING.unlink()
    if running_image(active["image"]) != active["image"]:
        raise RuntimeError("Running production image differs from the verified release record")
    revision = main_revision()
    if revision in (active["revision"], get_record(REJECTED).get("revision")):
        return
    fetch(revision)
    if schema_digest(CHECKOUT, revision) != active["schema"]:
        save_record(REJECTED, {"revision": revision, "reason": "schema changed; needs manual release"})
        raise RuntimeError("Schema changes require a manual release")

    try:
        image = build(revision)
        rehearsal(image)
    except CapacityError as exc:
        print(exc, flush=True)
        return
    except (RuntimeError, subprocess.CalledProcessError, subprocess.TimeoutExpired):
        save_record(REJECTED, {"revision": revision, "reason": "build or readiness failed; inspect journal"})
        prune({active["revision"], active.get("previousRevision")})
        raise
    if main_revision() != revision:
        prune({active["revision"], active.get("previousRevision")})
        print("GitHub main changed during build; will check the new tip next time", flush=True)
        return

    save_record(PENDING, {"revision": revision, "image": image})
    try:
        activate(image)
    except (RuntimeError, subprocess.CalledProcessError, subprocess.TimeoutExpired):
        save_record(REJECTED, {"revision": revision, "reason": "production check failed; inspect journal"})
        activate(active["image"])
        PENDING.unlink()
        print(f"Restored {active['revision']} after {revision} failed", flush=True)
        raise
    save_record(ACTIVE, {**active, "revision": revision, "image": image,
                         "previousRevision": active["revision"], "previousImage": active["image"]})
    PENDING.unlink()
    REJECTED.unlink(missing_ok=True)
    prune({revision, active["revision"]})
    print(f"Deployed GitHub main {revision} ({image})", flush=True)


def main():
    if sys.argv[1:] == ["--observe"]:
        print(f"GitHub main: {main_revision()}", flush=True)
    elif len(sys.argv) == 1 or (len(sys.argv) == 4 and sys.argv[1] == "--initialize"):
        initialize_args = sys.argv[2:]
        if not initialize_args and not (CONFIG / "autodeploy-enabled").is_file():
            return
        STATE.mkdir(mode=0o700, parents=True, exist_ok=True)
        with open("/run/lock/swordweave-maintenance.lock", "a") as lock:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                if initialize_args:
                    raise RuntimeError("Another migration or deploy operation holds the lock")
                return
            if initialize_args:
                initialize(*initialize_args)
            else:
                deploy()
    else:
        raise SystemExit("Unknown deployment option")


if __name__ == "__main__":
    os.umask(0o077)
    main()
