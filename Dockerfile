# syntax=docker/dockerfile:1
FROM alpine:3.20

ARG PB_VERSION=0.39.11
ARG TARGETARCH

RUN apk add --no-cache ca-certificates wget unzip

RUN case "${TARGETARCH}" in \
      arm64) ARCH=arm64 ;; \
      *)     ARCH=amd64 ;; \
    esac && \
    wget -q "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${ARCH}.zip" \
      -O /tmp/pb.zip && \
    unzip -q /tmp/pb.zip -d /pb && \
    rm /tmp/pb.zip

WORKDIR /pb
VOLUME /pb/pb_data
EXPOSE 8090

HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD wget -qO- http://127.0.0.1:8090/api/health || exit 1

ENTRYPOINT ["/pb/pocketbase"]
CMD ["serve", "--http=0.0.0.0:8090"]
