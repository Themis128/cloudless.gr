FROM golang:1.23.7-alpine3.20 as build
ENV GO111MODULE=on
ENV CGO_ENABLED=0
ENV GOOS=linux

RUN apk add --no-cache make git

WORKDIR /go/src/github.com/supabase/auth

# Pulling dependencies
COPY ./Makefile ./go.* ./
RUN make deps

# Building stuff
COPY . /go/src/github.com/supabase/auth

# Make sure you change the RELEASE_VERSION value before publishing an image.
RUN RELEASE_VERSION=unspecified make build

# Always use alpine:3 so the latest version is used. This will keep CA certs more up to date.
FROM alpine:3
RUN adduser -D -u 1000 supabase

RUN apk add --no-cache ca-certificates bash git

# Copy binaries and migrations
COPY --from=build /go/src/github.com/supabase/auth/auth /usr/local/bin/auth
COPY --from=build /go/src/github.com/supabase/auth/migrations /usr/local/etc/auth/migrations/
RUN ln -s /usr/local/bin/auth /usr/local/bin/gotrue


# Copy OpenAPI spec, coverage script, tools tracking file, and only existing extra directories
COPY openapi.yaml /usr/local/etc/auth/openapi.yaml
COPY hack/ /usr/local/etc/auth/hack/
COPY tools/ /usr/local/etc/auth/tools/
COPY docs/ /usr/local/etc/auth/docs/
COPY cmd/ /usr/local/etc/auth/cmd/
COPY internal/ /usr/local/etc/auth/internal/
# client/ is omitted as it may be empty or not needed

# Install oapi-codegen for code generation (optional, remove if not needed in runtime)
RUN apk add --no-cache go && \
    go install github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen@latest && \
    apk del go

ENV GOTRUE_DB_MIGRATIONS_PATH /usr/local/etc/auth/migrations

USER supabase
CMD ["auth"]
