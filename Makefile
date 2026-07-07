# Torlink Containerization Makefile

.PHONY: build clean

# Build the Docker image
build:
	docker build -t torlink .

# Clean up Docker images (optional)
clean:
	docker rmi torlink