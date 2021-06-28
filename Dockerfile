# syntax = docker/dockerfile:1.2
#FROM scratch as cachebase
#ADD cache.tar.gz /

FROM node:12-alpine as node_modules

RUN apk update && \
    apk --no-cache upgrade && \
    apk add --no-cache linux-headers \
                       git \
                       openssh-client \
                       python \
                       alpine-sdk \
                       zeromq-dev

# Enable node-gyp cache
# and replacing github url https://github.com/actions/setup-node/issues/214
RUN npm install -g node-gyp-cache@0.2.1 && \
    npm config set node_gyp node-gyp-cache && \
    git config --global url."https://github.com/".insteadOf ssh://git@github.com/

# Install npm modules
ENV npm_config_zmq_external=true

COPY package.json package-lock.json /

#RUN npm ci --production
RUN --mount=type=cache,target=/root/.npm --mount=type=cache,target=/root/.cache npm ci --production

#FROM alpine as cache_export
#RUN --mount=type=cache,target=/root/.npm,from=node_modules cp -r /root/.npm /npmmount
#RUN --mount=type=cache,target=/root/.cache,from=node_modules cp -r /root/.cache /cachemount
#COPY --from=node_modules /root/.npm /root/.npm
#COPY --from=node_modules /root/.cache /root/.cache

FROM node:12-alpine

ARG NODE_ENV=production
ENV NODE_ENV ${NODE_ENV}

LABEL maintainer="Dash Developers <dev@dash.org>"
LABEL description="Drive Node.JS"

RUN apk update && apk add --no-cache zeromq-dev

# Copy NPM modules
COPY --from=node_modules /node_modules/ /node_modules
COPY --from=node_modules /package.json /package.json
COPY --from=node_modules /package-lock.json /package-lock.json

ENV PATH /node_modules/.bin:$PATH

# Copy project files
WORKDIR /usr/src/app

COPY . .

RUN cp .env.example .env

EXPOSE 26658
