# Torlink Containerization Makefile

.PHONY: build clean publish

# Build the Docker image
build:
	docker build -t torlink .

# Build and push the Docker image with a specified tag
# Usage: make publish TAG=tagname
publish:
	@if [ -z "$(TAG)" ]; then \
		echo "Error: TAG is not set. Usage: make publish TAG=tagname"; \
		exit 1; \
	fi
	docker build -t alith/torlinkui:$(TAG) .
	docker tag alith/torlinkui:$(TAG) alith/torlinkui:latest
	docker push alith/torlinkui:$(TAG)
	docker push alith/torlinkui:latest

# Clean up Docker images (optional)
clean:
	docker rmi torlink
