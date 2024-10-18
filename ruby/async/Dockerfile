FROM ruby:3.3-alpine

RUN apk add --no-cache build-base
RUN bundle config --global frozen 1

WORKDIR /app

COPY Gemfile Gemfile.lock ./
RUN bundle install

COPY . .
