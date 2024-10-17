FROM maven:3.9.9-eclipse-temurin-23 AS build

# Set the working directory
WORKDIR /app

# Copy the pom.xml file to the container
COPY pom.xml .

# Download the project dependencies
RUN mvn dependency:go-offline

# Copy the Kotlin source code to the container
COPY src ./src

# Build the application using Maven
RUN mvn package

# Use the official OpenJDK image with version 22 for the runtime
FROM eclipse-temurin:23-jdk-noble

# Set the working directory
WORKDIR /app

# Copy the compiled JAR file from the build stage
COPY --from=build /app/target/crawler.jar .
