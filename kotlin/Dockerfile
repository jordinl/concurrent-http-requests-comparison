FROM maven:3.9.9-eclipse-temurin-22 AS build

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
FROM eclipse-temurin:22-jdk-jammy

# Set the working directory
WORKDIR /app

# Copy the compiled JAR file from the build stage
COPY --from=build /app/target/crawler.jar .

# Set the entry point to run the compiled Kotlin application
ENTRYPOINT ["java", "-jar", "crawler.jar"]
