# syntax=docker/dockerfile:1.4
FROM --platform=$BUILDPLATFORM python:3.14-alpine AS builder

WORKDIR /app

COPY requirements.txt /app
RUN --mount=type=cache,target=/root/.cache/pip \
    pip3 install -r requirements.txt

COPY . /app

EXPOSE 5001
# Shell form so ${PORT:-5001} expands: Render injects PORT at runtime,
# local docker-compose (no PORT set) falls back to 5001.
CMD gunicorn -w 2 -b 0.0.0.0:${PORT:-5001} main:app

FROM builder as dev-envs

RUN <<EOF
apk update
apk add git
EOF

RUN <<EOF
addgroup -S docker
adduser -S --shell /bin/bash --ingroup docker vscode
EOF