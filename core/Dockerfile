FROM alpine:3.22

ARG PB_VERSION=0.40.4
# Preenchido pelo Docker (amd64/arm64), igual à nomenclatura dos releases do PocketBase.
ARG TARGETARCH

RUN apk add --no-cache ca-certificates unzip wget \
 && wget -q "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${TARGETARCH}.zip" -O /tmp/pb.zip \
 && unzip /tmp/pb.zip pocketbase -d /pb \
 && rm /tmp/pb.zip

WORKDIR /pb
COPY pb_migrations ./pb_migrations
COPY pb_hooks ./pb_hooks

EXPOSE 8090
CMD ["./pocketbase", "serve", "--http=0.0.0.0:8090"]
