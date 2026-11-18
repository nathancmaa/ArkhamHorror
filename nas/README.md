# Running this fork on the NAS

The stack is `docker-compose.nas.yaml`, deployed as a Portainer Git stack. Its
header lists the stack variables and the command that builds the web image.
This page covers what lives outside the containers: card art and backups.

Everything below runs in an SSH session on the NAS. `sudo` is needed for
`docker` there. The paths assume the default `ARKHAM_DATA_DIR`,
`/volume1/docker/arkhamhorror`; change `D` if you set another.

```sh
D=/volume1/docker/arkhamhorror
```

## Card art on the NAS

The app serves art from this folder by default (`ARKHAM_ASSET_HOST` unset or
empty), so do steps 1 and 2 before the first deploy, or set
`ARKHAM_ASSET_HOST=https://assets.arkhamhorror.app` in the stack to use the
upstream CDN until they are done.

**1. Seed the folder from the web image.** The stack mounts `$D/img` over the
image's own `img/`, which holds icons, chaos tokens and slots. Copy those out
first so the mount hides nothing, and make the custom-card folder writable by
the app's user:

```sh
sudo mkdir -p "$D/img"
sudo docker run --rm --user 0 -v "$D/img:/out" --entrypoint sh arkhamhorror-web:nas \
  -c 'cp -an /opt/arkham/src/frontend/dist/img/. /out/ && mkdir -p /out/custom && chown yesod:yesod /out/custom'
```

**2. Fetch the English art** (about 1.3 GB). Upstream's own fetcher, run in the
image upstream uses for it. It only downloads what is missing or changed, so
re-run it after pulling a new upstream release:

```sh
sudo docker run --rm -v "$D/img:/workspace/frontend/public/img" --entrypoint bash amazon/aws-cli -c \
  'mkdir -p /workspace/scripts &&
   curl -fsSL https://raw.githubusercontent.com/nathancmaa/ArkhamHorror/main/scripts/fetch-assets.sh \
     -o /workspace/scripts/fetch-assets.sh &&
   bash /workspace/scripts/fetch-assets.sh en'
```

It ends with a count of downloaded, skipped and failed files. Re-run it until
nothing fails. (`en` also lists the third-edition images; they land inside the
throwaway container and are discarded.)

**3. Redeploy the stack** if it was running on the CDN, after removing
`ARKHAM_ASSET_HOST` from the stack variables (or setting it empty).

**Check:** open a game and look at a card face, a card back, an investigator
portrait and a location. In the browser's network panel, images should come
from the NAS, not `assets.arkhamhorror.app`.

## Backups

The `backup` service writes `$D/backups/arkham-<date>-<time>.dump` (a
`pg_dump` custom-format archive of the whole database):

- on every deploy, before `migrate` runs, so each upgrade has a dump from
  before it;
- daily at `ARKHAM_BACKUP_AT` (UTC, default `11:00`);
- keeping `ARKHAM_BACKUP_KEEP_DAYS` days (default 14).

`sudo docker logs arkhamhorror-backup` shows each dump and its size.

**Off the NAS:** the dumps are only a backup once a copy lives elsewhere. Add
`$D/backups` to a Hyper Backup task (or whatever already copies the NAS
offsite). `$D/img/custom` holds art for custom cards, if you make any; the rest
of `$D/img` can always be fetched again.

The web image is not in the dump. When upgrading, keep the previous image under
another tag (`sudo docker tag arkhamhorror-web:nas arkhamhorror-web:prev`) so a
restore can go back to the app and schema together.

### Test a restore

Do this once now, and again after any change to the backup service. It
restores the newest dump into a scratch database beside the live one:

```sh
F=$(ls -t "$D"/backups/arkham-*.dump | head -1); echo "$F"
sudo docker exec arkhamhorror-db createdb -U arkham_pg_user arkham_restore_test
sudo docker exec -i arkhamhorror-db pg_restore -U arkham_pg_user -d arkham_restore_test --no-owner < "$F"
for db in arkham-horror-backend arkham_restore_test; do
  sudo docker exec arkhamhorror-db psql -U arkham_pg_user -d "$db" -tAc \
    "select '$db', (select count(*) from users), (select count(*) from arkham_games), (select count(*) from arkham_decks)"
done
```

The two lines should match, apart from anything played since the dump.

To go further and open a saved game from the restored copy, run a second web
container against it on port 3019, sign in there, and check that a game in
progress resumes at the same prompt:

```sh
NET=$(sudo docker inspect arkhamhorror-db --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}')
sudo docker run --rm -d --name arkhamhorror-restore-check --network "$NET" -p 3019:3000 \
  -e DATABASE_URL='postgres://arkham_pg_user:<ARKHAM_PG_PASSWORD>@db:5432/arkham_restore_test' \
  -e JWT_SECRET='<ARKHAM_JWT_SECRET>' -e ASSET_HOST=https://assets.arkhamhorror.app \
  arkhamhorror-web:nas
```

Clean up afterwards:

```sh
sudo docker stop arkhamhorror-restore-check
sudo docker exec arkhamhorror-db dropdb -U arkham_pg_user arkham_restore_test
```

### Restore for real

This replaces the live database with the dump. Take a fresh dump first if the
current state might still be wanted (`sudo docker restart arkhamhorror-backup`
writes one).

```sh
sudo docker stop arkhamhorror
sudo docker exec -i arkhamhorror-db pg_restore -U arkham_pg_user -d arkham-horror-backend \
  --clean --if-exists --no-owner < "$F"
```

Then redeploy the stack from Portainer rather than just starting `arkhamhorror`,
so `migrate` brings an older dump up to the current schema.
