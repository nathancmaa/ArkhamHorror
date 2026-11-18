# Postgres for the NAS deployment (docker-compose.nas.yaml), with the schema
# and migrations baked in. Upstream's docker-compose.yml bind-mounts these from
# the checkout, but Portainer's Git checkout lives inside the Portainer
# container (/data/compose/<id>), so a relative bind resolves to a host path
# that does not exist and Docker would mount an empty directory instead.
# Used by both the `db` service and the one-shot `migrate` service.
FROM postgres:14.6-alpine
COPY --chmod=0444 setup.sql /docker-entrypoint-initdb.d/create_tables.sql
COPY --chmod=0444 migrate.sh /migrate.sh
COPY migrations /migrations
