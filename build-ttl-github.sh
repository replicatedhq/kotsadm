#!/bin/bash
set -e

for i in "$@"
do
case $i in
    -u=*|--uuid=*)
    UUID="${i#*=}"
    ;;
    *)
esac
done

export UUID=${UUID:-`id -u -n`}

# Generate fixtures
docker run \
  -v $PWD/migrations/fixtures:/out \
  -v $PWD/migrations/tables:/in \
  schemahero/schemahero:0.7.2 \
  fixtures --input-dir /in --output-dir /out/schema --dbname ship-cloud --driver postgres

make -C migrations/fixtures deps build run build-ttl-github.sh
make -C migrations build-ttl-github.sh
make -C web deps build-kotsadm
make kotsadm build-ttl-github.sh
make -C operator build build-ttl-github.sh
make -C kurl_proxy build build-ttl-github.sh
make -C api no-yarn deps build build-ttl-github.sh
make -C minio build-ttl-github.sh

printf "\n\n\n"
printf "These images are good for 12 hours\n"
